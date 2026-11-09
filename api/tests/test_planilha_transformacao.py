"""Transformação: funções por papel, regras por aba e integração com a extração."""

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from app.planilha import layout as L
from app.planilha import transformacao as T
from app.planilha.dominios import ALIASES_MUNICIPIO, MUNICIPIOS_RJ, VOCABULARIOS, chave
from app.planilha.extracao import Celula, ErroLayout, LinhaCrua, extrair
from tests.planilha_sintetica import gerar

# --------------------------------------------------------------------------- domínios


def test_92_municipios_distintos():
    assert len(MUNICIPIOS_RJ) == 92
    assert len({chave(m) for m in MUNICIPIOS_RJ}) == 92


def test_alias_nao_colide_com_outro_municipio():
    oficiais = {chave(m): m for m in MUNICIPIOS_RJ}
    for apelido, alvo in ALIASES_MUNICIPIO.items():
        assert alvo in MUNICIPIOS_RJ
        assert oficiais.get(chave(apelido), alvo) == alvo


def test_vocabularios_sem_chaves_repetidas():
    for nome, valores in VOCABULARIOS.items():
        assert len({chave(v) for v in valores}) == len(valores), nome


# --------------------------------------------------------------------------- papéis


@pytest.mark.parametrize("valor", [None, "", "   ", "-", " - ", ".", ";", "#REF!", "#N/A", " #DIV/0! "])
def test_marcadores_de_ausencia_viram_nulo_sem_aviso(valor):
    for funcao in (T.rotulo, T.livre, T.booleano, T.municipio, T.numero_convenio, T.codigo, T.data, T.numero,
                   T.inteiro):
        assert funcao(valor) == (None, None)
    assert T.categoria(valor, "situacao_vigencia") == (None, None)


def test_rotulo():
    assert T.rotulo("\nAperibé\n") == ("Aperibé", None)
    assert T.rotulo("  Em   andamento \n") == ("Em andamento", None)
    assert T.rotulo(7783) == ("7783", None)
    assert T.rotulo(7783.0) == ("7783", None)
    assert T.rotulo(datetime(2023, 12, 31)) == ("2023-12-31", None)


def test_livre_mantem_quebras_entre_linhas():
    assert T.livre("E-17/001.335/2011 \nE-17/002.729/2011") == ("E-17/001.335/2011\nE-17/002.729/2011", None)
    assert T.livre("\n  linha  um \n\n linha dois\n") == ("linha um\nlinha dois", None)


def test_categoria():
    for variacao in ("Vigente ", "vigente ", "Vigente", "VIGENTE"):
        assert T.categoria(variacao, "situacao_vigencia") == ("Vigente", None)
    assert T.categoria("100%Executado", "situacao_prestacao") == ("100% Executado", None)
    assert T.categoria("Não repassado ", "situacao_prestacao") == ("Não Repassado", None)
    assert T.categoria(22, "status_convenio") == ("22", "categoria_desconhecida")
    assert T.categoria(" Algo  novo ", "status_convenio") == ("Algo novo", "categoria_desconhecida")


def test_booleano():
    assert T.booleano("Sim ") == (True, None)
    assert T.booleano("Sim") == (True, None)
    assert T.booleano("Não ") == (False, None)
    assert T.booleano("Nao") == (False, None)
    assert T.booleano(datetime(2023, 12, 31)) == (None, "valor_invalido")
    assert T.booleano("Talvez") == (None, "valor_invalido")


def test_municipio():
    for grafia in ("SÃO JOSÉ DO VALE RIO PRETO", "São J Vale do Rio Preto", "SÃO J. DO V. DO RIO PRETO"):
        assert T.municipio(grafia) == ("São José do Vale do Rio Preto", None)
    assert T.municipio("Sâo Fidélis") == ("São Fidélis", None)
    assert T.municipio("RioClaro") == ("Rio Claro", None)
    assert T.municipio("\nBom Jesus do Itabapoana\n") == ("Bom Jesus do Itabapoana", None)
    assert T.municipio("SANTO ANTONIO DE PÁDUA") == ("Santo Antônio de Pádua", None)
    assert T.municipio(" Cidade  Inventada ") == ("Cidade Inventada", "municipio_desconhecido")


def test_numero_convenio():
    assert T.numero_convenio("143/14") == ("143/2014", None)
    assert T.numero_convenio("143/2014") == ("143/2014", None)
    assert T.numero_convenio("85/14") == ("085/2014", None)
    assert T.numero_convenio("098/14 ") == ("098/2014", None)
    assert T.numero_convenio("012-A/2013") == ("012-A/2013", None)
    assert T.numero_convenio("012/A/2013") == ("012-A/2013", None)
    assert T.numero_convenio("CONVÊNIO") == (None, "numero_convenio_invalido")
    assert T.numero_convenio(33) == (None, "numero_convenio_invalido")


def test_codigo():
    assert T.codigo(7783) == ("007783", None)
    assert T.codigo("007783") == ("007783", None)
    assert T.codigo("'007695") == ("007695", None)
    assert T.codigo(210044) == ("210044", None)
    assert T.codigo(" 210102") == ("210102", None)
    assert T.codigo("210014/ 007645") == (None, "codigo_invalido")
    assert T.codigo(1234567) == (None, "codigo_invalido")


def test_numeros_e_datas():
    assert T.numero(991879.4210000001) == (Decimal("991879.421"), None)
    assert T.numero(0.92) == (Decimal("0.92"), None)
    assert T.numero(600000) == (Decimal("600000"), None)
    assert T.numero("10.5") == (Decimal("10.5"), None)
    assert T.numero("\n2.036.643,30\n") == (Decimal("2036643.30"), None)
    assert T.numero("31,5") == (Decimal("31.5"), None)
    assert T.numero("Verificar NL") == (None, "valor_invalido")
    assert T.numero(datetime(2023, 1, 1)) == (None, "valor_invalido")
    assert T.inteiro("3") == (3, None)
    assert T.inteiro(3) == (3, None)
    assert T.inteiro(2.5) == (None, "valor_invalido")
    assert T.data(datetime(2025, 12, 31)) == (date(2025, 12, 31), None)
    assert T.data("31/12/2025") == (None, "valor_invalido")


# --------------------------------------------------------------------------- regras de aba


def _linha(numero: int, valores: dict[str, object], mescladas: frozenset[str] = frozenset(), bloco: int = 1,
           aba: L.Aba = L.CONVENIOS_TRANSFERIDOS) -> LinhaCrua:
    celulas = {
        c.letra: Celula(valores.get(c.letra), f"{c.letra}{numero}", c.letra in mescladas) for c in aba.colunas
    }
    return LinhaCrua(linha=numero, bloco=bloco, celulas=celulas)


def test_continuacao_herda_identificacao_mas_nao_valores():
    linhas = [
        _linha(7, {"A": "4", "C": "Aperibé", "D": "138/14", "E": "007639", "F": 210097, "H": "Sim",
                   "M": 361506.42, "X": 1, "Y": 62227.48}),
        _linha(8, {"X": 7, "Y": 49635.39}, mescladas=frozenset({"A", "C", "D", "E", "H", "M"})),
    ]
    saida, avisos = T.transformar_aba(L.CONVENIOS_TRANSFERIDOS, linhas)
    principal, continuacao = saida
    assert avisos == []
    assert principal["linha_principal"] is True and continuacao["linha_principal"] is False
    assert continuacao["linha"] == 8
    for coluna in ("item", "municipio", "numero_convenio", "codigo_seobras", "codigo_seiop", "realinhado"):
        assert continuacao[coluna] == principal[coluna], coluna
    assert continuacao["numero_convenio"] == "138/2014" and continuacao["codigo_seiop"] == "210097"
    assert principal["valor_total_inicial"] == Decimal("361506.42")
    assert continuacao["valor_total_inicial"] is None
    assert continuacao["parcelas_realinhado"] == 7 and continuacao["cronograma_repasse_realinhado"] == Decimal(
        "49635.39"
    )


def test_continuacao_antes_de_linha_principal_e_erro():
    with pytest.raises(ErroLayout, match="linha 4: linha de continuação"):
        T.transformar_aba(L.CONVENIOS_TRANSFERIDOS, [_linha(4, {"X": 1})])


def test_municipio_mesclado_na_tomada_de_contas():
    aba = L.TOMADA_CONTAS
    linhas = [
        _linha(20, {"A": "MIRACEMA", "B": "218/14", "E": "Obra 1"}, aba=aba),
        _linha(21, {"B": "219/14", "E": "Obra 2"}, mescladas=frozenset({"A"}), aba=aba),
        _linha(22, {"B": "220/14", "E": "Obra 3"}, mescladas=frozenset({"A"}), aba=aba),
        _linha(33, {"A": "QUISSAMÃ", "B": "015/10", "E": "Obra 4"}, bloco=2, aba=aba),
    ]
    saida, _ = T.transformar_aba(aba, linhas)
    assert [r["municipio"] for r in saida] == ["Miracema", "Miracema", "Miracema", "Quissamã"]
    assert all(r["linha_principal"] for r in saida)
    assert [r["bloco"] for r in saida] == [1, 1, 1, 2]


def test_linha_deslocada_e_linha_alinhada():
    aba = L.CONVENIOS_GERAL
    linhas = [
        _linha(10, {"H": datetime(2023, 12, 31), "I": "Expirado"}, aba=aba),
        _linha(11, {"H": "Não", "I": datetime(2023, 12, 31), "J": "Expirado", "K": "ok"}, aba=aba),
        _linha(12, {"H": datetime(2025, 12, 31), "I": "Vigente ", "K": "sobrou"}, aba=aba),
    ]
    saida, avisos = T.transformar_aba(aba, linhas)
    deslocada, alinhada, com_k = saida
    assert deslocada["colunas_corrigidas"] is True
    assert deslocada["vigencia_final"] == date(2023, 12, 31)
    assert deslocada["situacao_vigencia"] == "Expirado"
    assert deslocada["realinhado"] is None and deslocada["prestacao_contas"] is None
    assert alinhada["colunas_corrigidas"] is False
    assert alinhada["realinhado"] is False and alinhada["vigencia_final"] == date(2023, 12, 31)
    assert alinhada["situacao_vigencia"] == "Expirado" and alinhada["prestacao_contas"] == "ok"
    assert com_k["situacao_vigencia"] == "Vigente"
    assert avisos == [{"aba": "342 Convênios", "celula": "K12", "coluna": "prestacao_contas",
                       "motivo": "deslocamento_inesperado", "valor": "sobrou"}]


def test_colunas_repetidas_da_aba_31():
    aba = L.CONVENIOS_VIGENTES
    linhas = [
        _linha(4, {"A": 1, "D": "Petrópolis ", "E": "138/14", "L": "#REF!", "M": "PETRÓPOLIS", "N": "138/2014",
                   "W": "Petrópolis"}, aba=aba),
        _linha(6, {"A": 2, "D": "Três Rios", "E": "125/14", "L": 8, "M": "Volta Redonda", "N": "125/14",
                   "W": "Três Rios"}, aba=aba),
    ]
    saida, avisos = T.transformar_aba(aba, linhas)
    assert "municipio_repetido" not in saida[0] and "municipio_repetido_2" not in saida[0]
    assert saida[0]["item_homologacao"] is None and saida[1]["item_homologacao"] == 8
    assert avisos == [{"aba": "31 Convênios Vigentes 2025", "celula": "M6", "coluna": "municipio_repetido",
                       "motivo": "repeticao_divergente", "valor": "Volta Redonda != Três Rios (D6)"}]


def test_aviso_traz_aba_celula_coluna_motivo_e_valor_original():
    aba = L.PRESTACAO_CONTAS
    saida, avisos = T.transformar_aba(aba, [_linha(31, {"A": 1, "J": "Verificar NL"}, aba=aba)])
    assert saida[0]["valor_executado"] is None
    assert avisos == [{"aba": "Prest de Contas Conv_Execução", "celula": "J31", "coluna": "valor_executado",
                       "motivo": "valor_invalido", "valor": "Verificar NL"}]


# --------------------------------------------------------------------------- integração


def test_extracao_e_transformacao_da_planilha_sintetica(tmp_path: Path):
    extracao = extrair(gerar(tmp_path / "p.xlsx"))
    resultado = {aba.nome: T.transformar_aba(aba, extracao.linhas[aba.nome]) for aba in L.ABAS}

    contagens = {nome: (len(linhas), sum(l["linha_principal"] for l in linhas))
                 for nome, (linhas, _) in resultado.items()}
    assert contagens == {
        "342 Convênios": (3, 3),
        "89 Convênios": (3, 2),
        "31 Convênios Vigentes 2025": (3, 2),
        "Prest de Contas Conv_Execução": (4, 2),
        "Realinhado sem Exec_Expirado": (2, 2),
        "Não Realinhado Expirado": (2, 2),
        "Tomada de Contas": (5, 5),
        "ACOMPANHAMENTO ESPECIAL": (2, 2),
    }

    transferidos, _ = resultado["89 Convênios"]
    # sem dupla contagem: o valor inicial do convênio de 2 linhas aparece uma vez
    assert sum(l["valor_total_inicial"] or 0 for l in transferidos) == Decimal("1500.1")
    assert transferidos[1]["municipio"] == "Aperibé" and transferidos[1]["numero_convenio"] == "143/2014"
    assert transferidos[0]["cronograma_repasse_inicial"] == Decimal("991879.421")

    geral, _ = resultado["342 Convênios"]
    assert [l["colunas_corrigidas"] for l in geral] == [False, True, False]
    assert geral[1]["municipio"] == "Rio Claro" and geral[1]["situacao_vigencia"] == "Vigente"
    assert geral[0]["processo_parcela_01"] == "E-17/001/2/2014\nE-17/001/3/2014"
    assert geral[0]["processo_parcela_05"] is None  # "."

    prestacao, _ = resultado["Prest de Contas Conv_Execução"]
    assert prestacao[1]["valor_executado"] == Decimal("2036643.30")
    assert [l["situacao"] for l in prestacao] == [None, "Não Repassado", "100% Executado", "Verificar proc.SEI-0001"]

    motivos = sorted(
        (a["aba"], a["celula"], a["motivo"]) for _, avisos in resultado.values() for a in avisos
    )
    assert motivos == [
        ("31 Convênios Vigentes 2025", "AK6", "valor_invalido"),
        ("31 Convênios Vigentes 2025", "M6", "repeticao_divergente"),
        ("342 Convênios", "E5", "codigo_invalido"),
        ("342 Convênios", "G5", "categoria_desconhecida"),
        ("89 Convênios", "AC6", "valor_invalido"),
        ("89 Convênios", "Q6", "valor_invalido"),
        ("Prest de Contas Conv_Execução", "J6", "valor_invalido"),
        ("Prest de Contas Conv_Execução", "N9", "categoria_desconhecida"),
    ]
