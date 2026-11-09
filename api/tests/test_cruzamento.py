"""Views do cruzamento SIAFE x planilha (migration 0003).

Testes de integração no Postgres de TEST_DATABASE_URL (ver conftest). Todos os códigos,
números de convênio e combinações de município são fictícios.
"""

from decimal import Decimal
from itertools import count

import pytest
from sqlalchemy import Engine, insert, text

from app.models import TABELAS_PLANILHA, EtlExecucao, PlanilhaImportacao, SiafeFlexvision
from app.planilha import layout as L

A342 = L.CONVENIOS_GERAL.nome
A89 = L.CONVENIOS_TRANSFERIDOS.nome
A31 = L.CONVENIOS_VIGENTES.nome
PRESTACAO = L.PRESTACAO_CONTAS.nome
TOMADA = L.TOMADA_CONTAS.nome

A_PAGAR, A_COMPROVAR, A_APROVAR, APROVADOS = "812210101", "812210102", "812210103", "812210104"

VIEWS = [
    "v_cruzamento_linha",
    "v_cruzamento_codigo_origem",
    "v_convenio",
    "v_convenio_codigo",
    "v_convenio_registro",
    "v_convenio_saldo_codigo",
    "v_convenio_saldo",
    "v_cruzamento_falha",
]


class Carga:
    """Insere dados sintéticos mínimos nas tabelas lidas pelas views."""

    def __init__(self, engine: Engine):
        self.engine = engine
        self._linhas = count(100)
        with engine.begin() as conn:
            self.execucao_id = conn.execute(
                insert(EtlExecucao).values(origem="cli", status="sucesso").returning(EtlExecucao.id)
            ).scalar_one()
            self.importacao_id = conn.execute(
                insert(PlanilhaImportacao)
                .values(status="sucesso", arquivo="sintetica.xlsx", sha256="0" * 64)
                .returning(PlanilhaImportacao.id)
            ).scalar_one()

    def planilha(
        self,
        aba: str,
        numero: str | None,
        municipio: str | None,
        seobras: str | None = None,
        seiop: str | None = None,
        *,
        linha: int | None = None,
        principal: bool = True,
        **extra,
    ) -> int:
        tabela = TABELAS_PLANILHA[aba]
        valores = {
            "importacao_id": self.importacao_id,
            "linha": linha if linha is not None else next(self._linhas),
            "linha_principal": principal,
            "numero_convenio": numero,
            "municipio": municipio,
            "codigo_seobras": seobras,
            **extra,
        }
        if "codigo_seiop" in tabela.c:
            valores["codigo_seiop"] = seiop
        elif seiop is not None:
            raise ValueError(f"A aba {aba} não tem código SEIOP")
        if "bloco" in tabela.c:
            valores.setdefault("bloco", 1)
        if "colunas_corrigidas" in tabela.c:
            valores.setdefault("colunas_corrigidas", False)
        with self.engine.begin() as conn:
            conn.execute(insert(tabela).values(valores))
        return valores["linha"]

    def siafe(
        self,
        ano: int,
        mes: int,
        conta: str,
        contabil: str = A_PAGAR,
        a_pagar: str = "0",
        a_comprovar: str = "0",
        a_aprovar: str = "0",
        aprovados: str = "0",
    ) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                insert(SiafeFlexvision).values(
                    execucao_id=self.execucao_id,
                    ano=ano,
                    mes=mes,
                    ug="999999",
                    ug_nome="UG SINTETICA",
                    conta_corrente=conta,
                    conta_contabil=contabil,
                    conta_contabil_nome=f"CONTA {contabil}",
                    convenios_a_pagar=Decimal(a_pagar),
                    convenios_a_comprovar=Decimal(a_comprovar),
                    convenios_a_aprovar=Decimal(a_aprovar),
                    convenios_aprovados=Decimal(aprovados),
                )
            )

    def consulta(self, sql: str, **params) -> list[dict]:
        with self.engine.connect() as conn:
            return [dict(r) for r in conn.execute(text(sql), params).mappings()]

    def convenios(self) -> list[dict]:
        return self.consulta("SELECT * FROM v_convenio ORDER BY numero_convenio, municipio")

    def convenio(self, numero: str, municipio: str) -> dict:
        (c,) = self.consulta(
            "SELECT * FROM v_convenio WHERE numero_convenio = :n AND municipio = :m", n=numero, m=municipio
        )
        return c

    def falhas(self, motivo: str) -> list[dict]:
        return self.consulta(
            "SELECT * FROM v_cruzamento_falha WHERE motivo = :m ORDER BY codigo, numero_convenio, aba, linha",
            m=motivo,
        )


@pytest.fixture
def carga(db: Engine) -> Carga:
    return Carga(db)


def _saldos(linha: dict) -> tuple:
    return (
        linha["convenios_a_pagar"],
        linha["convenios_a_comprovar"],
        linha["convenios_a_aprovar"],
        linha["convenios_aprovados"],
    )


# --- base dos testes ---------------------------------------------------------


def test_fumaca_insere_e_le_de_volta_com_tabelas_limpas(carga):
    # O TRUNCATE do conftest roda antes de cada teste: nada de testes anteriores sobra.
    assert carga.consulta("SELECT count(*) AS n FROM siafe_flexvision") == [{"n": 0}]
    assert carga.consulta("SELECT count(*) AS n FROM planilha_convenios_geral") == [{"n": 0}]

    carga.planilha(A342, "001/2010", "Cidade A", "000001", linha=7)
    carga.planilha(TOMADA, "001/2010", "Cidade A", "000002", linha=8)
    carga.siafe(2026, 11, "000001", a_pagar="10.50")

    assert carga.consulta("SELECT linha, numero_convenio, codigo_seobras FROM planilha_convenios_geral") == [
        {"linha": 7, "numero_convenio": "001/2010", "codigo_seobras": "000001"}
    ]
    assert carga.consulta("SELECT bloco, codigo_seobras FROM planilha_tomada_contas") == [
        {"bloco": 1, "codigo_seobras": "000002"}
    ]
    assert carga.consulta("SELECT conta_corrente, convenios_a_pagar FROM siafe_flexvision") == [
        {"conta_corrente": "000001", "convenios_a_pagar": Decimal("10.50")}
    ]


# --- Convênio identificado pela aba 342 ---------------------------------------


def test_linha_comum_da_342(carga):
    carga.planilha(A342, "143/2014", "Paraty", status_convenio="Em execução")

    (c,) = carga.convenios()
    assert (c["numero_convenio"], c["municipio"], c["status"]) == ("143/2014", "Paraty", "Em execução")


def test_linha_sem_numero_do_convenio(carga):
    linha = carga.planilha(A342, None, "Paraty", "000010")

    assert carga.convenios() == []
    (falha,) = carga.falhas("chave_ausente_342")
    assert (falha["aba"], falha["linha"], falha["municipio"]) == (A342, linha, "Paraty")


def test_chave_repetida(carga):
    carga.planilha(A342, "143/2014", "Paraty", status_convenio="primeira", linha=10)
    carga.planilha(A342, "143/2014", "Paraty", status_convenio="segunda", linha=50)

    (c,) = carga.convenios()
    assert (c["linha"], c["status"]) == (10, "primeira")
    (falha,) = carga.falhas("chave_repetida_342")
    assert falha["linha"] == 50 and "linha 10" in falha["detalhe"]


# --- Fase do convênio ---------------------------------------------------------


def test_fase_vigente_quando_presente_nas_tres_abas(carga):
    for aba in (A342, A89, A31):
        carga.planilha(aba, "020/2020", "Cidade B")

    assert carga.convenio("020/2020", "Cidade B")["fase"] == "vigente"


def test_fase_realinhado_quando_saiu_no_ultimo_realinhamento(carga):
    for aba in (A342, A89):
        carga.planilha(aba, "020/2020", "Cidade B")

    assert carga.convenio("020/2020", "Cidade B")["fase"] == "realinhado"


def test_fase_historico_quando_so_na_342(carga):
    carga.planilha(A342, "020/2020", "Cidade B")
    # Mesmo número em outro município não conta.
    carga.planilha(A31, "020/2020", "Cidade C")

    assert carga.convenio("020/2020", "Cidade B")["fase"] == "historico"


# --- Precedência do código entre as abas do funil ----------------------------


def test_codigo_so_na_342(carga):
    carga.planilha(A342, "030/2015", "Cidade D", "007783")

    c = carga.convenio("030/2015", "Cidade D")
    assert (c["codigo_seobras"], c["aba_codigo_seobras"], c["codigo_seiop"]) == ("007783", A342, None)


def test_aba_mais_recente_prevalece(carga):
    carga.planilha(A342, "030/2015", "Cidade D", seiop="210040")
    carga.planilha(A89, "030/2015", "Cidade D", seiop="210044")

    c = carga.convenio("030/2015", "Cidade D")
    assert (c["codigo_seiop"], c["aba_codigo_seiop"]) == ("210044", A89)
    (falha,) = carga.falhas("codigo_divergente")
    assert (falha["codigo"], falha["tipo_codigo"], falha["aba"]) == ("210040", "SEIOP", A342)
    assert "210044" in falha["detalhe"]


def test_aba_recente_com_codigo_vazio(carga):
    carga.planilha(A342, "030/2015", "Cidade D")
    carga.planilha(A89, "030/2015", "Cidade D", "007695")
    carga.planilha(A31, "030/2015", "Cidade D", None)

    c = carga.convenio("030/2015", "Cidade D")
    assert (c["codigo_seobras"], c["aba_codigo_seobras"]) == ("007695", A89)
    assert carga.falhas("codigo_divergente") == []


def test_linha_de_continuacao_da_89_nao_diverge_nem_duplica(carga):
    carga.planilha(A342, "040/2016", "Cidade E", "007700")
    carga.planilha(A89, "040/2016", "Cidade E", "007700", "210100", linha=20)
    carga.planilha(A89, "040/2016", "Cidade E", "007700", "210100", linha=21, principal=False)

    (c,) = carga.convenios()
    assert (c["codigo_seobras"], c["codigo_seiop"], c["fase"]) == ("007700", "210100", "realinhado")
    assert carga.falhas("codigo_divergente") == []
    assert carga.falhas("linha_sem_convenio") == []


# --- Abas auxiliares como fonte complementar de código -----------------------


def test_codigo_recuperado_de_aba_auxiliar(carga):
    carga.planilha(A342, "050/2017", "Cidade F")
    carga.planilha(A89, "050/2017", "Cidade F")
    carga.planilha(TOMADA, "050/2017", "Cidade F", "005512")

    c = carga.convenio("050/2017", "Cidade F")
    assert (c["codigo_seobras"], c["aba_codigo_seobras"]) == ("005512", TOMADA)


def test_aba_auxiliar_divergente(carga):
    carga.planilha(A342, "050/2017", "Cidade F", "006100")
    linha = carga.planilha(PRESTACAO, "050/2017", "Cidade F", "006101")

    assert carga.convenio("050/2017", "Cidade F")["codigo_seobras"] == "006100"
    (falha,) = carga.falhas("codigo_divergente")
    assert (falha["codigo"], falha["aba"], falha["linha"], falha["tipo_codigo"]) == (
        "006101",
        PRESTACAO,
        linha,
        "SEOBRAS",
    )


# --- Registros mensais das contas do convênio --------------------------------


def _registros(carga: Carga, **filtro) -> list[dict]:
    where = " AND ".join(f"{k} = :{k}" for k in filtro) or "true"
    return carga.consulta(
        f"SELECT * FROM v_convenio_registro WHERE {where} ORDER BY ano, mes, conta_corrente, conta_contabil",
        **filtro,
    )


def test_registros_de_um_mes(carga):
    carga.planilha(A342, "060/2018", "Cidade G", seiop="210044")
    carga.siafe(2026, 11, "210044", A_PAGAR, a_pagar="100.00")
    carga.siafe(2026, 11, "210044", A_COMPROVAR, a_comprovar="40.00")

    registros = _registros(carga, ano=2026, mes=11)
    assert [(r["conta_contabil"], r["conta_contabil_nome"], _saldos(r)) for r in registros] == [
        (A_PAGAR, f"CONTA {A_PAGAR}", (Decimal("100.00"), 0, 0, 0)),
        (A_COMPROVAR, f"CONTA {A_COMPROVAR}", (0, Decimal("40.00"), 0, 0)),
    ]
    assert {(r["numero_convenio"], r["municipio"], r["conta_corrente"]) for r in registros} == {
        ("060/2018", "Cidade G", "210044")
    }
    assert all(r["tipos"] == ["SEIOP"] for r in registros)


def test_historico_mes_a_mes(carga):
    carga.planilha(A342, "060/2018", "Cidade G", "007010")
    meses = [(ano, mes) for ano in range(2023, 2027) for mes in range(1, 13) if (ano, mes) <= (2026, 11)]
    for ano, mes in meses:
        carga.siafe(ano, mes, "007010", A_COMPROVAR, a_comprovar=str(mes))

    registros = _registros(carga)
    assert [(r["ano"], r["mes"]) for r in registros] == meses
    (marco,) = _registros(carga, ano=2025, mes=3)
    assert marco["convenios_a_comprovar"] == Decimal("3")


def test_linha_com_saldo_zero_mantida(carga):
    carga.planilha(A342, "060/2018", "Cidade G", "007010")
    carga.siafe(2026, 11, "007010", A_APROVAR)

    (registro,) = _registros(carga)
    assert _saldos(registro) == (0, 0, 0, 0)


def test_codigo_repetido_nos_dois_tipos_gera_registro_unico(carga):
    carga.planilha(A342, "060/2018", "Cidade G", "210050", "210050")
    carga.siafe(2026, 11, "210050", a_pagar="7.00")

    (registro,) = _registros(carga)
    assert registro["tipos"] == ["SEOBRAS", "SEIOP"]


def test_saldos_coerentes_com_os_registros(carga):
    carga.planilha(A342, "060/2018", "Cidade G", "007010", "210060")
    carga.siafe(2026, 11, "007010", A_COMPROVAR, a_comprovar="50.00")
    carga.siafe(2026, 11, "210060", A_PAGAR, a_pagar="20.00")
    carga.siafe(2026, 11, "210060", A_COMPROVAR, a_comprovar="30.00")
    carga.siafe(2026, 11, "210060", APROVADOS, aprovados="5.25")

    soma = [0, 0, 0, 0]
    for r in _registros(carga, ano=2026, mes=11):
        soma = [a + b for a, b in zip(soma, _saldos(r))]
    (saldo,) = carga.consulta("SELECT * FROM v_convenio_saldo WHERE ano = 2026 AND mes = 11")
    assert tuple(soma) == _saldos(saldo) == (Decimal("20.00"), Decimal("80.00"), 0, Decimal("5.25"))


# --- Saldo mensal por código e por convênio ----------------------------------


def _saldo_codigo(carga: Carga) -> list[dict]:
    return carga.consulta("SELECT * FROM v_convenio_saldo_codigo ORDER BY codigo, ano, mes")


def _saldo_convenio(carga: Carga) -> list[dict]:
    return carga.consulta("SELECT * FROM v_convenio_saldo ORDER BY numero_convenio, municipio, ano, mes")


def test_conta_com_saldo_no_mes(carga):
    carga.planilha(A342, "070/2019", "Cidade H", seiop="210044")
    carga.siafe(2026, 11, "210044", a_pagar="100.00")

    (saldo,) = _saldo_codigo(carga)
    assert (saldo["codigo"], saldo["tipos"], saldo["ano"], saldo["mes"]) == ("210044", ["SEIOP"], 2026, 11)
    assert _saldos(saldo) == (Decimal("100.00"), 0, 0, 0)


def test_conta_sem_linhas_no_mes(carga):
    carga.planilha(A342, "070/2019", "Cidade H", "007020")
    carga.siafe(2025, 2, "007020", a_pagar="1.00")
    carga.siafe(2025, 4, "007020", a_pagar="1.00")
    carga.siafe(2025, 3, "007999", a_pagar="1.00")  # outra conta tem linhas no mês

    assert [(s["ano"], s["mes"]) for s in _saldo_codigo(carga)] == [(2025, 2), (2025, 4)]


def test_duas_contas_contabeis_somadas_dentro_do_mes(carga):
    carga.planilha(A342, "070/2019", "Cidade H", "007020")
    carga.siafe(2026, 11, "007020", A_PAGAR, a_pagar="10.00")
    carga.siafe(2026, 11, "007020", A_COMPROVAR, a_comprovar="4.00")

    (saldo,) = _saldo_codigo(carga)
    assert _saldos(saldo) == (Decimal("10.00"), Decimal("4.00"), 0, 0)


def test_convenio_com_seobras_e_seiop(carga):
    carga.planilha(A342, "070/2019", "Cidade H", "007020", "210070")
    carga.siafe(2026, 11, "007020", A_COMPROVAR, a_comprovar="50.00")
    carga.siafe(2026, 11, "210070", A_COMPROVAR, a_comprovar="30.00")
    carga.siafe(2026, 11, "210070", A_PAGAR, a_pagar="20.00")

    (saldo,) = _saldo_convenio(carga)
    assert (saldo["numero_convenio"], saldo["municipio"]) == ("070/2019", "Cidade H")
    assert _saldos(saldo) == (Decimal("20.00"), Decimal("80.00"), 0, 0)
    assert {(s["codigo"], s["tipos"][0]) for s in _saldo_codigo(carga)} == {
        ("007020", "SEOBRAS"),
        ("210070", "SEIOP"),
    }


def test_mesmo_codigo_nos_dois_tipos_conta_uma_vez(carga):
    carga.planilha(A342, "070/2019", "Cidade H", "210050", "210050")
    carga.siafe(2026, 11, "210050", a_pagar="7.00")

    (saldo_codigo,) = _saldo_codigo(carga)
    (saldo,) = _saldo_convenio(carga)
    assert saldo_codigo["tipos"] == ["SEOBRAS", "SEIOP"]
    assert saldo["convenios_a_pagar"] == Decimal("7.00")


def test_meses_independentes(carga):
    carga.planilha(A342, "070/2019", "Cidade H", "007020")
    carga.siafe(2026, 10, "007020", a_pagar="15.00")
    carga.siafe(2026, 11, "007020", a_pagar="12.00")

    assert [(s["ano"], s["mes"], s["convenios_a_pagar"]) for s in _saldo_convenio(carga)] == [
        (2026, 10, Decimal("15.00")),
        (2026, 11, Decimal("12.00")),
    ]


def test_convenio_sem_codigo_nao_tem_saldo(carga):
    carga.planilha(A342, "070/2019", "Cidade H")
    carga.planilha(A342, "071/2019", "Cidade H", "007021")
    carga.siafe(2026, 11, "007021", a_pagar="1.00")

    assert [s["numero_convenio"] for s in _saldo_convenio(carga)] == ["071/2019"]


# --- Contas do SIAFE sem convênio --------------------------------------------


def test_conta_antiga_sem_codigo_na_planilha(carga):
    carga.planilha(A342, "080/2011", "Cidade I", "007030")
    carga.siafe(2026, 10, "005348", A_COMPROVAR, a_comprovar="9.00")
    carga.siafe(2026, 11, "005348", A_COMPROVAR, a_comprovar="8.00")
    carga.siafe(2026, 11, "005348", A_APROVAR, a_aprovar="2.00")
    carga.siafe(2026, 10, "005349", a_pagar="3.00")  # sem linhas no último mês
    carga.siafe(2026, 11, "007030", a_pagar="1.00")

    falhas = carga.falhas("conta_siafe_sem_convenio")
    assert [f["codigo"] for f in falhas] == ["005348", "005349"]
    assert all((f["ano"], f["mes"]) == (2026, 11) for f in falhas)
    assert _saldos(falhas[0]) == (0, Decimal("8.00"), Decimal("2.00"), 0)
    assert _saldos(falhas[1]) == (None, None, None, None)


def test_conta_presa_a_codigo_descartado(carga):
    carga.planilha(A342, "080/2011", "Cidade I", seiop="210040")
    carga.planilha(A89, "080/2011", "Cidade I", seiop="210044")
    carga.siafe(2026, 11, "210040", a_pagar="1.00")
    carga.siafe(2026, 11, "210044", a_pagar="2.00")

    assert [f["codigo"] for f in carga.falhas("conta_siafe_sem_convenio")] == ["210040"]
    assert [f["codigo"] for f in carga.falhas("codigo_divergente")] == ["210040"]


# --- Convênios sem código e códigos ausentes do SIAFE ------------------------


def test_convenio_sem_codigo(carga):
    carga.planilha(A342, "090/2012", "Cidade J", status_convenio="Encerrado")
    carga.planilha(A89, "090/2012", "Cidade J")

    (falha,) = carga.falhas("convenio_sem_codigo")
    assert (falha["numero_convenio"], falha["municipio"]) == ("090/2012", "Cidade J")
    assert "realinhado" in falha["detalhe"] and "Encerrado" in falha["detalhe"]


def test_codigo_digitado_errado(carga):
    carga.planilha(A342, "090/2012", "Cidade J", "099999")
    carga.siafe(2026, 11, "007040", a_pagar="1.00")

    (falha,) = carga.falhas("codigo_fora_do_siafe")
    assert (falha["codigo"], falha["tipo_codigo"], falha["aba"]) == ("099999", "SEOBRAS", A342)
    assert (falha["numero_convenio"], falha["municipio"]) == ("090/2012", "Cidade J")


# --- Código em mais de um convênio -------------------------------------------


def test_codigo_em_mais_de_um_convenio(carga):
    carga.planilha(A342, "010/2012", "Cidade K", "007001")
    carga.planilha(A342, "011/2012", "Cidade K", "007001")
    carga.siafe(2026, 11, "007001", a_pagar="4.00")

    (falha,) = carga.falhas("codigo_em_mais_de_um_convenio")
    assert falha["codigo"] == "007001"
    assert "010/2012 - Cidade K" in falha["detalhe"] and "011/2012 - Cidade K" in falha["detalhe"]
    # O saldo continua em cada convênio até a planilha ser corrigida.
    assert [(s["numero_convenio"], s["convenios_a_pagar"]) for s in _saldo_convenio(carga)] == [
        ("010/2012", Decimal("4.00")),
        ("011/2012", Decimal("4.00")),
    ]


# --- Linhas de abas sem convênio na 342 --------------------------------------


def test_linha_da_89_sem_convenio_na_342(carga):
    carga.planilha(A342, "143/2014", "Cidade L")
    linha = carga.planilha(A89, "143/2014", "Paraty", "007050", "210080")
    carga.planilha(A89, "143/2014", "Paraty", "007050", "210080", principal=False)

    (falha,) = carga.falhas("linha_sem_convenio")
    assert (falha["aba"], falha["linha"], falha["numero_convenio"], falha["municipio"]) == (
        A89,
        linha,
        "143/2014",
        "Paraty",
    )
    assert "007050" in falha["detalhe"] and "210080" in falha["detalhe"]
    assert carga.consulta("SELECT * FROM v_convenio_codigo") == []
    assert carga.convenio("143/2014", "Cidade L")["fase"] == "historico"


def test_a_342_nunca_cai_em_linha_sem_convenio(carga):
    carga.planilha(A342, None, "Cidade L")

    assert carga.falhas("linha_sem_convenio") == []
    assert len(carga.falhas("chave_ausente_342")) == 1


# --- Cruzamento calculado sobre os dados carregados --------------------------


def test_siafe_vazio_com_planilha_carregada(carga):
    carga.planilha(A342, "100/2013", "Cidade M", "007060", "210090")

    assert carga.consulta("SELECT * FROM v_convenio_registro") == []
    assert _saldo_convenio(carga) == []
    assert [f["codigo"] for f in carga.falhas("codigo_fora_do_siafe")] == ["007060", "210090"]
    assert carga.falhas("conta_siafe_sem_convenio") == []


def test_planilha_vazia_com_siafe_carregado(carga):
    carga.siafe(2026, 11, "007070", a_pagar="1.00")
    carga.siafe(2026, 11, "007071", a_comprovar="2.00")

    assert carga.convenios() == []
    falhas = carga.consulta("SELECT motivo, codigo FROM v_cruzamento_falha ORDER BY codigo")
    assert falhas == [
        {"motivo": "conta_siafe_sem_convenio", "codigo": "007070"},
        {"motivo": "conta_siafe_sem_convenio", "codigo": "007071"},
    ]


def test_as_duas_fontes_vazias(carga):
    for view in VIEWS:
        assert carga.consulta(f"SELECT * FROM {view}") == [], view


def test_troca_da_planilha_refletida_na_consulta_seguinte(carga):
    carga.planilha(A342, "110/2014", "Cidade N", "007080")
    carga.siafe(2026, 11, "007080", a_pagar="1.00")
    carga.siafe(2026, 11, "007081", a_pagar="2.00")
    assert [s["convenios_a_pagar"] for s in _saldo_convenio(carga)] == [Decimal("1.00")]

    # Nova importação: overwrite das tabelas da planilha, SIAFE intocado.
    with carga.engine.begin() as conn:
        conn.execute(text("DELETE FROM planilha_convenios_geral"))
    carga.planilha(A342, "110/2014", "Cidade N", "007081")

    assert carga.convenio("110/2014", "Cidade N")["codigo_seobras"] == "007081"
    assert [s["convenios_a_pagar"] for s in _saldo_convenio(carga)] == [Decimal("2.00")]
    assert [f["codigo"] for f in carga.falhas("conta_siafe_sem_convenio")] == ["007080"]
