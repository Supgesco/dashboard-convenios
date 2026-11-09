"""Transforma a resposta da consulta FlexVision em linhas tipadas de `siafe_flexvision`.

O mapeamento campo -> coluna -> tipo fica todo em CAMPOS. Se a consulta mudar no
SIAFE, o ajuste é aqui (e numa migration nova).
"""

import unicodedata
from collections.abc import Callable
from decimal import Decimal, InvalidOperation
from typing import Any

TOTAL = "Total"


class TransformError(ValueError):
    """A resposta não está no formato esperado."""


def _nfc(texto: str) -> str:
    return unicodedata.normalize("NFC", texto)


def _texto(valor: str) -> str:
    return valor.strip()


def _conta_corrente(valor: str) -> str:
    texto = valor.strip()
    if texto.isdigit() and len(texto) <= 6:
        return texto.zfill(6)
    return texto


def _dinheiro(valor: str) -> Decimal:
    try:
        d = Decimal(valor.strip())
    except InvalidOperation:
        raise ValueError(f"valor monetário inválido: {valor!r}") from None
    if not d.is_finite() or d.as_tuple().exponent < -2:
        raise ValueError(f"valor monetário inválido: {valor!r}")
    return d


def _codigo_nome(valor: str, obrigatorio: bool) -> tuple[str | None, str | None]:
    """Separa '<código> - <nome>'. Vazio (' - ') vira (None, None) se não obrigatório."""
    if " - " in valor:
        codigo, nome = (p.strip() for p in valor.split(" - ", 1))
    else:
        codigo, nome = valor.strip(), ""
    if not codigo and not nome:
        if obrigatorio:
            raise ValueError("valor vazio")
        return None, None
    if obrigatorio and (not codigo or not nome):
        raise ValueError(f"esperado '<código> - <nome>', veio {valor!r}")
    return codigo or None, nome or None


def _ug(valor: str) -> dict[str, Any]:
    _, nome = _codigo_nome(valor, obrigatorio=True)
    return {"ug_nome": nome}


def _conta_contabil(valor: str) -> dict[str, Any]:
    codigo, nome = _codigo_nome(valor, obrigatorio=True)
    return {"conta_contabil": codigo, "conta_contabil_nome": nome}


def _credor(valor: str) -> dict[str, Any]:
    codigo, nome = _codigo_nome(valor, obrigatorio=False)
    return {"credor": codigo, "credor_nome": nome}


def _coluna(nome: str, conv: Callable[[str], Any]) -> Callable[[str], dict[str, Any]]:
    return lambda valor: {nome: conv(valor)}


# Campo da FlexVision (normalizado em NFC) -> função que produz as colunas.
CAMPOS: dict[str, Callable[[str], dict[str, Any]]] = {
    "Unidade Gestora": _ug,
    "Conta Corrente": _coluna("conta_corrente", _conta_corrente),
    "Conta contábil": _conta_contabil,
    "Credor": _credor,
    "Convenios a pagar": _coluna("convenios_a_pagar", _dinheiro),
    "Convênios a comprovar": _coluna("convenios_a_comprovar", _dinheiro),
    "Convênios a aprovar": _coluna("convenios_a_aprovar", _dinheiro),
    "Convênios aprovados": _coluna("convenios_aprovados", _dinheiro),
}


def _eh_total(linha: dict[str, Any]) -> bool:
    return str(linha.get("Unidade Gestora", "")).strip() == TOTAL


def transformar(resposta: Any, ano: int, mes: int, ug: str) -> list[dict[str, Any]]:
    """Converte a resposta de um mês em linhas prontas para inserir (sem execucao_id)."""
    periodo = f"{ano}-{mes:02d}"
    if not isinstance(resposta, list):
        raise TransformError(f"{periodo}: resposta deveria ser uma lista, veio {type(resposta).__name__}")

    linhas = []
    for i, bruta in enumerate(resposta):
        if not isinstance(bruta, dict):
            raise TransformError(f"{periodo}: linha {i} não é um objeto")
        if _eh_total(bruta):
            continue
        registro = {_nfc(k): v for k, v in bruta.items()}

        linha: dict[str, Any] = {"ano": ano, "mes": mes, "ug": ug}
        for campo, conv in CAMPOS.items():
            if campo not in registro:
                raise TransformError(f"{periodo}: linha {i} sem o campo '{campo}'")
            valor = registro[campo]
            if not isinstance(valor, str):
                valor = "" if valor is None else str(valor)
            try:
                linha.update(conv(valor))
            except ValueError as e:
                raise TransformError(f"{periodo}: linha {i}, campo '{campo}': {e}") from None
        linhas.append(linha)
    return linhas
