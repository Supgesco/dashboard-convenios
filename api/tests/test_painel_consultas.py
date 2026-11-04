"""Consultas do painel gerencial (app.painel.consultas) e normalização do filtro de municípios.

As consultas rodam no Postgres de TEST_DATABASE_URL (ver conftest). A normalização não usa
banco. Todos os números, códigos e valores são fictícios.
"""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import Engine, insert

from app.models import EtlExecucao, PlanilhaImportacao
from app.painel import consultas as Q
from app.painel.municipios import normalizar_municipios
from tests.test_cruzamento import A31, A89, A342, Carga


@pytest.fixture
def carga(db: Engine) -> Carga:
    return Carga(db)


def _rodar(carga: Carga, funcao, *args):
    with carga.engine.connect() as conn:
        return funcao(conn, *args)


# --- normalização do filtro (sem banco) ---


def test_municipio_sem_acento_e_caixa():
    assert normalizar_municipios(["niteroi", "PARATY"]) == (["Niterói", "Paraty"], [])


def test_municipio_por_alias():
    assert normalizar_municipios(["COMENDADOR L. GASPARIAN"]) == (["Comendador Levy Gasparian"], [])


def test_municipio_inexistente():
    assert normalizar_municipios(["Paraty", "Atlantida", "Atlantida"]) == (["Paraty"], ["Atlantida"])


def test_municipio_repetido():
    assert normalizar_municipios(["Resende", "resende", "Resende "]) == (["Resende"], [])


# --- saldos ---


def _codigo_compartilhado(carga: Carga) -> None:
    """Dois convênios vigentes em municípios diferentes com o mesmo código 900001."""
    carga.planilha(A342, "1/2020", "Paraty", "900001")
    carga.planilha(A342, "2/2020", "Resende", "900001", "900002")
    for numero, municipio in (("1/2020", "Paraty"), ("2/2020", "Resende")):
        carga.planilha(A89, numero, municipio)
        carga.planilha(A31, numero, municipio)
    carga.siafe(2026, 10, "900001", a_pagar="100")
    carga.siafe(2026, 10, "900002", a_pagar="10")
    carga.siafe(2026, 10, "999999", a_pagar="20")  # conta sem convênio


def test_codigo_compartilhado_conta_uma_vez_no_total(carga):
    _codigo_compartilhado(carga)

    saldo = _rodar(carga, Q.saldos, Q.Filtro("31"), 2026, 10)
    assert saldo["a_pagar"] == Decimal("110.00")
    assert saldo["a_comprovar"] == Decimal("0.00")


def test_codigo_compartilhado_conta_nas_duas_linhas_do_ranking(carga):
    _codigo_compartilhado(carga)

    linhas = _rodar(carga, Q.ranking_municipios, Q.Filtro("31"), 2026, 10).itens
    assert [(l["municipio"], l["a_pagar"], l["codigo_compartilhado"]) for l in linhas] == [
        ("Paraty", Decimal("100.00"), True),
        ("Resende", Decimal("110.00"), True),
    ]


def test_compartilhamento_e_avaliado_dentro_do_filtro(carga):
    _codigo_compartilhado(carga)

    [linha] = _rodar(carga, Q.ranking_municipios, Q.Filtro("31", ["Paraty"]), 2026, 10).itens
    assert linha["codigo_compartilhado"] is False
    convenios = _rodar(carga, Q.lista_convenios, Q.Filtro("31"), 2026, 10).itens
    assert [c["codigo_compartilhado"] for c in convenios] == [True, True]


def test_cobertura_com_conta_sem_convenio(carga):
    _codigo_compartilhado(carga)

    vinculado = _rodar(carga, Q.saldos, Q.Filtro("342"), 2026, 10)
    total = _rodar(carga, Q.saldos_total_siafe, 2026, 10)
    assert (vinculado["a_pagar"], total["a_pagar"]) == (Decimal("110.00"), Decimal("130.00"))


def test_filtro_de_municipios(carga):
    _codigo_compartilhado(carga)

    assert _rodar(carga, Q.saldos, Q.Filtro("31", ["Paraty"]), 2026, 10)["a_pagar"] == Decimal("100.00")
    assert _rodar(carga, Q.contar_convenios, Q.Filtro("31", ["Paraty", "Resende"])) == 2


def test_municipio_sem_convenio_tem_saldos_nulos(carga):
    _codigo_compartilhado(carga)

    filtro = Q.Filtro("31", ["Niterói"])
    assert _rodar(carga, Q.contar_convenios, filtro) == 0
    assert set(_rodar(carga, Q.saldos, filtro, 2026, 10).values()) == {None}
    assert set(_rodar(carga, Q.contratual, filtro).values()) == {None}


def test_meses_nao_se_somam(carga):
    carga.planilha(A342, "1/2020", "Paraty", "900001")
    carga.siafe(2026, 9, "900001", a_pagar="7")
    carga.siafe(2026, 10, "900001", a_pagar="5")

    assert _rodar(carga, Q.saldos, Q.Filtro("342"), 2026, 10)["a_pagar"] == Decimal("5.00")


def test_mes_anterior_na_virada_de_ano():
    assert Q.mes_anterior(2026, 1) == (2025, 12)
    assert Q.mes_anterior(2026, 11) == (2026, 10)


def test_mes_com_dados_e_ultimo_mes(carga):
    assert _rodar(carga, Q.ultimo_mes) is None
    carga.siafe(2025, 12, "900001")
    carga.siafe(2026, 2, "900001")

    assert _rodar(carga, Q.ultimo_mes) == (2026, 2)
    assert _rodar(carga, Q.mes_tem_dados, 2026, 2) is True
    assert _rodar(carga, Q.mes_tem_dados, 2026, 1) is False


# --- contratuais e situação ---


def test_percentual_e_quociente_de_somas(carga):
    for numero, investido, repasse in (("A", "50", "100"), ("B", "300", "300")):
        carga.planilha(A342, numero, "Paraty")
        carga.planilha(A89, numero, "Paraty", total_investido_estado=Decimal(investido), repasse_inicial=Decimal(repasse))

    valores = _rodar(carga, Q.contratual, Q.Filtro("89"))
    assert valores["execucao_pct"] == Decimal("87.50")
    assert valores["investido_estado"] == Decimal("350.00")
    assert valores["repasse_estado"] == Decimal("400.00")


def test_percentual_nulo_com_repasse_zero(carga):
    carga.planilha(A342, "A", "Paraty")
    carga.planilha(A89, "A", "Paraty", total_investido_estado=Decimal("10"), repasse_inicial=Decimal("0"))

    assert _rodar(carga, Q.contratual, Q.Filtro("89"))["execucao_pct"] is None
    [linha] = _rodar(carga, Q.lista_convenios, Q.Filtro("89"), 2026, 10).itens
    assert linha["execucao_pct"] is None


def test_situacao_com_grupo_nulo(carga):
    for numero, status in (("A", "Concluído"), ("B", "Concluído"), ("C", "Concluído"), ("D", "Vigente"), ("E", None)):
        carga.planilha(A342, numero, "Paraty", status_convenio=status)

    situacao = _rodar(carga, Q.situacao, Q.Filtro("342"))
    assert situacao["status"] == [
        {"valor": "Concluído", "convenios": 3},
        {"valor": "Vigente", "convenios": 1},
        {"valor": None, "convenios": 1},
    ]
    assert situacao["situacao_vigencia"] == [{"valor": None, "convenios": 5}]


# --- série, lista e datas ---


def test_serie_cronologica_com_meses_sem_codigo_do_recorte(carga):
    carga.planilha(A342, "1/2020", "Paraty", "900001")
    carga.siafe(2026, 1, "900001", a_pagar="3")
    carga.siafe(2025, 12, "999999", a_pagar="8")  # mês carregado sem conta do recorte

    pontos = _rodar(carga, Q.serie, Q.Filtro("342"))
    assert [(p["ano"], p["mes"], p["a_pagar"]) for p in pontos] == [(2025, 12, None), (2026, 1, Decimal("3.00"))]


def test_serie_vazia(carga):
    assert _rodar(carga, Q.serie, Q.Filtro("31")) == []


def test_lista_com_convenio_sem_codigo(carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(A342, "2/2020", "Paraty", "900001")
    carga.siafe(2026, 10, "900001", a_pagar="4")

    linhas = _rodar(carga, Q.lista_convenios, Q.Filtro("342"), 2026, 10).itens
    assert [(l["numero_convenio"], l["a_pagar"], l["valor_total"]) for l in linhas] == [
        ("1/2020", None, None),
        ("2/2020", Decimal("4.00"), None),
    ]


def test_datas_das_cargas_ignoram_falhas(db):
    ok, depois = datetime(2026, 11, 1, 8, tzinfo=UTC), datetime(2026, 11, 2, 8, tzinfo=UTC)
    with db.begin() as conn:
        conn.execute(insert(EtlExecucao).values(origem="cli", status="sucesso", fim=ok))
        conn.execute(insert(EtlExecucao).values(origem="http", status="falha", fim=depois))
        conn.execute(insert(PlanilhaImportacao).values(status="sucesso", arquivo="boa.xlsx", sha256="0" * 64, fim=ok))
        conn.execute(insert(PlanilhaImportacao).values(status="falha", arquivo="ruim.xlsx", sha256="1" * 64, fim=depois))
    with db.connect() as conn:
        datas = Q.datas_cargas(conn)
    assert datas == Q.DatasCargas(ok, ok, "boa.xlsx")


def test_datas_nulas_sem_cargas_com_sucesso(db):
    with db.connect() as conn:
        datas = Q.datas_cargas(conn)
    assert datas == Q.DatasCargas(None, None, None)


# --- paginação e ordenação ---


def _carteira_paginavel(carga: Carga) -> None:
    """5 convênios no 342: a_pagar 30, 10, 10, nulo (sem código) e 20.

    Os dois de a_pagar 10 empatam, em municípios diferentes, para testar o desempate.
    """
    for numero, municipio, codigo, valor in (
        ("1/2020", "Resende", "900001", "30"),
        ("2/2020", "Paraty", "900002", "10"),
        ("3/2020", "Niterói", "900003", "10"),
        ("4/2020", "Paraty", None, None),
        ("5/2020", "Angra dos Reis", "900005", "20"),
    ):
        carga.planilha(A342, numero, municipio, *([codigo] if codigo else []))
        if codigo:
            carga.siafe(2026, 10, codigo, a_pagar=valor)


def _lista(carga: Carga, **pagina) -> Q.Paginado:
    return _rodar(carga, Q.lista_convenios, Q.Filtro("342"), 2026, 10, Q.Pagina(**pagina))


def test_ordem_padrao_por_municipio_e_numero(carga):
    _carteira_paginavel(carga)

    pagina = _lista(carga)
    assert [(l["municipio"], l["numero_convenio"]) for l in pagina.itens] == [
        ("Angra dos Reis", "5/2020"),
        ("Niterói", "3/2020"),
        ("Paraty", "2/2020"),
        ("Paraty", "4/2020"),
        ("Resende", "1/2020"),
    ]
    assert pagina.total == 5


def test_ordem_decrescente_com_nulos_por_ultimo_e_desempate(carga):
    _carteira_paginavel(carga)

    pagina = _lista(carga, ordem="-a_pagar")
    assert [(l["numero_convenio"], l["a_pagar"]) for l in pagina.itens] == [
        ("1/2020", Decimal("30.00")),
        ("5/2020", Decimal("20.00")),
        ("3/2020", Decimal("10.00")),  # Niterói antes de Paraty no empate
        ("2/2020", Decimal("10.00")),
        ("4/2020", None),
    ]


def test_ordem_crescente_com_nulos_por_ultimo(carga):
    _carteira_paginavel(carga)

    pagina = _lista(carga, ordem="a_pagar")
    assert [l["numero_convenio"] for l in pagina.itens] == ["3/2020", "2/2020", "5/2020", "1/2020", "4/2020"]


def test_ultima_pagina_parcial(carga):
    _carteira_paginavel(carga)

    paginas = [_lista(carga, pagina=n, tamanho=2, ordem="-a_pagar") for n in (1, 2, 3)]
    assert [len(p.itens) for p in paginas] == [2, 2, 1]
    assert {p.total for p in paginas} == {5}
    assert [l["numero_convenio"] for p in paginas for l in p.itens] == [
        l["numero_convenio"] for l in _lista(carga, ordem="-a_pagar").itens
    ]


def test_pagina_alem_do_fim_mantem_total(carga):
    _carteira_paginavel(carga)

    pagina = _lista(carga, pagina=4, tamanho=2)
    assert (pagina.itens, pagina.total) == ([], 5)


def test_pagina_de_conjunto_vazio(carga):
    assert _lista(carga) == Q.Paginado(itens=[], total=0)


def test_ranking_paginado_e_ordenado(carga):
    _carteira_paginavel(carga)

    filtro = Q.Filtro("342")
    pagina = _rodar(carga, Q.ranking_municipios, filtro, 2026, 10, Q.Pagina(tamanho=2, ordem="-convenios"))
    assert [(l["municipio"], l["convenios"]) for l in pagina.itens] == [("Paraty", 2), ("Angra dos Reis", 1)]
    assert pagina.total == 4
    assert "_total" not in pagina.itens[0]


def test_ordem_fora_da_whitelist():
    assert Q.campo_de_ordem("-a_pagar", Q.ORDEM_LISTA) == ("a_pagar", True)
    assert Q.campo_de_ordem(None, Q.ORDEM_LISTA) == ("", False)
    assert Q.campo_de_ordem("numero_convenio", Q.ORDEM_RANKING) is None
    assert Q.campo_de_ordem("senha", Q.ORDEM_LISTA) is None
    assert Q.campo_de_ordem("a_pagar; DROP TABLE x", Q.ORDEM_LISTA) is None


def test_ordem_invalida_nunca_chega_ao_sql(carga):
    with pytest.raises(ValueError):
        _lista(carga, ordem="senha")
