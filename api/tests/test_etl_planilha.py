"""ETL da planilha. Testes de integração usam o Postgres de TEST_DATABASE_URL (ver conftest)."""

from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, insert, select, text

from app.etl import planilha as etl
from app.etl import siafe as etl_siafe
from app.models import TABELAS_PLANILHA, PlanilhaImportacao
from app.planilha import layout as L
from app.planilha.extracao import ErroLayout
from tests.planilha_sintetica import gerar

CONTAGENS_SINTETICA = {
    "planilha_convenios_geral": 3,
    "planilha_convenios_transferidos": 3,
    "planilha_convenios_vigentes": 3,
    "planilha_prestacao_contas": 4,
    "planilha_realinhado_sem_execucao": 2,
    "planilha_nao_realinhado_expirado": 2,
    "planilha_tomada_contas": 5,
    "planilha_acompanhamento_especial": 2,
}


@pytest.fixture
def planilha(tmp_path: Path) -> Path:
    return gerar(tmp_path / "planilha.xlsx")


def _importar(engine, caminho: Path) -> etl.Resultado:
    return etl.executar(engine, etl.reservar(engine, caminho), caminho)


def _contagens(engine) -> dict[str, int]:
    with engine.connect() as conn:
        return {
            aba.tabela: conn.scalar(select(func.count()).select_from(TABELAS_PLANILHA[aba.nome])) for aba in L.ABAS
        }


def _importacao_ids(engine) -> set[int]:
    with engine.connect() as conn:
        return {
            i for aba in L.ABAS for i in conn.scalars(select(TABELAS_PLANILHA[aba.nome].c.importacao_id).distinct())
        }


def _registros(engine) -> list:
    with engine.connect() as conn:
        return conn.execute(select(PlanilhaImportacao).order_by(PlanilhaImportacao.id)).all()


def test_sucesso_grava_as_oito_tabelas_normalizadas(db, planilha):
    resultado = _importar(db, planilha)

    assert _contagens(db) == CONTAGENS_SINTETICA
    assert _importacao_ids(db) == {resultado.importacao_id}

    transferidos = TABELAS_PLANILHA["89 Convênios"]
    with db.connect() as conn:
        linhas = conn.execute(select(transferidos).order_by(transferidos.c.linha)).mappings().all()
        tabelas_planilha2 = conn.scalar(
            text("SELECT count(*) FROM information_schema.tables WHERE table_name ILIKE '%planilha2%'")
        )
    assert [(l["linha"], l["linha_principal"]) for l in linhas] == [(4, True), (5, False), (6, True)]
    assert linhas[1]["municipio"] == "Aperibé" and linhas[1]["numero_convenio"] == "143/2014"
    assert linhas[1]["codigo_seobras"] == "007783" and linhas[1]["valor_total_inicial"] is None
    assert linhas[0]["cronograma_repasse_inicial"] == Decimal("991879.421")
    assert linhas[0]["realinhado"] is True and linhas[0]["situacao_vigencia"] == "Vigente"
    assert tabelas_planilha2 == 0

    (registro,) = _registros(db)
    assert registro.status == "sucesso" and registro.fim is not None
    assert registro.arquivo == "planilha.xlsx" and len(registro.sha256) == 64
    assert registro.linhas_por_aba == CONTAGENS_SINTETICA
    assert registro.total_avisos == 8 == len(registro.avisos)
    assert registro.avisos_por_motivo == {"valor_invalido": 4, "categoria_desconhecida": 2,
                                          "codigo_invalido": 1, "repeticao_divergente": 1}
    assert {"aba", "celula", "coluna", "motivo", "valor"} == set(registro.avisos[0])


def test_segunda_importacao_substitui_tudo(db, planilha):
    _importar(db, planilha)
    segunda = _importar(db, planilha)

    assert _contagens(db) == CONTAGENS_SINTETICA
    assert _importacao_ids(db) == {segunda.importacao_id}
    assert [r.status for r in _registros(db)] == ["sucesso", "sucesso"]


def test_falha_de_layout_na_ultima_aba_nao_altera_nada(db, planilha, tmp_path):
    primeira = _importar(db, planilha)
    invalida = gerar(tmp_path / "invalida.xlsx", cabecalho=(L.ACOMPANHAMENTO_ESPECIAL.nome, "F2", "Outra coisa"))

    with pytest.raises(ErroLayout):
        _importar(db, invalida)

    assert _contagens(db) == CONTAGENS_SINTETICA
    assert _importacao_ids(db) == {primeira.importacao_id}
    ultimo = _registros(db)[-1]
    assert ultimo.status == "falha" and ultimo.fim is not None
    assert "ACOMPANHAMENTO ESPECIAL" in ultimo.erro and "F2" in ultimo.erro


def test_lock_ocupado_recusa_sem_ler_o_arquivo(db, planilha, monkeypatch):
    def nao_pode_ler(*_):
        raise AssertionError("o arquivo não deveria ser lido")

    monkeypatch.setattr(etl, "_sha256", nao_pode_ler)
    monkeypatch.setattr(etl, "extrair", nao_pode_ler)
    with db.connect() as outro:
        assert outro.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": etl.LOCK_ID})
        try:
            with pytest.raises(etl.ImportacaoEmAndamento):
                etl.reservar(db, planilha)
        finally:
            outro.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": etl.LOCK_ID})
    assert _registros(db) == []


def test_carga_siafe_em_andamento_nao_bloqueia(db, planilha):
    with db.connect() as siafe:
        assert siafe.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": etl_siafe.LOCK_ID})
        try:
            resultado = _importar(db, planilha)
        finally:
            siafe.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": etl_siafe.LOCK_ID})
    assert resultado.total_linhas == sum(CONTAGENS_SINTETICA.values())


def test_importacao_orfa_vira_falha(db, planilha):
    with db.begin() as conn:
        orfa = conn.scalar(
            insert(PlanilhaImportacao).values(status="em_andamento", arquivo="x.xlsx", sha256="0" * 64)
            .returning(PlanilhaImportacao.id)
        )
    _importar(db, planilha)
    registros = {r.id: r for r in _registros(db)}
    assert registros[orfa].status == "falha"
    assert "interrompida" in registros[orfa].erro


def test_cli_sucesso(db, planilha, capsys):
    assert etl.main([str(planilha)], engine=db) == 0
    saida = capsys.readouterr().out
    assert "concluída: 24 linhas" in saida
    assert "89 Convênios (planilha_convenios_transferidos): 3" in saida
    assert "Avisos: 8 (valor_invalido: 4" in saida
    assert "Prest de Contas Conv_Execução!J6 [valor_invalido] valor_executado: Verificar NL" in saida


def test_cli_arquivo_inexistente(db, tmp_path, capsys):
    assert etl.main([str(tmp_path / "nao_existe.xlsx")], engine=db) == 1
    assert "arquivo não encontrado" in capsys.readouterr().err
    assert _registros(db) == []


def test_cli_layout_invalido(db, tmp_path, capsys):
    caminho = gerar(tmp_path / "p.xlsx", sem_total_31=True)
    assert etl.main([str(caminho)], engine=db) == 1
    assert "Total Geral" in capsys.readouterr().err
    assert [r.status for r in _registros(db)] == ["falha"]


def test_cli_lock_ocupado(db, planilha, capsys):
    with db.connect() as outro:
        outro.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": etl.LOCK_ID})
        try:
            assert etl.main([str(planilha)], engine=db) == 2
        finally:
            outro.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": etl.LOCK_ID})
    assert "em andamento" in capsys.readouterr().err
