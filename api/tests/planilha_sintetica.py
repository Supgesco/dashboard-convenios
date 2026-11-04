"""Gera uma planilha sintética com o layout da planilha geral de convênios.

Valores fictícios (só os nomes de município são reais, por serem públicos).
Reproduz o que importa para o ETL: títulos, cabeçalhos de 1 e 2 linhas, nomes
de aba com espaços, mesclas verticais, linhas de continuação, linhas vazias,
totais e quadros-resumo, 2º bloco da Tomada de Contas, colunas deslocadas e
valores sujos. Parâmetros geram variações inválidas para os testes de layout.
"""

from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.worksheet.worksheet import Worksheet

from app.planilha import layout as L

TITULOS = {
    L.CONVENIOS_GERAL.nome: "342 Convênios ",
    L.CONVENIOS_TRANSFERIDOS.nome: "89 Convênios ",
    L.CONVENIOS_VIGENTES.nome: "31 Convênios Vigentes  2025",
    L.PRESTACAO_CONTAS.nome: "Prest de Contas Conv_Execução  ",
    L.REALINHADO_SEM_EXECUCAO.nome: "Realinhado sem Exec_Expirado",
    L.NAO_REALINHADO_EXPIRADO.nome: "Não Realinhado Expirado  ",
    L.TOMADA_CONTAS.nome: "Tomada de Contas ",
    L.ACOMPANHAMENTO_ESPECIAL.nome: "ACOMPANHAMENTO ESPECIAL",
}

# Linhas de dados esperadas por aba (para os testes).
LINHAS_ESPERADAS = {
    L.CONVENIOS_GERAL.nome: [3, 4, 5],
    L.CONVENIOS_TRANSFERIDOS.nome: [4, 5, 6],
    L.CONVENIOS_VIGENTES.nome: [4, 5, 6],
    L.PRESTACAO_CONTAS.nome: [4, 5, 6, 9],
    L.REALINHADO_SEM_EXECUCAO.nome: [4, 5],
    L.NAO_REALINHADO_EXPIRADO.nome: [2, 3],
    L.TOMADA_CONTAS.nome: [4, 5, 6, 10, 11],
    L.ACOMPANHAMENTO_ESPECIAL.nome: [3, 4],
}

D = datetime


def _escrever(ws: Worksheet, linha: int, valores: dict[str, object]) -> None:
    for letra, valor in valores.items():
        ws[f"{letra}{linha}"] = valor


def _cabecalho(ws: Worksheet, aba: L.Aba, linha: int) -> None:
    for c in aba.colunas:
        if c.cabecalho is not None:
            ws[f"{c.letra}{linha}"] = c.cabecalho
    for coord, texto in aba.cabecalhos_extras:
        ws[coord] = texto


def _mesclar(ws: Worksheet, *faixas: str) -> None:
    for faixa in faixas:
        ws.merge_cells(faixa)


def _geral(ws: Worksheet, aba: L.Aba) -> None:
    ws["B1"] = "GOVERNO DO ESTADO (título fictício)"
    _cabecalho(ws, aba, 2)
    ws["D2"] = "Nº\nSIAFEM "  # quebra de linha e espaço no cabeçalho
    # alinhada
    _escrever(ws, 3, {"A": "NITEROI_101_2014", "B": "NITERÓI", "C": "101/2014", "D": 1234, "E": "-",
                      "F": "Obra fictícia A", "G": "Vigente ", "H": "Não ", "I": D(2025, 12, 31),
                      "J": "Expirado", "K": "ok", "M": "E-17/001/1/2014",
                      "N": "E-17/001/2/2014 \nE-17/001/3/2014", "R": "."})
    # deslocada: data em Realinhado
    _escrever(ws, 4, {"A": "RIO_CLARO_102_2014", "B": "RioClaro", "C": "102/2014", "D": 5678, "E": 210001,
                      "F": "Obra fictícia B", "G": "Expirado/Cancelado", "H": D(2023, 12, 31), "I": "vigente "})
    _escrever(ws, 5, {"B": "SÃO J. DO V. DO RIO PRETO", "C": "012/A/2013", "D": "'007695", "E": "210014/ 007645",
                      "F": ";", "G": 22})
    ws["C8"] = "convênios vigentes"  # legenda depois da linha vazia


def _transferidos(ws: Worksheet, aba: L.Aba) -> None:
    ws["A1"] = "GOVERNO DO ESTADO (título fictício)"
    _cabecalho(ws, aba, 3)
    _escrever(ws, 4, {
        "A": "1", "B": "E-17/001/10/2014", "C": "\nAperibé\n", "D": "143/14", "E": "007783", "F": 210044,
        "G": "Obra fictícia C", "H": "Sim ", "I": D(2025, 12, 31), "J": "Vigente ", "K": "Em andamento ",
        "L": "1ª parcela: aprovada", "M": 1000.10, "N": 950, "O": 50.10, "P": 10, "Q": 991879.4210000001, "R": 2,
        "S": 200, "T": 10, "U": 2000, "V": 1900, "W": 100, "X": 1, "Y": 300, "Z": 15, "AA": 1, "AB": 300,
        "AC": 0.92, "AD": 1, "AE": 100, "AF": 1500, "AG": 1700, "AI": "obs fictícia",
    })
    # continuação: faixa extra de parcelas do realinhamento
    _escrever(ws, 5, {"X": 2, "Y": 400, "Z": 20, "AA": 1, "AB": 400})
    _mesclar(ws, "A4:A5", "B4:B5", "C4:C5", "D4:D5", "E4:E5", "G4:G5", "H4:H5", "I4:I5", "J4:J5", "K4:K5",
             "L4:L5", "M4:M5", "N4:N5", "O4:O5", "P4:P5", "Q4:Q5", "U4:U5", "AG4:AG5")
    _escrever(ws, 6, {
        "A": 2, "B": "E-17/001/11/2014", "C": "São J Vale do Rio Preto", "D": "201/14", "E": 7643, "F": "-",
        "G": "Obra fictícia D", "H": "Não", "I": D(2022, 12, 31), "J": "Expirado", "K": "A Realinhar ",
        "M": 500, "Q": "Diversos ", "AC": "Verificar ", "AG": 300,
    })
    _escrever(ws, 7, {"A": "Total Geral Executado ", "M": 1500.10})
    _escrever(ws, 9, {"A": "SOMANDO FORÇAS"})
    _escrever(ws, 10, {"A": "Realinhados", "B": "Total", "C": 45})


def _vigentes(ws: Worksheet, aba: L.Aba, sem_total: bool) -> None:
    ws["A1"] = "GOVERNO DO ESTADO (título fictício)"
    _cabecalho(ws, aba, 3)
    _escrever(ws, 4, {
        "A": "1", "B": "E-17/001/20/2014", "C": "E-17/001/21/2016 ", "D": "Petrópolis ", "E": "138/14",
        "F": "'007695", "G": 210097, "H": "Obra fictícia E", "I": "Vigente / Realinhado ", "J": D(2026, 12, 31),
        "K": "Em Andamento ", "L": "#REF!", "M": "Petrópolis", "N": "138/14", "O": 361506.42, "P": 343431.11,
        "R": 10, "W": "Petrópolis", "X": 431237.07, "AA": 1, "AB": 62227.48, "AK": 49635.39,
    })
    _escrever(ws, 5, {"AA": 7, "AB": 49635.39})
    _mesclar(ws, "A4:A5", "B4:B5", "C4:C5", "D4:D5", "E4:E5", "F4:F5", "G4:G5", "H4:H5", "I4:I5", "J4:J5",
             "K4:K5", "L4:L5", "M4:M5", "N4:N5", "O4:O5", "P4:P5", "R4:R5", "W4:W5", "X4:X5", "AK4:AK5")
    _escrever(ws, 6, {
        "A": 2, "D": "Três Rios", "E": "125/14", "I": "Vigente", "K": "Concluído", "L": 8,
        "M": "Volta Redonda", "N": "125/14", "W": "Três Rios", "AK": "realinhar ",
    })
    if not sem_total:
        _escrever(ws, 7, {"A": "Total Geral ", "O": 999})


def _prestacao(ws: Worksheet, aba: L.Aba) -> None:
    ws["A1"] = "PRESTAÇÃO DE CONTAS"
    _cabecalho(ws, aba, 3)
    _escrever(ws, 4, {"A": 1, "B": "Aperibé", "C": "00.000.000/0001-00", "D": "138/14", "E": "007639",
                      "F": 210097, "G": 1, "H": 34343.11, "I": "E-17/001/30/2014", "J": 34389.08})
    _escrever(ws, 5, {"G": "2", "H": 100, "J": "\n2.036.643,30\n", "K": "2021NP00256", "N": "Não repassado "})
    _escrever(ws, 6, {"G": 3, "J": "Verificar NL", "N": "100%Executado"})
    _mesclar(ws, "A4:A6", "B4:B6", "C4:C6", "D4:D6", "E4:E6", "F4:F6")
    _escrever(ws, 9, {"A": 2, "B": "Japeri", "D": "191/14", "E": "007665", "F": 210099, "G": 1, "H": 10,
                      "N": "Verificar proc.SEI-0001"})


def _realinhado(ws: Worksheet, aba: L.Aba) -> None:
    _cabecalho(ws, aba, 3)
    ws["D3"] = "\nOriginal  "
    _escrever(ws, 4, {"A": "1", "B": "E-17/001/40/2014", "C": "Iguaba Grande", "D": "085/2014", "E": "007697",
                      "F": "007697", "G": "Obra fictícia F", "H": "Realinhado sem execução ", "I": D(2024, 12, 31)})
    _escrever(ws, 5, {"A": "2", "C": "Porciúncula", "D": "202/14", "E": 7676, "F": 210059,
                      "H": "Realinhado e Cancelado ", "I": D(2022, 12, 31)})
    ws["A8"] = "Ação: nota de rodapé fictícia"


def _nao_realinhado(ws: Worksheet, aba: L.Aba, celula_extra: tuple[str, object] | None) -> None:
    _cabecalho(ws, aba, 1)
    _escrever(ws, 2, {"A": "5", "C": "Angra dos Reis ", "D": "143/2014", "E": 7783, "F": 210044,
                      "H": "Não realinhado ", "I": D(2023, 12, 31)})
    _escrever(ws, 3, {"A": "3", "C": "Nova Iguaçu ", "D": "199/2014", "E": "-", "F": 210021,
                      "H": "Não realinhado ", "I": D(2023, 12, 31), "J": 3166377.97, "K": D(2023, 5, 2)})
    ws["A5"] = "Ação: nota de rodapé fictícia"
    if celula_extra:
        ws[celula_extra[0]] = celula_extra[1]


def _tomada(ws: Worksheet, aba: L.Aba) -> None:
    ws["B1"] = "Governo do Estado (título fictício)"
    ws["A2"] = "TOMADA DE CONTAS"
    _cabecalho(ws, aba, 3)
    _escrever(ws, 4, {"A": "ARARUAMA", "B": "065/10", "C": 5889, "D": 684987, "E": "Obra fictícia G",
                      "G": "E-17/001/50/2018", "H": "Finalizado"})
    _escrever(ws, 5, {"A": "MIRACEMA", "B": "218/14", "C": 7663, "D": 113603.18, "E": "Obra fictícia H"})
    _escrever(ws, 6, {"B": "219/14", "C": 7706, "D": 155158.99, "E": "Obra fictícia I"})
    _mesclar(ws, "A5:A6")
    ws["A8"] = "TOMADA DE CONTAS"
    _cabecalho(ws, aba, 9)
    _escrever(ws, 10, {"A": "QUISSAMÃ", "B": "015/10", "C": 6072, "D": 1900000, "E": "Obra fictícia J"})
    _escrever(ws, 11, {"B": "098/14 ", "C": 7680, "D": 122691.42, "E": "Obra fictícia K"})
    _mesclar(ws, "A10:A11")
    _escrever(ws, 12, {"A": 18, "B": 33, "C": 30, "D": 999})  # totais (sem OBJETO)
    ws["A14"] = "Documentação apresentada (nota fictícia)"


def _acompanhamento(ws: Worksheet, aba: L.Aba) -> None:
    ws["B1"] = "GOVERNO DO ESTADO (título fictício)"
    _cabecalho(ws, aba, 2)
    _escrever(ws, 3, {"A": "BUZIOS_186_2014", "B": "ARMAÇÃO DOS BÚZIOS", "C": "186/2014", "D": 7666, "E": 210100,
                      "F": "Obra fictícia L", "G": "Expirado", "H": D(2021, 12, 31), "I": "Expirado"})
    _escrever(ws, 4, {"B": "Saquarema ", "C": "046/10", "D": "-", "E": "-", "G": "Vigente"})
    ws["C9"] = "convênios concluídos"


def gerar(
    destino: Path,
    *,
    omitir: frozenset[str] = frozenset(),
    aba_extra: str | None = None,
    sem_planilha2: bool = False,
    cabecalho: tuple[str, str, str] | None = None,  # (aba, coordenada, texto)
    celula_extra: tuple[str, object] | None = None,  # célula na aba Não Realinhado Expirado
    sem_total_31: bool = False,
) -> Path:
    wb = Workbook()
    wb.remove(wb.active)
    construtores = {
        L.CONVENIOS_GERAL.nome: lambda ws: _geral(ws, L.CONVENIOS_GERAL),
        L.CONVENIOS_TRANSFERIDOS.nome: lambda ws: _transferidos(ws, L.CONVENIOS_TRANSFERIDOS),
        L.CONVENIOS_VIGENTES.nome: lambda ws: _vigentes(ws, L.CONVENIOS_VIGENTES, sem_total_31),
        L.PRESTACAO_CONTAS.nome: lambda ws: _prestacao(ws, L.PRESTACAO_CONTAS),
        L.REALINHADO_SEM_EXECUCAO.nome: lambda ws: _realinhado(ws, L.REALINHADO_SEM_EXECUCAO),
        L.NAO_REALINHADO_EXPIRADO.nome: lambda ws: _nao_realinhado(ws, L.NAO_REALINHADO_EXPIRADO, celula_extra),
        L.TOMADA_CONTAS.nome: lambda ws: _tomada(ws, L.TOMADA_CONTAS),
        L.ACOMPANHAMENTO_ESPECIAL.nome: lambda ws: _acompanhamento(ws, L.ACOMPANHAMENTO_ESPECIAL),
    }
    for nome, construir in construtores.items():
        if nome in omitir:
            continue
        construir(wb.create_sheet(TITULOS[nome]))
        if nome == L.TOMADA_CONTAS.nome and not sem_planilha2:
            ws = wb.create_sheet("Planilha2")
            _escrever(ws, 1, {"A": "Rascunho", "M": "#REF!", "AZ": "fora de qualquer layout"})
    if aba_extra:
        wb.create_sheet(aba_extra)["A1"] = "conteúdo qualquer"
    if cabecalho:
        aba, coord, texto = cabecalho
        wb[TITULOS[aba]][coord] = texto
    wb.save(destino)
    return destino
