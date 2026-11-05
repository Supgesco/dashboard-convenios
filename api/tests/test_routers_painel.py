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
from app.planilha.dominios import MUNICIPIOS_RJ
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
        "investido_sobre_total_pct": 40,
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


def test_investido_sobre_total_no_ranking_e_na_lista(api, carga):
    _carteira(carga)
    ranking = api.get("/painel/municipios", params={"recorte": "31"}).json()["itens"]
    assert [(i["municipio"], i["investido_sobre_total_pct"]) for i in ranking] == [("Paraty", 40), ("Resende", 40)]
    lista = api.get("/painel/convenios", params={"recorte": "31", "ordem": "-investido_sobre_total_pct"}).json()
    assert [i["investido_sobre_total_pct"] for i in lista["itens"]] == [40, 40]


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
    assert (corpo["pagina"], corpo["tamanho"], corpo["total"]) == (1, 20, 3)
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
    corpo = api.get("/painel/convenios", params={"recorte": "89", "municipio": "Paraty"}).json()
    itens = corpo["itens"]
    assert [i["numero_convenio"] for i in itens] == ["R0", "R1", "R2", "V1"]
    assert (corpo["pagina"], corpo["tamanho"], corpo["total"]) == (1, 20, 4)
    assert {i["fase"] for i in itens} == {"realinhado", "vigente"}


def test_lista_com_convenio_sem_codigo(api, carga):
    _carteira(carga)
    corpo = api.get("/painel/convenios", params={"recorte": "342", "municipio": "Niterói"}).json()
    itens = corpo["itens"]
    assert len(itens) == corpo["total"] == 5
    assert all(i["a_pagar"] is None and i["codigo_seobras"] is None for i in itens)


# --- paginação ---


def _83_municipios(carga: Carga) -> None:
    """Um convênio do 342 em cada um de 83 municípios."""
    for i, municipio in enumerate(MUNICIPIOS_RJ[:83]):
        carga.planilha(A342, f"{i}/2020", municipio)


def test_tamanho_padrao(api, carga):
    _83_municipios(carga)
    corpo = api.get("/painel/municipios", params={"recorte": "342"}).json()
    assert (len(corpo["itens"]), corpo["pagina"], corpo["tamanho"], corpo["total"]) == (20, 1, 20, 83)


def test_ultima_pagina(api, carga):
    _83_municipios(carga)
    corpo = api.get("/painel/municipios", params={"recorte": "342", "pagina": 2, "tamanho": 50}).json()
    assert (len(corpo["itens"]), corpo["total"]) == (33, 83)


def test_pagina_alem_do_fim(api, carga):
    _83_municipios(carga)
    for rota in ("/painel/municipios", "/painel/convenios"):
        corpo = api.get(rota, params={"recorte": "342", "pagina": 5, "tamanho": 50}).json()
        assert (corpo["itens"], corpo["pagina"], corpo["total"]) == ([], 5, 83)


def test_limites_invalidos(api):
    for rota in ("/painel/municipios", "/painel/convenios"):
        for params in ({"tamanho": 0}, {"tamanho": 101}, {"pagina": 0}):
            assert api.get(rota, params=params).status_code == 422, (rota, params)
        assert api.get(rota, params={"tamanho": 100}).status_code == 200


def test_paginas_concatenadas_iguais_a_lista_inteira(api, carga):
    _83_municipios(carga)
    paginas = [
        api.get("/painel/convenios", params={"recorte": "342", "pagina": n, "tamanho": 30}).json()["itens"]
        for n in (1, 2, 3)
    ]
    inteira = api.get("/painel/convenios", params={"recorte": "342", "tamanho": 100}).json()["itens"]
    assert [i["numero_convenio"] for p in paginas for i in p] == [i["numero_convenio"] for i in inteira]
    assert len(inteira) == 83


def test_serie_sem_paginacao(api, carga):
    carga.planilha(A342, "1/2020", "Paraty", "900001")
    meses = [(ano, mes) for ano in range(2023, 2027) for mes in range(1, 13) if (ano, mes) <= (2026, 11)]
    for ano, mes in meses:
        carga.siafe(ano, mes, "900001", a_pagar="1")
    corpo = api.get("/painel/serie", params={"recorte": "342", "tamanho": 10, "pagina": 2}).json()
    assert len(corpo["pontos"]) == len(meses) == 47
    assert "total" not in corpo


# --- ordenação ---


def _saldos_por_municipio(carga: Carga) -> None:
    """12 municípios com a_pagar 10, 20, ..., 120 e 2 sem código (a_pagar nulo)."""
    for i, municipio in enumerate(MUNICIPIOS_RJ[:14]):
        codigo = f"9{i:05d}" if i < 12 else None
        carga.planilha(A342, f"{i}/2020", municipio, codigo)
        if codigo:
            carga.siafe(2026, 11, codigo, a_pagar=str(10 * (i + 1)))


def test_ranking_pelo_maior_saldo_a_pagar(api, carga):
    _saldos_por_municipio(carga)
    itens = api.get("/painel/municipios", params={"recorte": "342", "ordem": "-a_pagar", "tamanho": 10}).json()["itens"]
    assert [i["a_pagar"] for i in itens] == [120, 110, 100, 90, 80, 70, 60, 50, 40, 30]
    ultima = api.get(
        "/painel/municipios", params={"recorte": "342", "ordem": "-a_pagar", "tamanho": 10, "pagina": 2}
    ).json()["itens"]
    assert [i["a_pagar"] for i in ultima] == [20, 10, None, None]


def test_ordem_crescente_com_nulos_por_ultimo(api, carga):
    for numero, municipio, valor in (("A", "Paraty", "300"), ("B", "Resende", None), ("C", "Niterói", "100")):
        carga.planilha(A342, numero, municipio)
        carga.planilha(A89, numero, municipio)
        extra = {"valor_total_inicial": Decimal(valor)} if valor else {}
        carga.planilha(A31, numero, municipio, **extra)
    itens = api.get("/painel/convenios", params={"recorte": "31", "ordem": "valor_total"}).json()["itens"]
    assert [(i["numero_convenio"], i["valor_total"]) for i in itens] == [("C", 100), ("A", 300), ("B", None)]


def test_paginas_estaveis(api, carga):
    for numero, municipio, codigo in (("2/2020", "Paraty", "900001"), ("1/2020", "Paraty", "900002"),
                                      ("3/2020", "Angra dos Reis", "900003")):
        carga.planilha(A342, numero, municipio, codigo)
        carga.siafe(2026, 11, codigo, a_pagar="50")
    esperado = ["3/2020", "1/2020", "2/2020"]  # empate: município, depois número
    for _ in range(2):
        paginas = [
            api.get(
                "/painel/convenios", params={"recorte": "342", "ordem": "-a_pagar", "tamanho": 1, "pagina": n}
            ).json()["itens"]
            for n in (1, 2, 3)
        ]
        assert [i["numero_convenio"] for p in paginas for i in p] == esperado


def test_campo_de_ordem_invalido(api):
    for rota in ("/painel/municipios", "/painel/convenios"):
        resposta = api.get(rota, params={"ordem": "senha"})
        assert resposta.status_code == 422
        assert resposta.json()["detail"]["ordem"] == "senha"
    # campo da lista não vale no ranking
    assert api.get("/painel/municipios", params={"ordem": "numero_convenio"}).status_code == 422
    assert api.get("/painel/convenios", params={"ordem": "-numero_convenio"}).status_code == 200


# --- detalhe do convênio ---


def _detalhe(carga: Carga) -> None:
    """`143/2014`–Paraty realinhado (89 e 342) com SEOBRAS 900001, compartilhado com `002/2021`–Resende.

    `010/2020` existe em Paraty e em Resende. `005/2019`–Niterói está na 31, na 89 e na 342.
    """
    carga.planilha(
        A342, "143/2014", "Paraty", "900001", "900001",
        status_convenio="Em execução", situacao_vigencia="Vigente",
        vigencia_final=date(2026, 12, 31), objeto="Obra sintética",
    )
    carga.planilha(A89, "143/2014", "Paraty", valor_total_inicial=Decimal("120"),
                   repasse_inicial=Decimal("100"), total_investido_estado=Decimal("50"))
    carga.planilha(A342, "002/2021", "Resende", "900001")
    carga.planilha(A342, "010/2020", "Paraty", "900010")
    carga.planilha(A342, "010/2020", "Resende", "900011")
    carga.planilha(A342, "005/2019", "Niterói")
    carga.planilha(A89, "005/2019", "Niterói", valor_total_inicial=Decimal("120"))
    carga.planilha(A31, "005/2019", "Niterói", valor_total_inicial=Decimal("100"))
    carga.siafe(2026, 9, "900010", a_pagar="1")
    carga.siafe(2026, 10, "900001", a_pagar="70")
    carga.siafe(2026, 11, "900001", a_pagar="80", aprovados="5")


def _get_detalhe(api, numero="143/2014", municipio="Paraty", **params):
    return api.get("/painel/convenio", params={"numero": numero, "municipio": municipio, **params})


def test_detalhe_convenio_encontrado(api, carga):
    _detalhe(carga)

    r = _get_detalhe(api)
    assert r.status_code == 200
    corpo = r.json()
    assert {k: corpo[k] for k in (
        "numero_convenio", "municipio", "fase", "status", "situacao_vigencia",
        "vigencia_final", "objeto", "recortes", "codigo_seobras", "codigo_seiop",
    )} == {
        "numero_convenio": "143/2014",
        "municipio": "Paraty",
        "fase": "realinhado",
        "status": "Em execução",
        "situacao_vigencia": "Vigente",
        "vigencia_final": "2026-12-31",
        "objeto": "Obra sintética",
        "recortes": ["89", "342"],
        "codigo_seobras": "900001",
        "codigo_seiop": "900001",
    }
    assert corpo["referencia"] == {"ano": 2026, "mes": 11}


def test_detalhe_grafias_aceitas(api, carga):
    _detalhe(carga)

    corpo = _get_detalhe(api, numero="143/14", municipio="paraty").json()
    assert (corpo["numero_convenio"], corpo["municipio"]) == ("143/2014", "Paraty")


def test_detalhe_mesmo_numero_em_outro_municipio(api, carga):
    _detalhe(carga)

    corpo = _get_detalhe(api, numero="010/2020", municipio="Resende").json()
    assert (corpo["municipio"], corpo["codigo_seobras"]) == ("Resende", "900011")


def test_detalhe_convenio_inexistente(api, carga):
    _detalhe(carga)

    assert _get_detalhe(api, numero="143/2014", municipio="Resende").status_code == 404


def test_detalhe_entrada_invalida(api):
    r = _get_detalhe(api, numero="abc")
    assert r.status_code == 422
    assert r.json()["detail"]["numero"] == "abc"
    r = _get_detalhe(api, municipio="Atlantida")
    assert r.status_code == 422
    assert r.json()["detail"]["municipios_invalidos"] == ["Atlantida"]
    assert api.get("/painel/convenio", params={"numero": "143/2014"}).status_code == 422
    assert api.get("/painel/convenio", params={"municipio": "Paraty"}).status_code == 422
    assert _get_detalhe(api, numero="").status_code == 422
    assert _get_detalhe(api, municipio="").status_code == 422


def test_detalhe_codigo_compartilhado(api, carga):
    _detalhe(carga)

    corpo = _get_detalhe(api).json()
    assert corpo["codigo_compartilhado"] is True
    assert corpo["compartilhado_com"] == [
        {"numero_convenio": "002/2021", "municipio": "Resende", "codigo": "900001"}
    ]
    sem = _get_detalhe(api, numero="010/2020", municipio="Paraty").json()
    assert (sem["codigo_compartilhado"], sem["compartilhado_com"]) == (False, [])


def test_detalhe_saldos_do_mes_e_do_anterior(api, carga):
    _detalhe(carga)

    corpo = _get_detalhe(api).json()
    # o mesmo código como SEOBRAS e SEIOP conta uma vez
    assert corpo["saldos"] == {"a_pagar": 80.0, "a_comprovar": 0.0, "a_aprovar": 0.0, "aprovados": 5.0}
    assert corpo["mes_anterior"]["a_pagar"] == 70.0


def test_detalhe_mes_sem_dados(api, carga):
    _detalhe(carga)

    corpo = _get_detalhe(api, ano=2026, mes=12).json()
    assert corpo["saldos"] is None
    assert corpo["mes_anterior"]["a_pagar"] == 80.0
    assert _get_detalhe(api, ano=2026).status_code == 422


def test_detalhe_contratual_nas_duas_abas(api, carga):
    _detalhe(carga)

    corpo = _get_detalhe(api, numero="005/2019", municipio="Niterói").json()
    assert [(b["recorte"], b["valor_total"]) for b in corpo["contratual"]] == [("31", 100.0), ("89", 120.0)]
    assert corpo["recortes"] == ["31", "89", "342"]
    realinhado = _get_detalhe(api).json()["contratual"]
    assert realinhado == [{
        "recorte": "89", "valor_total": 120.0, "repasse_estado": 100.0, "contrapartida": None,
        "investido_estado": 50.0, "a_repassar": None, "execucao_pct": 50.0,
        "investido_sobre_total_pct": 41.67,
    }]


def test_detalhe_convenio_so_na_342(api, carga):
    _detalhe(carga)

    corpo = _get_detalhe(api, numero="002/2021", municipio="Resende").json()
    assert (corpo["fase"], corpo["contratual"]) == ("historico", [])


def test_detalhe_serie(api, carga):
    _detalhe(carga)

    serie = _get_detalhe(api).json()["serie"]
    assert [(p["ano"], p["mes"], p["a_pagar"]) for p in serie] == [
        (2026, 9, None), (2026, 10, 70.0), (2026, 11, 80.0),
    ]
    sem_codigo = _get_detalhe(api, numero="005/2019", municipio="Niterói").json()
    assert len(sem_codigo["serie"]) == 3
    assert {p["a_pagar"] for p in sem_codigo["serie"]} == {None}
    assert set(sem_codigo["saldos"].values()) == {None}


def test_detalhe_ignora_recorte_e_filtro(api, carga):
    _detalhe(carga)

    base = _get_detalhe(api).json()
    assert _get_detalhe(api, recorte="31").json() == base
    r = api.get("/painel/convenio", params=[
        ("numero", "143/2014"), ("municipio", "Resende"), ("municipio", "Paraty"),
    ])
    # `municipio` não é filtro repetível aqui: vale um valor só (o último), sem somar convênios
    assert r.status_code == 200
    assert r.json() == base


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
