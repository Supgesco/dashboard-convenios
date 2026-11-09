"""Extração e validação de layout, sobre planilhas sintéticas."""

from pathlib import Path

import pytest
from openpyxl import load_workbook

from app.planilha import layout as L
from app.planilha.extracao import ErroArquivo, ErroLayout, extrair
from tests.planilha_sintetica import LINHAS_ESPERADAS, TITULOS, gerar


@pytest.fixture
def planilha(tmp_path: Path) -> Path:
    return gerar(tmp_path / "planilha.xlsx")


def test_gerador_cria_as_nove_abas(planilha):
    wb = load_workbook(planilha)
    assert len(wb.sheetnames) == 9
    assert "Planilha2" in wb.sheetnames


def test_linhas_extraidas_por_aba(planilha):
    extracao = extrair(planilha)
    assert set(extracao.linhas) == {aba.nome for aba in L.ABAS}
    for nome, esperadas in LINHAS_ESPERADAS.items():
        assert [l.linha for l in extracao.linhas[nome]] == esperadas, nome


def test_total_e_quadro_resumo_ficam_de_fora(planilha):
    linhas = extrair(planilha).linhas[L.CONVENIOS_TRANSFERIDOS.nome]
    assert max(l.linha for l in linhas) == 6  # total na 7, quadro-resumo na 9 e 10


def test_dois_blocos_da_tomada_de_contas(planilha):
    linhas = extrair(planilha).linhas[L.TOMADA_CONTAS.nome]
    assert [(l.linha, l.bloco) for l in linhas] == [(4, 1), (5, 1), (6, 1), (10, 2), (11, 2)]


def test_linhas_vazias_no_meio_sao_puladas(planilha):
    linhas = extrair(planilha).linhas[L.PRESTACAO_CONTAS.nome]
    assert [l.linha for l in linhas] == [4, 5, 6, 9]


def test_marca_de_mescla_vertical(planilha):
    linhas = {l.linha: l for l in extrair(planilha).linhas[L.CONVENIOS_TRANSFERIDOS.nome]}
    assert linhas[5].celulas["C"].mesclada and linhas[5].celulas["C"].valor is None
    assert not linhas[4].celulas["C"].mesclada
    assert not linhas[5].celulas["X"].mesclada and linhas[5].celulas["X"].valor == 2
    assert linhas[5].celulas["X"].coordenada == "X5"


def test_nome_de_aba_com_espacos_e_planilha2_ignorada(planilha):
    assert TITULOS[L.CONVENIOS_VIGENTES.nome] == "31 Convênios Vigentes  2025"
    extracao = extrair(planilha)  # a Planilha2 tem valor na coluna AZ e não quebra nada
    assert "Planilha2" not in extracao.linhas


def test_planilha2_ausente_e_aceita(tmp_path):
    extracao = extrair(gerar(tmp_path / "p.xlsx", sem_planilha2=True))
    assert len(extracao.linhas) == 8


def test_cabecalho_com_espacos_extras_e_aceito(planilha):
    # o gerador escreve "Nº\nSIAFEM " na 342 e "\nOriginal  " na Realinhado
    extrair(planilha)


def test_aba_faltando_e_aba_desconhecida(tmp_path):
    caminho = gerar(tmp_path / "p.xlsx", omitir=frozenset({L.TOMADA_CONTAS.nome}), aba_extra="Rascunho 3")
    with pytest.raises(ErroLayout) as erro:
        extrair(caminho)
    assert "abas faltando: Tomada de Contas" in str(erro.value)
    assert "abas desconhecidas: Rascunho 3" in str(erro.value)


def test_cabecalho_divergente(tmp_path):
    caminho = gerar(tmp_path / "p.xlsx", cabecalho=(L.CONVENIOS_TRANSFERIDOS.nome, "G3", "Coluna Nova"))
    with pytest.raises(ErroLayout) as erro:
        extrair(caminho)
    mensagem = str(erro.value)
    assert "Aba '89 Convênios'" in mensagem and "célula G3" in mensagem
    assert "'Objeto'" in mensagem and "'Coluna Nova'" in mensagem


def test_valor_fora_das_colunas_do_layout(tmp_path):
    caminho = gerar(tmp_path / "p.xlsx", celula_extra=("L2", "inesperado"))
    with pytest.raises(ErroLayout) as erro:
        extrair(caminho)
    assert "Aba 'Não Realinhado Expirado', célula L2" in str(erro.value)


def test_marcador_de_fim_ausente(tmp_path):
    with pytest.raises(ErroLayout) as erro:
        extrair(gerar(tmp_path / "p.xlsx", sem_total_31=True))
    assert "31 Convênios Vigentes 2025" in str(erro.value) and "Total Geral" in str(erro.value)


def test_arquivo_inexistente(tmp_path):
    with pytest.raises(ErroArquivo, match="não encontrado"):
        extrair(tmp_path / "nao_existe.xlsx")


def test_arquivo_que_nao_e_xlsx(tmp_path):
    caminho = tmp_path / "texto.xlsx"
    caminho.write_text("isto não é um xlsx", encoding="utf-8")
    with pytest.raises(ErroArquivo, match="como xlsx"):
        extrair(caminho)


def test_formula_sem_valor_calculado_gera_aviso(tmp_path):
    caminho = gerar(tmp_path / "p.xlsx")
    wb = load_workbook(caminho)
    wb[TITULOS[L.NAO_REALINHADO_EXPIRADO.nome]]["J2"] = "=1+1"  # openpyxl não grava valor calculado
    wb.save(caminho)
    avisos = extrair(caminho).avisos
    assert avisos == [
        {"aba": "Não Realinhado Expirado", "celula": "J2", "coluna": "repasse", "motivo": "formula_sem_valor",
         "valor": "=1+1"}
    ]
