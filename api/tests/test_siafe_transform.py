"""Fixtures sintéticos, só com a estrutura da resposta real da FlexVision."""

from decimal import Decimal

import pytest

from app.siafe.transform import TransformError, transformar


def linha(**sobrescreve) -> dict:
    base = {
        "Unidade Gestora": "000001 - UNIDADE FICTICIA DE TESTE",
        "Conta Corrente": "000123",
        "Conta contábil": "800000001 - CONTA FICTICIA ",
        "Credor": " - ",
        "Convenios a pagar": "0",
        "Convênios a comprovar": "12345.67",
        "Convênios a aprovar": "0",
        "Convênios aprovados": "0.1",
    }
    base.update(sobrescreve)
    return base


def total() -> dict:
    return {k: ("Total" if i < 4 else "12345.77") for i, k in enumerate(linha())}


def test_transforma_linha_e_descarta_total():
    linhas = transformar([linha(), total()], 2025, 1, "000001")

    assert linhas == [
        {
            "ano": 2025,
            "mes": 1,
            "ug": "000001",
            "ug_nome": "UNIDADE FICTICIA DE TESTE",
            "conta_corrente": "000123",
            "conta_contabil": "800000001",
            "conta_contabil_nome": "CONTA FICTICIA",
            "credor": None,
            "credor_nome": None,
            "convenios_a_pagar": Decimal("0"),
            "convenios_a_comprovar": Decimal("12345.67"),
            "convenios_a_aprovar": Decimal("0"),
            "convenios_aprovados": Decimal("0.1"),
        }
    ]


def test_valor_monetario_sem_perda_de_casas():
    [l] = transformar([linha(**{"Convênios aprovados": "357426387.85"})], 2025, 1, "000001")
    assert l["convenios_aprovados"] == Decimal("357426387.85")
    assert isinstance(l["convenios_aprovados"], Decimal)


def test_lista_vazia_e_mes_sem_registros():
    assert transformar([], 2023, 1, "000001") == []


def test_preserva_zeros_a_esquerda_e_credor_preenchido():
    [l] = transformar([linha(**{"Credor": "12345678000199 - CREDOR FICTICIO"})], 2025, 1, "000001")
    assert l["conta_corrente"] == "000123"
    assert (l["credor"], l["credor_nome"]) == ("12345678000199", "CREDOR FICTICIO")


def test_chaves_em_unicode_decomposto_sao_aceitas():
    import unicodedata

    bruta = {unicodedata.normalize("NFD", k): v for k, v in linha().items()}
    assert len(transformar([bruta], 2025, 1, "000001")) == 1


def test_campo_ausente_identifica_mes_e_campo():
    bruta = linha()
    del bruta["Convênios a aprovar"]
    with pytest.raises(TransformError, match=r"2024-03.*Convênios a aprovar"):
        transformar([bruta], 2024, 3, "000001")


@pytest.mark.parametrize("valor", ["abc", "1,50", "1.234", "", "NaN"])
def test_valor_invalido_identifica_mes_e_campo(valor):
    with pytest.raises(TransformError, match=r"2024-03.*Convenios a pagar"):
        transformar([linha(**{"Convenios a pagar": valor})], 2024, 3, "000001")


def test_conta_contabil_fora_do_formato():
    with pytest.raises(TransformError, match="Conta contábil"):
        transformar([linha(**{"Conta contábil": "800000001"})], 2024, 3, "000001")


def test_resposta_que_nao_e_lista():
    with pytest.raises(TransformError, match="2024-03"):
        transformar({"erro": "x"}, 2024, 3, "000001")
