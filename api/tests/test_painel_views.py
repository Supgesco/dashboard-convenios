"""Views do painel gerencial (migration 0004).

Testes de integração no Postgres de TEST_DATABASE_URL (ver conftest). Todos os números de
convênio, códigos e valores são fictícios.
"""

from decimal import Decimal

import pytest
from sqlalchemy import Engine

from tests.test_cruzamento import A31, A89, A342, Carga


@pytest.fixture
def carga(db: Engine) -> Carga:
    return Carga(db)


def _recortes(carga: Carga) -> dict[str, set[str]]:
    linhas = carga.consulta("SELECT recorte, numero_convenio FROM v_recorte_convenio")
    resultado: dict[str, set[str]] = {"31": set(), "89": set(), "342": set()}
    for linha in linhas:
        resultado[linha["recorte"]].add(linha["numero_convenio"])
    return resultado


def _contratual(carga: Carga, recorte: str, numero: str) -> dict:
    linhas = carga.consulta(
        "SELECT * FROM v_valor_contratual WHERE recorte = :r AND numero_convenio = :n", r=recorte, n=numero
    )
    assert len(linhas) == 1
    return linhas[0]


def test_recortes_aninhados(carga):
    for numero in ("V1", "V2", "R1", "H1"):
        carga.planilha(A342, numero, "Paraty")
    for numero in ("V1", "V2", "R1"):
        carga.planilha(A89, numero, "Paraty")
    for numero in ("V1", "V2"):
        carga.planilha(A31, numero, "Paraty")

    assert _recortes(carga) == {
        "31": {"V1", "V2"},
        "89": {"V1", "V2", "R1"},
        "342": {"V1", "V2", "R1", "H1"},
    }


def test_status_e_situacao_vem_da_linha_da_342(carga):
    carga.planilha(A342, "1/2020", "Paraty", status_convenio="Vigente", situacao_vigencia="Expirado")
    carga.planilha(A342, "1/2020", "Paraty", status_convenio="Concluído", situacao_vigencia="Vigente")  # repetida

    [linha] = carga.consulta("SELECT * FROM v_recorte_convenio WHERE recorte = '342'")
    assert linha["status"] == "Vigente"
    assert linha["situacao_vigencia"] == "Expirado"
    assert linha["fase"] == "historico"


def test_linha_da_31_sem_par_na_342_fica_fora(carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(A31, "9/2020", "Paraty", valor_total_inicial=Decimal("10"))

    assert _recortes(carga) == {"31": set(), "89": set(), "342": {"1/2020"}}
    assert carga.consulta("SELECT * FROM v_valor_contratual") == []


def test_realinhado_escolhido_por_convenio(carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(
        A89,
        "1/2020",
        "Paraty",
        valor_total_inicial=Decimal("1000"),
        repasse_inicial=Decimal("800"),
        contrapartida_inicial=Decimal("200"),
        valor_total_realinhado=Decimal("1200"),
        repasse_realinhado=Decimal("900"),
        contrapartida_realinhado=Decimal("300"),
    )
    # Continuação com só um valor inicial: não mistura os grupos.
    carga.planilha(A89, "1/2020", "Paraty", principal=False, repasse_inicial=Decimal("50"))

    linha = _contratual(carga, "89", "1/2020")
    assert linha["base"] == "realinhado"
    assert (linha["valor_total"], linha["repasse_estado"], linha["contrapartida"]) == (1200, 900, 300)


def test_inicial_quando_nao_ha_realinhado(carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(A89, "1/2020", "Paraty")
    carga.planilha(
        A31, "1/2020", "Paraty",
        valor_total_inicial=Decimal("500"), repasse_inicial=Decimal("400"), contrapartida_inicial=Decimal("100"),
    )

    linha = _contratual(carga, "31", "1/2020")
    assert linha["base"] == "inicial"
    assert (linha["valor_total"], linha["repasse_estado"], linha["contrapartida"]) == (500, 400, 100)


def test_base_segue_o_valor_e_nao_a_flag_da_342(carga):
    carga.planilha(A342, "1/2020", "Paraty", realinhado=False)
    carga.planilha(A89, "1/2020", "Paraty", valor_total_inicial=Decimal("1"), valor_total_realinhado=Decimal("2"))
    carga.planilha(A342, "2/2020", "Paraty", realinhado=True)
    carga.planilha(A89, "2/2020", "Paraty", valor_total_inicial=Decimal("3"))

    assert _contratual(carga, "89", "1/2020")["base"] == "realinhado"
    assert _contratual(carga, "89", "2/2020")["base"] == "inicial"


def test_linha_de_continuacao_somada(carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(
        A89, "1/2020", "Paraty",
        total_investido_estado=Decimal("100"), valor_a_repassar=Decimal("40"), valor_total_inicial=Decimal("500"),
    )
    carga.planilha(A89, "1/2020", "Paraty", principal=False, total_investido_estado=Decimal("50"))

    linha = _contratual(carga, "89", "1/2020")
    assert linha["investido_estado"] == 150
    assert linha["a_repassar"] == 40
    assert linha["valor_total"] == 500


def test_convenio_sem_valores_fica_nulo(carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(A89, "1/2020", "Paraty")
    carga.planilha(A89, "1/2020", "Paraty", principal=False)

    linha = _contratual(carga, "89", "1/2020")
    assert linha["base"] == "inicial"
    for coluna in ("valor_total", "repasse_estado", "contrapartida", "investido_estado", "a_repassar"):
        assert linha[coluna] is None


def test_coluna_de_investido_de_cada_aba(carga):
    carga.planilha(A342, "1/2020", "Paraty")
    carga.planilha(A89, "1/2020", "Paraty", total_investido_estado=Decimal("89"), valor_a_repassar=Decimal("400"))
    carga.planilha(A31, "1/2020", "Paraty", total_investido=Decimal("31"), valor_a_repassar=Decimal("300"))

    assert _contratual(carga, "31", "1/2020")["investido_estado"] == 31
    assert _contratual(carga, "31", "1/2020")["a_repassar"] == 300
    assert _contratual(carga, "89", "1/2020")["investido_estado"] == 89
    assert _contratual(carga, "89", "1/2020")["a_repassar"] == 400
    assert {r["recorte"] for r in carga.consulta("SELECT recorte FROM v_valor_contratual")} == {"31", "89"}
