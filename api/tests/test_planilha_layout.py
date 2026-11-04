"""Layout declarativo da planilha e tabelas geradas a partir dele."""

import pytest
from openpyxl.utils import column_index_from_string

from app import models
from app.planilha.dominios import VOCABULARIOS
from app.planilha.layout import ABAS, COLUNAS_CONTROLE, Papel, normalizar_cabecalho, normalizar_nome_aba


def test_normalizacao_de_cabecalho_ignora_espacos_quebras_e_caixa():
    assert normalizar_cabecalho("Nº do Convênio\nSIAFE - SEOBRAS ") == normalizar_cabecalho(
        "nº do convênio siafe - seobras"
    )
    assert normalizar_cabecalho(None) == ""


def test_normalizacao_de_nome_de_aba_so_ignora_espacos():
    assert normalizar_nome_aba("31 Convênios Vigentes  2025") == "31 Convênios Vigentes 2025"
    assert normalizar_nome_aba("89 Convênios ") == "89 Convênios"


def test_oito_abas_com_tabelas_distintas():
    assert len(ABAS) == 8
    assert len({a.nome for a in ABAS}) == 8
    assert len({a.tabela for a in ABAS}) == 8


@pytest.mark.parametrize("aba", ABAS, ids=lambda a: a.tabela)
def test_colunas_da_aba_sao_consistentes(aba):
    nomes = [c.nome for c in aba.colunas]
    assert len(nomes) == len(set(nomes)), "nome de coluna duplicado"
    assert not set(nomes) & COLUNAS_CONTROLE

    indices = [column_index_from_string(c.letra) for c in aba.colunas]
    assert indices == list(range(1, len(indices) + 1)), "letras não contíguas a partir de A"

    for c in aba.colunas:
        if c.papel is Papel.CATEGORIA:
            assert c.vocabulario in VOCABULARIOS
        else:
            assert c.vocabulario is None
        if c.repete:
            original = next(o for o in aba.colunas if o.letra == c.repete)
            assert original.papel is c.papel and not original.repete

    if aba.continuacao_por_item:
        assert aba.coluna("item").identificacao


def test_tabelas_geradas_a_partir_do_layout():
    tabelas = set(models.Base.metadata.tables)
    esperadas = {a.tabela for a in ABAS} | {"planilha_importacao"}
    assert esperadas <= tabelas

    for aba in ABAS:
        tabela = models.TABELAS_PLANILHA[aba.nome]
        colunas = list(tabela.columns.keys())
        controle = ["id", "importacao_id", "linha", "linha_principal"]
        controle += ["bloco"] if aba.bloco_extra else []
        controle += ["colunas_corrigidas"] if aba.deslocamento_h_k else []
        assert colunas == controle + [c.nome for c in aba.colunas if not c.repete]


def test_tipos_sql_por_papel():
    vigentes = models.TABELAS_PLANILHA["31 Convênios Vigentes 2025"].c
    assert str(vigentes.item.type) == "INTEGER"
    assert str(vigentes.vigencia_final.type) == "DATE"
    assert str(vigentes.valor_total_inicial.type) == "NUMERIC"
    assert str(vigentes.municipio.type) == "TEXT"
    assert "municipio_repetido" not in vigentes
    assert "item_homologacao" in vigentes
    geral = models.TABELAS_PLANILHA["342 Convênios"].c
    assert str(geral.realinhado.type) == "BOOLEAN"
    assert str(geral.colunas_corrigidas.type) == "BOOLEAN"
