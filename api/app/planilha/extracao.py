"""Extração: abre o xlsx, valida o layout e devolve as linhas cruas de cada aba.

Não converte nem limpa valores (isso é da transformação). Erros de layout são
fatais (`ErroLayout`); a única sujeira de conteúdo detectada aqui é fórmula sem
valor calculado, que vira aviso.
"""

import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.utils.exceptions import InvalidFileException
from openpyxl.worksheet.worksheet import Worksheet

from app.planilha.layout import ABAS, ABAS_IGNORADAS, Aba, Fim, TipoFim, normalizar_cabecalho, normalizar_nome_aba


class ErroPlanilha(Exception):
    """Arquivo inexistente, ilegível ou fora do layout esperado."""


class ErroArquivo(ErroPlanilha):
    pass


class ErroLayout(ErroPlanilha):
    pass


@dataclass(frozen=True)
class Celula:
    valor: Any
    coordenada: str
    mesclada: bool = False  # parte não superior de uma mescla vertical


@dataclass
class LinhaCrua:
    linha: int
    bloco: int
    celulas: dict[str, Celula]  # letra -> célula


@dataclass
class Extracao:
    linhas: dict[str, list[LinhaCrua]]  # nome da aba -> linhas
    avisos: list[dict] = field(default_factory=list)


def _vazio(valor: Any) -> bool:
    return valor is None or (isinstance(valor, str) and not valor.strip())


def _abrir(caminho: Path, data_only: bool) -> openpyxl.Workbook:
    try:
        return openpyxl.load_workbook(caminho, data_only=data_only)
    except FileNotFoundError:
        raise ErroArquivo(f"Arquivo não encontrado: {caminho.name}") from None
    except (InvalidFileException, zipfile.BadZipFile, KeyError, OSError) as e:
        raise ErroArquivo(f"Não foi possível ler {caminho.name} como xlsx: {type(e).__name__}") from None


def _identificar_abas(wb: openpyxl.Workbook) -> dict[str, Worksheet]:
    por_nome = {normalizar_nome_aba(ws.title): ws for ws in wb.worksheets}
    esperadas = {aba.nome for aba in ABAS}
    faltando = sorted(esperadas - por_nome.keys())
    desconhecidas = sorted(por_nome.keys() - esperadas - ABAS_IGNORADAS)
    if faltando or desconhecidas:
        partes = []
        if faltando:
            partes.append(f"abas faltando: {', '.join(faltando)}")
        if desconhecidas:
            partes.append(f"abas desconhecidas: {', '.join(desconhecidas)}")
        raise ErroLayout("Planilha fora do layout esperado (" + "; ".join(partes) + ")")
    return {nome: ws for nome, ws in por_nome.items() if nome in esperadas}


def _conferir_texto(aba: Aba, ws: Worksheet, coordenada: str, esperado: str | None) -> None:
    encontrado = ws[coordenada].value
    if normalizar_cabecalho(encontrado) != normalizar_cabecalho(esperado):
        raise ErroLayout(
            f"Aba '{aba.nome}', célula {coordenada}: cabeçalho esperado {esperado or '(vazio)'!r}, "
            f"encontrado {encontrado if encontrado is not None else '(vazio)'!r}"
        )


def _conferir_cabecalho(aba: Aba, ws: Worksheet, linha: int) -> None:
    for coluna in aba.colunas:
        _conferir_texto(aba, ws, f"{coluna.letra}{linha}", coluna.cabecalho)


def _mescladas_verticais(ws: Worksheet) -> set[str]:
    """Coordenadas das células não superiores de mesclas verticais."""
    saida = set()
    for faixa in ws.merged_cells.ranges:
        if faixa.max_row > faixa.min_row:
            for linha in range(faixa.min_row + 1, faixa.max_row + 1):
                for col in range(faixa.min_col, faixa.max_col + 1):
                    saida.add(f"{get_column_letter(col)}{linha}")
    return saida


def _linha_vazia(ws: Worksheet, linha: int) -> bool:
    return all(_vazio(c.value) for c in ws[linha])


def _faixa(aba: Aba, ws: Worksheet, inicio: int, fim: Fim) -> tuple[list[int], int]:
    """Linhas de dados (sem as vazias) e a linha onde a faixa terminou (exclusiva)."""
    ultima = ws.max_row
    linhas = []
    linha = inicio
    while linha <= ultima:
        vazia = _linha_vazia(ws, linha)
        if fim.tipo is TipoFim.PRIMEIRA_VAZIA and vazia:
            return linhas, linha
        if fim.tipo is TipoFim.MARCADOR and normalizar_cabecalho(ws[f"A{linha}"].value).startswith(
            normalizar_cabecalho(fim.valor)
        ):
            return linhas, linha
        if fim.tipo is TipoFim.COLUNA_VAZIA and _vazio(ws[f"{fim.valor}{linha}"].value):
            return linhas, linha
        if not vazia:
            linhas.append(linha)
        linha += 1
    if fim.tipo is TipoFim.MARCADOR:
        raise ErroLayout(f"Aba '{aba.nome}': linha de fim dos dados ({fim.valor!r} na coluna A) não encontrada")
    return linhas, ultima + 1


def _faixas(aba: Aba, ws: Worksheet) -> list[tuple[int, list[int]]]:
    """(bloco, linhas) de cada bloco de dados da aba."""
    linhas, parou = _faixa(aba, ws, aba.primeira_linha, aba.fim)
    blocos = [(1, linhas)]
    if aba.bloco_extra:
        titulo = parou
        while titulo <= ws.max_row and _linha_vazia(ws, titulo):
            titulo += 1
        if titulo > ws.max_row or normalizar_cabecalho(ws[f"A{titulo}"].value) != normalizar_cabecalho(
            aba.bloco_extra.titulo
        ):
            raise ErroLayout(
                f"Aba '{aba.nome}': título do 2º bloco ({aba.bloco_extra.titulo!r}) não encontrado na coluna A "
                f"depois da linha {parou}"
            )
        _conferir_cabecalho(aba, ws, titulo + 1)
        linhas2, _ = _faixa(aba, ws, titulo + 2, aba.bloco_extra.fim)
        blocos.append((2, linhas2))
    return blocos


def _extrair_aba(aba: Aba, ws: Worksheet, ws_formulas: Worksheet, avisos: list[dict]) -> list[LinhaCrua]:
    _conferir_cabecalho(aba, ws, aba.linha_cabecalho)
    for coordenada, texto in aba.cabecalhos_extras:
        _conferir_texto(aba, ws, coordenada, texto)

    mescladas = _mescladas_verticais(ws)
    ultima_coluna = aba.ultima_coluna
    saida = []
    for bloco, linhas in _faixas(aba, ws):
        for linha in linhas:
            for celula in ws[linha][ultima_coluna:]:
                if not _vazio(celula.value):
                    raise ErroLayout(
                        f"Aba '{aba.nome}', célula {celula.coordinate}: valor fora das colunas do layout "
                        f"(última coluna esperada: {get_column_letter(ultima_coluna)})"
                    )
            celulas = {}
            for coluna in aba.colunas:
                coord = f"{coluna.letra}{linha}"
                valor = ws[coord].value
                formula = ws_formulas[coord].value
                if valor is None and isinstance(formula, str) and formula.startswith("="):
                    avisos.append(
                        {"aba": aba.nome, "celula": coord, "coluna": coluna.nome,
                         "motivo": "formula_sem_valor", "valor": formula}
                    )
                celulas[coluna.letra] = Celula(valor, coord, coord in mescladas)
            saida.append(LinhaCrua(linha=linha, bloco=bloco, celulas=celulas))
    return saida


def extrair(caminho: Path) -> Extracao:
    """Lê e valida as abas importadas. Levanta ErroArquivo/ErroLayout."""
    caminho = Path(caminho)
    if not caminho.is_file():
        raise ErroArquivo(f"Arquivo não encontrado: {caminho.name}")
    wb = _abrir(caminho, data_only=True)
    wb_formulas = _abrir(caminho, data_only=False)

    abas_ws = _identificar_abas(wb)
    formulas_ws = {normalizar_nome_aba(ws.title): ws for ws in wb_formulas.worksheets}
    avisos: list[dict] = []
    linhas = {aba.nome: _extrair_aba(aba, abas_ws[aba.nome], formulas_ws[aba.nome], avisos) for aba in ABAS}
    return Extracao(linhas=linhas, avisos=avisos)
