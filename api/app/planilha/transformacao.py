"""Transformação: linhas cruas -> linhas normalizadas e tipadas, mais avisos.

Funções puras, sem banco. Cada papel de coluna (ver `layout.Papel`) tem uma
função `valor cru -> (valor tratado, motivo do aviso | None)`. As regras de aba
(continuação, município mesclado, deslocamento H–K, colunas repetidas) ficam em
`transformar_aba`.
"""

import re
from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from app.planilha.dominios import CATEGORIA_POR_CHAVE, MUNICIPIO_POR_CHAVE, chave
from app.planilha.extracao import ErroLayout, LinhaCrua
from app.planilha.layout import Aba, Coluna, Papel

ERROS_EXCEL = frozenset({"#REF!", "#N/A", "#VALUE!", "#DIV/0!", "#NAME?", "#NULL!", "#NUM!"})

Resultado = tuple[Any, str | None]


# --------------------------------------------------------------------------- utilidades


def ausente(valor: Any) -> bool:
    """Vazio, só espaços, só pontuação (`-`, `.`, `;`) ou erro do Excel."""
    if valor is None:
        return True
    if isinstance(valor, str):
        texto = valor.strip()
        return not texto or texto.upper() in ERROS_EXCEL or not any(ch.isalnum() for ch in texto)
    return False


def _numero_texto(valor: int | float) -> str:
    """Número com até 15 dígitos significativos (a precisão do Excel), sem notação científica."""
    if isinstance(valor, int):
        return str(valor)
    texto = format(valor, ".15g")
    if "e" in texto or "E" in texto:
        texto = format(Decimal(texto), "f")
    return texto


def original(valor: Any) -> str:
    """Valor cru como texto, para os avisos."""
    if isinstance(valor, datetime):
        return valor.date().isoformat() if valor.time() == datetime.min.time() else valor.isoformat()
    if isinstance(valor, date):
        return valor.isoformat()
    return str(valor)


# --------------------------------------------------------------------------- papéis


def rotulo(valor: Any) -> Resultado:
    if ausente(valor):
        return None, None
    if isinstance(valor, (datetime, date)):
        return original(valor), None
    if isinstance(valor, bool):
        return str(valor), None
    if isinstance(valor, (int, float)):
        return _numero_texto(valor), None
    return " ".join(str(valor).split()), None


def livre(valor: Any) -> Resultado:
    if ausente(valor):
        return None, None
    if not isinstance(valor, str):
        return rotulo(valor)
    linhas = [" ".join(linha.split()) for linha in valor.splitlines()]
    return "\n".join(linha for linha in linhas if linha) or None, None


def categoria(valor: Any, vocabulario: str) -> Resultado:
    texto, _ = rotulo(valor)
    if texto is None:
        return None, None
    canonico = CATEGORIA_POR_CHAVE[vocabulario].get(chave(texto))
    return (canonico, None) if canonico else (texto, "categoria_desconhecida")


def booleano(valor: Any) -> Resultado:
    texto, _ = rotulo(valor)
    if texto is None:
        return None, None
    k = chave(texto)
    if k == "sim":
        return True, None
    if k == "nao":
        return False, None
    return None, "valor_invalido"


def municipio(valor: Any) -> Resultado:
    texto, _ = rotulo(valor)
    if texto is None:
        return None, None
    oficial = MUNICIPIO_POR_CHAVE.get(chave(texto))
    return (oficial, None) if oficial else (texto, "municipio_desconhecido")


_NUMERO_CONVENIO = re.compile(r"^(\d{1,3})(?:[-/]([A-Za-z]))?/(\d{2}|\d{4})$")


def numero_convenio(valor: Any) -> Resultado:
    if ausente(valor):
        return None, None
    if not isinstance(valor, str):
        return None, "numero_convenio_invalido"
    m = _NUMERO_CONVENIO.match("".join(valor.split()))
    if not m:
        return None, "numero_convenio_invalido"
    numero, letra, ano = m.groups()
    ano_completo = int(ano) + 2000 if len(ano) == 2 else int(ano)
    sufixo = f"-{letra.upper()}" if letra else ""
    return f"{int(numero):03d}{sufixo}/{ano_completo}", None


_CODIGO = re.compile(r"^\d{1,6}$")


def codigo(valor: Any) -> Resultado:
    if ausente(valor):
        return None, None
    if isinstance(valor, bool):
        return None, "codigo_invalido"
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    if isinstance(valor, int):
        texto = str(valor)
    elif isinstance(valor, str):
        texto = "".join(valor.split()).lstrip("'")
    else:
        return None, "codigo_invalido"
    if not _CODIGO.match(texto):
        return None, "codigo_invalido"
    return texto.zfill(6), None


def data(valor: Any) -> Resultado:
    if ausente(valor):
        return None, None
    if isinstance(valor, datetime):
        return valor.date(), None
    if isinstance(valor, date):
        return valor, None
    return None, "valor_invalido"


_NUMERO_SIMPLES = re.compile(r"^-?\d+(\.\d+)?$")
# Formato brasileiro: vírgula decimal obrigatória, ponto de milhar opcional ("1.234,56", "31,5").
_NUMERO_PT_BR = re.compile(r"^-?(\d{1,3}(\.\d{3})+|\d+),\d+$")


def numero(valor: Any) -> Resultado:
    if ausente(valor):
        return None, None
    if isinstance(valor, bool) or isinstance(valor, (datetime, date)):
        return None, "valor_invalido"
    if isinstance(valor, (int, float)):
        return Decimal(_numero_texto(valor)), None
    texto = "".join(str(valor).split())
    if _NUMERO_PT_BR.match(texto):
        texto = texto.replace(".", "").replace(",", ".")
    if _NUMERO_SIMPLES.match(texto):
        try:
            return Decimal(texto), None
        except InvalidOperation:
            pass
    return None, "valor_invalido"


def inteiro(valor: Any) -> Resultado:
    tratado, motivo = numero(valor)
    if tratado is None:
        return None, motivo
    if tratado != tratado.to_integral_value():
        return None, "valor_invalido"
    return int(tratado), None


_FUNCOES: dict[Papel, Callable[[Any], Resultado]] = {
    Papel.ROTULO: rotulo,
    Papel.LIVRE: livre,
    Papel.BOOLEANO: booleano,
    Papel.MUNICIPIO: municipio,
    Papel.NUMERO_CONVENIO: numero_convenio,
    Papel.CODIGO: codigo,
    Papel.DATA: data,
    Papel.NUMERO: numero,
    Papel.INTEIRO: inteiro,
}


def tratar(coluna: Coluna, valor: Any) -> Resultado:
    if coluna.papel is Papel.CATEGORIA:
        return categoria(valor, coluna.vocabulario)
    return _FUNCOES[coluna.papel](valor)


# --------------------------------------------------------------------------- regras de aba

# Deslocamento nas abas 342/ACOMPANHAMENTO: coluna lógica <- coluna física quando H tem data.
_DESLOCAMENTO = {"H": None, "I": "H", "J": "I", "K": "J"}


def _aviso(aba: Aba, coordenada: str, coluna: str, motivo: str, valor: Any) -> dict:
    return {"aba": aba.nome, "celula": coordenada, "coluna": coluna, "motivo": motivo, "valor": original(valor)}


def transformar_aba(aba: Aba, linhas: list[LinhaCrua]) -> tuple[list[dict], list[dict]]:
    """Aplica papéis e regras da aba. Devolve (linhas prontas para inserir, avisos)."""
    avisos: list[dict] = []
    saida: list[dict] = []
    identificacao = [c for c in aba.colunas if c.identificacao]
    principal: dict[str, Any] | None = None
    anterior: dict[str, Any] = {}  # valores tratados da linha anterior (município mesclado)

    for crua in linhas:
        registro: dict[str, Any] = {"linha": crua.linha, "linha_principal": True}
        if aba.bloco_extra:
            registro["bloco"] = crua.bloco

        origem = {c.letra: c.letra for c in aba.colunas}
        if aba.deslocamento_h_k:
            h = crua.celulas["H"].valor
            deslocada = isinstance(h, (datetime, date))
            registro["colunas_corrigidas"] = deslocada
            if deslocada:
                origem.update(_DESLOCAMENTO)
                k = crua.celulas["K"]
                if not ausente(k.valor):
                    avisos.append(_aviso(aba, k.coordenada, "prestacao_contas", "deslocamento_inesperado", k.valor))

        tratados: dict[str, Any] = {}
        for coluna in aba.colunas:
            fonte = origem[coluna.letra]
            celula = crua.celulas[fonte] if fonte else None
            valor = celula.valor if celula else None
            tratado, motivo = tratar(coluna, valor)
            if aba.municipio_mesclado and coluna.papel is Papel.MUNICIPIO and celula and celula.mesclada:
                tratado = anterior.get(coluna.letra)
            if motivo and not coluna.repete:
                avisos.append(_aviso(aba, celula.coordenada, coluna.nome, motivo, valor))
            tratados[coluna.letra] = tratado

        if aba.continuacao_por_item:
            item = aba.coluna("item")
            if tratados[item.letra] is None:
                if principal is None:
                    raise ErroLayout(
                        f"Aba '{aba.nome}', linha {crua.linha}: linha de continuação (sem Item) antes de "
                        "qualquer linha com Item"
                    )
                registro["linha_principal"] = False
                for coluna in identificacao:
                    if tratados[coluna.letra] is None:
                        tratados[coluna.letra] = principal[coluna.letra]
            else:
                principal = {c.letra: tratados[c.letra] for c in identificacao}

        for coluna in aba.colunas:
            if not coluna.repete:
                continue
            repetido, original_ = tratados[coluna.letra], tratados[coluna.repete]
            if repetido is not None and original_ is not None and repetido != original_:
                avisos.append(
                    _aviso(
                        aba,
                        crua.celulas[coluna.letra].coordenada,
                        coluna.nome,
                        "repeticao_divergente",
                        f"{original(repetido)} != {original(original_)} ({crua.celulas[coluna.repete].coordenada})",
                    )
                )

        registro.update({c.nome: tratados[c.letra] for c in aba.colunas if not c.repete})
        saida.append(registro)
        anterior = tratados

    return saida, avisos
