"""Endpoints /painel. Integração com o Postgres de TEST_DATABASE_URL (ver conftest).

Um teste por cenário da spec painel-gerencial. Todos os números, códigos e valores são fictícios.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import insert, text

from app.main import app
from app.models import TABELAS_PLANILHA, EtlExecucao, PlanilhaImportacao
from app.routers.etl import get_engine
from app.routers.painel import get_hoje
from tests.test_cruzamento import A31, A89, A342, Carga

HOJE = date(2026, 11, 4)


@pytest.fixture
def carga(db) -> Carga:
    return Carga(db)


@pytest.fixture
def api(db):
    app.dependency_overrides[get_engine] = lambda: db
    app.dependency_overrides[get_hoje] = lambda: HOJE
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def _carteira(carga: Carga) -> None:
    """2 vigentes, 3 realinhados e 5 históricos; os vigentes em Paraty e Resende."""
    vigentes = [("V1", "Paraty", "900001"), ("V2", "Resende", "900002")]
    realinhados = [(f"R{i}", "Paraty", None) for i in range(3)]
    historicos = [(f"H{i}", "Niterói", None) for i in range(5)]
    for numero, municipio, codigo in vigentes + realinhados + historicos:
        carga.planilha(A342, numero, municipio, codigo)
    for numero, municipio, _ in vigentes + realinhados:
        carga.planilha(A89, numero, municipio, valor_a_repassar=Decimal("400"))
    for numero, municipio, _ in vigentes:
        carga.planilha(
            A31, numero, municipio,
            valor_total_inicial=Decimal("500"), repasse_inicial=Decimal("400"), contrapartida_inicial=Decimal("100"),
            total_investido=Decimal("200"), valor_a_repassar=Decimal("300"),
        )
    carga.siafe(2026, 11, "900001", a_pagar="80")
    carga.siafe(2026, 11, "999999", a_pagar="20")  # conta sem convênio
    carga.siafe(2026, 10, "900001", a_pagar="70")


# --- recorte ---


def test_recortes_aninhados(api, carga):
    _carteira(carga)
    contagens = {r: api.get("/painel/resumo", params={"recorte": r}).json()["convenios"] for r in ("31", "89", "342")}
    assert contagens == {"31": 2, "89": 5, "342": 10}


def test_recorte_padrao_e_31(api, carga):
    _carteira(carga)
    corpo = api.get("/painel/resumo").json()
    assert (corpo["recorte"], corpo["convenios"]) == ("31", 2)


def test_linha_da_aba_sem_convenio_na_342(api, carga):
    carga.planilha(A31, "9/2020", "Paraty")
    assert api.get("/painel/resumo", params={"recorte": "31"}).json()["convenios"] == 0


def test_recorte_invalido(api):
    assert api.get("/painel/resumo", params={"recorte": "100"}).status_code == 422


# --- municípios ---


def test_varios_municipios(api, carga):
    _carteira(carga)
    corpo = api.get("/painel/resumo", params={"recorte": "342", "municipio": ["Paraty", "Resende"]}).json()
    assert corpo["convenios"] == 5
    assert corpo["municipios"] == ["Paraty", "Resende"]


def test_municipio_sem_acento(api, carga):
    _carteira(carga)
    corpo = api.get("/painel/resumo", params={"recorte": "342", "municipio": "niteroi"}).json()
    assert (corpo["municipios"], corpo["convenios"]) == (["Niterói"], 5)


def test_municipio_inexistente(api):
    resposta = api.get("/painel/resumo", params={"municipio": ["Paraty", "Atlantida"]})
    assert resposta.status_code == 422
    assert resposta.json()["detail"]["municipios_invalidos"] == ["Atlantida"]


def test_municipio_invalido_nos_outros_endpoints(api):
    for rota in ("/painel/serie", "/painel/municipios", "/painel/convenios"):
        assert api.get(rota, params={"municipio": "Atlantida"}).status_code == 422


def test_municipio_sem_convenio_no_recorte(api, carga):
    _carteira(carga)
    resposta = api.get("/painel/resumo", params={"recorte": "31", "municipio": "Niterói"})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["convenios"] == 0
    assert corpo["siafe"]["a_pagar"] is None
    assert set(corpo["contratual"].values()) == {None}


# --- mês de referência e datas ---


def test_mes_padrao_e_o_corrente(api, carga):
    _carteira(carga)
    referencia = api.get("/painel/resumo").json()["referencia"]
    assert (referencia["ano"], referencia["mes"]) == (2026, 11)


def test_so_um_dos_parametros_de_mes(api):
    for rota in ("/painel/resumo", "/painel/municipios", "/painel/convenios"):
        assert api.get(rota, params={"ano": 2026}).status_code == 422
        assert api.get(rota, params={"mes": 3}).status_code == 422


def test_mes_sem_dados_no_siafe(api, carga):
    carga.planilha(A342, "1/2020", "Paraty", "900001")
    carga.siafe(2026, 10, "900001", a_pagar="5")
    corpo = api.get("/painel/resumo", params={"recorte": "342"}).json()
    assert corpo["siafe"] is None
    assert corpo["referencia"]["ultimo_mes_disponivel"] == {"ano": 2026, "mes": 10}
    assert (corpo["referencia"]["ano"], corpo["referencia"]["mes"]) == (2026, 11)


def test_mes_explicito(api, carga):
    _carteira(carga)
    corpo = api.get("/painel/resumo", params={"ano": 2026, "mes": 10}).json()
    assert corpo["siafe"]["a_pagar"] == 70
    assert corpo["siafe"]["mes_anterior"] is None  # 2026-09 sem dados


def test_ultima_carga_siafe_falhou(api, db):
    ok, depois = datetime(2026, 11, 1, 8, tzinfo=UTC), datetime(2026, 11, 3, 8, tzinfo=UTC)
    with db.begin() as conn:
        conn.execute(insert(EtlExecucao).values(origem="cli", status="sucesso", fim=ok))
        conn.execute(insert(EtlExecucao).values(origem="http", status="falha", fim=depois))
    referencia = api.get("/painel/resumo").json()["referencia"]
    assert datetime.fromisoformat(referencia["posicao_siafe_em"]) == ok


def test_planilha_nunca_importada(api, db):
    with db.begin() as conn:
        conn.execute(insert(PlanilhaImportacao).values(status="falha", arquivo="ruim.xlsx", sha256="1" * 64))
    referencia = api.get("/painel/resumo").json()["referencia"]
    assert (referencia["planilha_importada_em"], referencia["arquivo"]) == (None, None)


# --- saldos, mês anterior e cobertura ---


def test_codigo_compartilhado_conta_uma_vez(api, carga):
    carga.planilha(A342, "A", "Paraty", "900001")
    carga.planilha(A342, "B", "Paraty", "900001")
    carga.siafe(2026, 11, "900001", a_pagar="100")
    assert api.get("/painel/resumo", params={"recorte": "342"}).json()["siafe"]["a_pagar"] == 100


def test_conta_sem_convenio_fora_dos_saldos(api, carga):
    _carteira(carga)
    assert api.get("/painel/resumo", params={"recorte": "342"}).json()["siafe"]["a_pagar"] == 80


def test_mes_anterior(api, carga):
    _carteira(carga)
    assert api.get("/painel/resumo").json()["siafe"]["mes_anterior"]["a_pagar"] == 70


def test_mes_anterior_na_virada_de_ano(api, carga):
    carga.planilha(A342, "1/2020", "Paraty", "900001")
    carga.siafe(2025, 12, "900001", a_pagar="9")
    carga.siafe(2026, 1, "900001", a_pagar="1")
    siafe = api.get("/painel/resumo", params={"recorte": "342", "ano": 2026, "mes": 1}).json()["siafe"]
    assert siafe["mes_anterior"]["a_pagar"] == 9


def test_primeiro_mes_carregado_sem_mes_anterior(api, carga):
    carga.planilha(A342, "1/2020", "Paraty", "900001")
    carga.siafe(2023, 1, "900001", a_pagar="1")
    siafe = api.get("/painel/resumo", params={"recorte": "342", "ano": 2023, "mes": 1}).json()["siafe"]
    assert siafe["mes_anterior"] is None


def test_cobertura_com_conta_sem_convenio(api, carga):
    _carteira(carga)
    cobertura = api.get("/painel/resumo", params={"recorte": "342"}).json()["siafe"]["cobertura"]
    assert (cobertura["vinculado"]["a_pagar"], cobertura["total_siafe"]["a_pagar"]) == (80, 100)


def test_cobertura_nula_com_filtro(api, carga):
    _carteira(carga)
    siafe = api.get("/painel/resumo", params={"recorte": "342", "municipio": "Paraty"}).json()["siafe"]
    assert siafe["cobertura"] is None
    assert siafe["a_pagar"] == 80


# --- contratuais e situação ---


def test_valores_contratuais_do_31(api, carga):
    _carteira(carga)
    contratual = api.get("/painel/resumo", params={"recorte": "31"}).json()["contratual"]
    assert contratual == {
        "valor_total": 1000,
        "repasse_estado": 800,
        "contrapartida": 200,
        "investido_estado": 400,
        "a_repassar": 600,
        "execucao_pct": 50,
    }


def test_cada_recorte_le_a_sua_aba(api, carga):
    _carteira(carga)
    filtro = {"municipio": "Resende"}
    assert api.get("/painel/resumo", params={"recorte": "31", **filtro}).json()["contratual"]["a_repassar"] == 300
    assert api.get("/painel/resumo", params={"recorte": "89", **filtro}).json()["contratual"]["a_repassar"] == 400


def test_convenio_realinhado(api, carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(A89, "1/2020", "Paraty", valor_total_inicial=Decimal("1000"), valor_total_realinhado=Decimal("1200"))
    assert api.get("/painel/resumo", params={"recorte": "89"}).json()["contratual"]["valor_total"] == 1200


def test_repasse_em_linha_de_continuacao(api, carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(A89, "1/2020", "Paraty", total_investido_estado=Decimal("100"))
    carga.planilha(A89, "1/2020", "Paraty", principal=False, total_investido_estado=Decimal("50"))
    assert api.get("/painel/resumo", params={"recorte": "89"}).json()["contratual"]["investido_estado"] == 150


def test_percentual_quociente_de_somas(api, carga):
    for numero, investido, repasse in (("A", "50", "100"), ("B", "300", "300")):
        carga.planilha(A342, numero, "Paraty")
        carga.planilha(A89, numero, "Paraty", total_investido_estado=Decimal(investido), repasse_inicial=Decimal(repasse))
    assert api.get("/painel/resumo", params={"recorte": "89"}).json()["contratual"]["execucao_pct"] == 87.5


def test_recorte_342_sem_contratual_e_com_situacao(api, carga):
    _carteira(carga)
    corpo = api.get("/painel/resumo", params={"recorte": "342"}).json()
    assert corpo["contratual"] is None
    assert corpo["situacao"]["status"] == [{"valor": None, "convenios": 10}]


def test_situacao_nula_fora_do_342(api, carga):
    _carteira(carga)
    for recorte in ("31", "89"):
        assert api.get("/painel/resumo", params={"recorte": recorte}).json()["situacao"] is None


# --- série, ranking e lista ---


def test_serie(api, carga):
    _carteira(carga)
    pontos = api.get("/painel/serie", params={"recorte": "342"}).json()["pontos"]
    assert [(p["ano"], p["mes"], p["a_pagar"]) for p in pontos] == [(2026, 10, 70), (2026, 11, 80)]


def test_serie_vazia(api):
    assert api.get("/painel/serie").json()["pontos"] == []


def test_ranking_sem_filtro(api, carga):
    _carteira(carga)
    corpo = api.get("/painel/municipios", params={"recorte": "342"}).json()
    assert [(i["municipio"], i["convenios"]) for i in corpo["itens"]] == [("Niterói", 5), ("Paraty", 4), ("Resende", 1)]
    assert all(i["valor_total"] is None for i in corpo["itens"])


def test_ranking_com_codigo_compartilhado(api, carga):
    carga.planilha(A342, "A", "Paraty", "900001")
    carga.planilha(A342, "B", "Resende", "900001")
    carga.siafe(2026, 11, "900001", a_pagar="10")
    itens = api.get("/painel/municipios", params={"recorte": "342"}).json()["itens"]
    assert [(i["municipio"], i["a_pagar"], i["codigo_compartilhado"]) for i in itens] == [
        ("Paraty", 10, True),
        ("Resende", 10, True),
    ]


def test_lista_filtrada(api, carga):
    _carteira(carga)
    itens = api.get("/painel/convenios", params={"recorte": "89", "municipio": "Paraty"}).json()["itens"]
    assert [i["numero_convenio"] for i in itens] == ["R0", "R1", "R2", "V1"]
    assert {i["fase"] for i in itens} == {"realinhado", "vigente"}


def test_lista_com_convenio_sem_codigo(api, carga):
    _carteira(carga)
    itens = api.get("/painel/convenios", params={"recorte": "342", "municipio": "Niterói"}).json()["itens"]
    assert len(itens) == 5
    assert all(i["a_pagar"] is None and i["codigo_seobras"] is None for i in itens)


# --- só leitura ---


def test_reimportacao_refletida(api, carga, db):
    _carteira(carga)
    assert api.get("/painel/resumo", params={"recorte": "342"}).json()["convenios"] == 10
    with db.begin() as conn:
        conn.execute(text(f"DELETE FROM {TABELAS_PLANILHA[A342].name} WHERE numero_convenio LIKE 'H%'"))
    assert api.get("/painel/resumo", params={"recorte": "342"}).json()["convenios"] == 5


def test_endpoints_so_aceitam_get(api):
    for rota in ("/painel/resumo", "/painel/serie", "/painel/municipios", "/painel/convenios"):
        assert api.post(rota).status_code == 405
