"""Layout declarativo da planilha: abas, tabelas, colunas, papéis e regras de fim.

É a única fonte do mapeamento planilha -> banco. Os modelos (`app.models`), a
extração e a transformação saem daqui. Quando uma revisão da planilha mudar de
estrutura, o ajuste é aqui (e numa migration nova).
"""

from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from openpyxl.utils import column_index_from_string, get_column_letter


class Papel(StrEnum):
    ROTULO = "rotulo"
    LIVRE = "livre"
    CATEGORIA = "categoria"
    BOOLEANO = "booleano"
    MUNICIPIO = "municipio"
    NUMERO_CONVENIO = "numero_convenio"
    CODIGO = "codigo"
    DATA = "data"
    NUMERO = "numero"
    INTEIRO = "inteiro"


class TipoFim(StrEnum):
    PRIMEIRA_VAZIA = "primeira_vazia"  # termina na 1ª linha totalmente vazia
    MARCADOR = "marcador"  # termina na linha cuja coluna A começa com o texto (obrigatória)
    COLUNA_VAZIA = "coluna_vazia"  # termina na 1ª linha em que a coluna indicada está vazia
    ULTIMA_NAO_VAZIA = "ultima_nao_vazia"  # vai até a última linha da aba


@dataclass(frozen=True)
class Fim:
    tipo: TipoFim
    valor: str | None = None  # texto do marcador ou letra da coluna


@dataclass(frozen=True)
class Coluna:
    letra: str
    nome: str
    papel: Papel
    cabecalho: str | None  # None: a célula de cabeçalho deve estar vazia
    vocabulario: str | None = None  # só para Papel.CATEGORIA
    identificacao: bool = False  # herdada da linha principal nas linhas de continuação
    repete: str | None = None  # letra da coluna original; a coluna não é gravada


@dataclass(frozen=True)
class BlocoExtra:
    """Segundo bloco na mesma aba: linha de título + cabeçalho repetido + dados."""

    titulo: str
    fim: Fim


@dataclass(frozen=True)
class Aba:
    nome: str  # nome normalizado (ver normalizar_nome_aba)
    tabela: str
    linha_cabecalho: int
    primeira_linha: int
    fim: Fim
    colunas: tuple[Coluna, ...]
    cabecalhos_extras: tuple[tuple[str, str], ...] = ()  # (coordenada, texto) de linhas de grupo
    bloco_extra: BlocoExtra | None = None
    continuacao_por_item: bool = False
    deslocamento_h_k: bool = False
    municipio_mesclado: bool = False

    @property
    def ultima_coluna(self) -> int:
        return max(column_index_from_string(c.letra) for c in self.colunas)

    def coluna(self, nome: str) -> Coluna:
        return next(c for c in self.colunas if c.nome == nome)


COLUNAS_CONTROLE = frozenset({"id", "importacao_id", "linha", "linha_principal", "bloco", "colunas_corrigidas"})


def normalizar_nome_aba(nome: str) -> str:
    return " ".join(nome.split())


def normalizar_cabecalho(texto: object) -> str:
    if texto is None:
        return ""
    return " ".join(str(texto).split()).casefold()


# --------------------------------------------------------------------------- helpers

P = Papel
_Spec = tuple  # (nome, papel, cabecalho[, opções])


def _seq(inicio: str, specs: Iterable[_Spec]) -> list[Coluna]:
    """Colunas consecutivas a partir da letra `inicio`."""
    base = column_index_from_string(inicio)
    saida = []
    for i, spec in enumerate(specs):
        nome, papel, cabecalho, *resto = spec
        opcoes = resto[0] if resto else {}
        saida.append(Coluna(get_column_letter(base + i), nome, papel, cabecalho, **opcoes))
    return saida


ID = {"identificacao": True}

_VALORES_INICIAIS: list[_Spec] = [
    ("valor_total_inicial", P.NUMERO, "Valor Total Convênio (Inicial)"),
    ("repasse_inicial", P.NUMERO, "Repasse (Concedente)"),
    ("contrapartida_inicial", P.NUMERO, "Aporte Contrapartida (Convenente)"),
    ("parcelas_inicial", P.INTEIRO, "Nº Parcelas"),
    ("cronograma_repasse_inicial", P.NUMERO, "Cronograma de Repasse R$"),
    ("parcelas_repassadas_inicial", P.INTEIRO, "Nº Parcelas Repassadas"),
    ("valor_repassado_inicial", P.NUMERO, "Valor Repassado (Concedente)"),
    ("contrapartida_aportada_inicial", P.NUMERO, "Valor Aportado Contrapartida (Anterior ao Realinhamento)"),
]

_VALORES_REALINHADOS: list[_Spec] = [
    ("valor_total_realinhado", P.NUMERO, "Valor Total Convênio (Realinhado)"),
    ("repasse_realinhado", P.NUMERO, "Repasse (Concedente)"),
    ("contrapartida_realinhado", P.NUMERO, "Aporte Contrapartida (Convenente)"),
    ("parcelas_realinhado", P.INTEIRO, "Nº Parcelas"),
    ("cronograma_repasse_realinhado", P.NUMERO, "Cronograma de Repasse (R$)"),
    ("cronograma_contrapartida_realinhado", P.NUMERO, "Cronograma de Contrapartida (R$)"),
    ("parcelas_repassadas_realinhado", P.INTEIRO, "Nº de Parcelas Repassadas"),
    ("execucao_financeira", P.NUMERO, "Execução Financeira (R$)"),
    ("execucao_fisica", P.NUMERO, "Execução Física (%)"),
]


def _colunas_geral(cabecalho_tomada_contas: str) -> list[Coluna]:
    """Colunas das abas 342 Convênios e ACOMPANHAMENTO ESPECIAL (mesmo layout)."""
    parcelas = [(f"processo_parcela_{n:02d}", P.LIVRE, f"{n}ª Parc.") for n in range(1, 11)]
    return _seq(
        "A",
        [
            ("chave_planilha", P.ROTULO, None),
            ("municipio", P.MUNICIPIO, "MUNICÍPIO"),
            ("numero_convenio", P.NUMERO_CONVENIO, "Nº CONVÊNIO"),
            ("codigo_seobras", P.CODIGO, "Nº SIAFEM"),
            ("codigo_seiop", P.CODIGO, "Nº SIAFE"),
            ("objeto", P.LIVRE, "OBJETO"),
            ("status_convenio", P.CATEGORIA, "STATUS CONVÊNIO", {"vocabulario": "status_convenio"}),
            ("realinhado", P.BOOLEANO, "Realinhado"),
            ("vigencia_final", P.DATA, "Vigencia Final"),
            ("situacao_vigencia", P.CATEGORIA, "Situação Vigência", {"vocabulario": "situacao_vigencia"}),
            ("prestacao_contas", P.LIVRE, "Prestação de Contas"),
            ("processo_unica", P.LIVRE, "Única"),
            ("processo_celebracao", P.LIVRE, "Celebração"),
            *parcelas,
            ("processo_devolucao_meta", P.LIVRE, "Consolidada devolução de meta"),
            ("processo_tomada_contas", P.LIVRE, cabecalho_tomada_contas),
            ("processo_sei_arvore", P.LIVRE, 'Processo Digital (SEI "Árvore")'),
            ("processo_pagamento", P.LIVRE, "Processo de Pagamento (SEI)"),
            ("observacao", P.LIVRE, "OBSERVAÇÃO:"),
        ],
    )


# --------------------------------------------------------------------------- abas

CONVENIOS_GERAL = Aba(
    nome="342 Convênios",
    tabela="planilha_convenios_geral",
    linha_cabecalho=2,
    primeira_linha=3,
    fim=Fim(TipoFim.PRIMEIRA_VAZIA),
    colunas=tuple(_colunas_geral("Tomada de Contas / Final / Cancelamento")),
    deslocamento_h_k=True,
)

CONVENIOS_TRANSFERIDOS = Aba(
    nome="89 Convênios",
    tabela="planilha_convenios_transferidos",
    linha_cabecalho=3,
    primeira_linha=4,
    fim=Fim(TipoFim.MARCADOR, "Total Geral"),
    cabecalhos_extras=(
        ("A2", "CELEBRAÇÃO"),
        ("M2", "HOMOLOGAÇÃO ANTERIOR AO REALINHAMENTO"),
        ("U2", "HOMOLOGADO - REALINHAMENTO"),
    ),
    continuacao_por_item=True,
    colunas=tuple(
        _seq(
            "A",
            [
                ("item", P.INTEIRO, "Item", ID),
                ("processo_celebracao", P.LIVRE, "Processo Celebração", ID),
                ("municipio", P.MUNICIPIO, "Municipio", ID),
                ("numero_convenio", P.NUMERO_CONVENIO, "Nº do Convênio Original", ID),
                ("codigo_seobras", P.CODIGO, "Nº do Convênio SIAFE - SEOBRAS", ID),
                ("codigo_seiop", P.CODIGO, "Nº do Convênio SIAFE - SEIOP", ID),
                ("objeto", P.LIVRE, "Objeto", ID),
                ("realinhado", P.BOOLEANO, "Realinhado", ID),
                ("vigencia_final", P.DATA, "Vigencia Final", ID),
                ("situacao_vigencia", P.CATEGORIA, "Situação Vigência", {"vocabulario": "situacao_vigencia", **ID}),
                ("status", P.CATEGORIA, "Status", {"vocabulario": "status_transferidos", **ID}),
                ("status_prestacao_contas", P.LIVRE, "Status Prestação de Contas / Repasse", ID),
                *_VALORES_INICIAIS,
                *_VALORES_REALINHADOS,
                ("parcelas_a_repassar", P.INTEIRO, "Nº Parcelas a Repassar"),
                ("valor_a_repassar", P.NUMERO, "Valor Total a Repassar"),
                ("valor_investido_seiop", P.NUMERO, "Valor Total Investido SEIOP"),
                ("total_investido_estado", P.NUMERO, "Total Geral Investido (Estado)"),
                ("coluna_ah", P.LIVRE, None),
                ("observacao", P.LIVRE, "Observação"),
            ],
        )
    ),
)

CONVENIOS_VIGENTES = Aba(
    nome="31 Convênios Vigentes 2025",
    tabela="planilha_convenios_vigentes",
    linha_cabecalho=3,
    primeira_linha=4,
    fim=Fim(TipoFim.MARCADOR, "Total Geral"),
    cabecalhos_extras=(("A2", "CELEBRAÇÃO"), ("L2", "HOMOLOGAÇÃO ANTERIOR AO REALINHAMENTO")),
    continuacao_por_item=True,
    colunas=tuple(
        _seq(
            "A",
            [
                ("item", P.INTEIRO, "Item", ID),
                ("processo_celebracao", P.LIVRE, "Processo Celebração", ID),
                ("processo_pagamento", P.LIVRE, "Processo de Pagamento", ID),
                ("municipio", P.MUNICIPIO, "Municipio", ID),
                ("numero_convenio", P.NUMERO_CONVENIO, "Nº do Convênio Original", ID),
                ("codigo_seobras", P.CODIGO, "Nº do Convênio SIAFE - SEOBRAS", ID),
                ("codigo_seiop", P.CODIGO, "Nº do Convênio SIAFE - SEIOP", ID),
                ("objeto", P.LIVRE, "Objeto", ID),
                ("situacao", P.CATEGORIA, "Situação", {"vocabulario": "situacao_vigentes", **ID}),
                ("vigencia_final", P.DATA, "Vigencia", ID),
                ("andamento", P.CATEGORIA, None, {"vocabulario": "andamento_vigentes", **ID}),
                ("item_homologacao", P.INTEIRO, "Item"),
                ("municipio_repetido", P.MUNICIPIO, "Municipio", {"repete": "D"}),
                ("numero_convenio_repetido", P.NUMERO_CONVENIO, "Nº do Convênio Original", {"repete": "E"}),
                *_VALORES_INICIAIS,
                ("municipio_repetido_2", P.MUNICIPIO, "Municipio", {"repete": "D"}),
                *_VALORES_REALINHADOS,
                ("parcelas_a_repassar", P.INTEIRO, "Nº Parcelas a Repassar"),
                ("valor_a_repassar", P.NUMERO, "Valor Total a Repassar"),
                ("total_investido", P.NUMERO, "Total Geral Investido"),
                ("observacao", P.LIVRE, "Observação"),
                ("proximo_repasse", P.NUMERO, "Próximo Repasse"),
            ],
        )
    ),
)

PRESTACAO_CONTAS = Aba(
    nome="Prest de Contas Conv_Execução",
    tabela="planilha_prestacao_contas",
    linha_cabecalho=3,
    primeira_linha=4,
    fim=Fim(TipoFim.ULTIMA_NAO_VAZIA),
    continuacao_por_item=True,
    colunas=tuple(
        _seq(
            "A",
            [
                ("item", P.INTEIRO, "Item", ID),
                ("municipio", P.MUNICIPIO, "Municipio", ID),
                ("cnpj", P.ROTULO, "CNPJ", ID),
                ("numero_convenio", P.NUMERO_CONVENIO, "Nº do Convênio Original", ID),
                ("codigo_seobras", P.CODIGO, "Nº do Convênio SIAFE - SEOBRAS", ID),
                ("codigo_seiop", P.CODIGO, "Nº do Convênio SIAFE - SEIOP", ID),
                ("parcela", P.INTEIRO, "Parcela"),
                ("valor_repasse", P.NUMERO, "Valor de Repasse"),
                ("processo", P.LIVRE, "Processo"),
                ("valor_executado", P.NUMERO, "Valor Executado no Período (Repasse Concedente)"),
                ("baixa_apresentacao", P.LIVRE, "Baixa por Apresentação/Comprovação"),
                ("baixa_aprovacao", P.LIVRE, "Baixa por Aprovação"),
                ("observacao", P.LIVRE, "OBSERVAÇÃO"),
                ("situacao", P.CATEGORIA, "Situação", {"vocabulario": "situacao_prestacao"}),
                ("coluna_o", P.NUMERO, None),
            ],
        )
    ),
)

REALINHADO_SEM_EXECUCAO = Aba(
    nome="Realinhado sem Exec_Expirado",
    tabela="planilha_realinhado_sem_execucao",
    linha_cabecalho=3,
    primeira_linha=4,
    fim=Fim(TipoFim.PRIMEIRA_VAZIA),
    colunas=tuple(
        _seq(
            "A",
            [
                ("item", P.INTEIRO, "Item"),
                ("processo_celebracao", P.LIVRE, "Processo Celebração"),
                ("municipio", P.MUNICIPIO, "Municipio"),
                ("numero_convenio", P.NUMERO_CONVENIO, "Original"),
                ("codigo_seobras", P.CODIGO, "Nº do Convênio SIAFE - SEOBRAS"),
                ("codigo_seiop", P.CODIGO, "Nº do Convênio SIAFE - SEIOP"),
                ("objeto", P.LIVRE, "Objeto"),
                ("situacao", P.CATEGORIA, "Situação", {"vocabulario": "situacao_realinhado"}),
                ("vigencia_final", P.DATA, "Vigencia"),
                *_VALORES_INICIAIS,
                *_VALORES_REALINHADOS,
                ("valor_a_repassar", P.NUMERO, "Valor Total a Repassar"),
                ("total_investido", P.NUMERO, "Total Geral Investido"),
                ("observacao", P.LIVRE, "Observação"),
            ],
        )
    ),
)

NAO_REALINHADO_EXPIRADO = Aba(
    nome="Não Realinhado Expirado",
    tabela="planilha_nao_realinhado_expirado",
    linha_cabecalho=1,
    primeira_linha=2,
    fim=Fim(TipoFim.PRIMEIRA_VAZIA),
    colunas=tuple(
        _seq(
            "A",
            [
                ("item", P.INTEIRO, "Item"),
                ("processo_celebracao", P.LIVRE, "Processo Celebração"),
                ("municipio", P.MUNICIPIO, "Municipio"),
                ("numero_convenio", P.NUMERO_CONVENIO, "Nº do Convênio Original"),
                ("codigo_seobras", P.CODIGO, "Nº do Convênio SIAFE - SEOBRAS"),
                ("codigo_seiop", P.CODIGO, "Nº do Convênio SIAFE - SEIOP"),
                ("objeto", P.LIVRE, "Objeto"),
                ("situacao", P.CATEGORIA, "Situação", {"vocabulario": "situacao_nao_realinhado"}),
                ("vigencia_final", P.DATA, "Vigencia"),
                ("repasse", P.NUMERO, "Repasse (R$)"),
                ("data_repasse", P.DATA, "Data Repasse"),
            ],
        )
    ),
)

TOMADA_CONTAS = Aba(
    nome="Tomada de Contas",
    tabela="planilha_tomada_contas",
    linha_cabecalho=3,
    primeira_linha=4,
    fim=Fim(TipoFim.PRIMEIRA_VAZIA),
    bloco_extra=BlocoExtra(titulo="TOMADA DE CONTAS", fim=Fim(TipoFim.COLUNA_VAZIA, "E")),
    municipio_mesclado=True,
    colunas=tuple(
        _seq(
            "A",
            [
                ("municipio", P.MUNICIPIO, "MUNICÍPIOS"),
                ("numero_convenio", P.NUMERO_CONVENIO, "CONVÊNIO"),
                ("codigo_seobras", P.CODIGO, "SIAFE"),
                ("valor_siafe", P.NUMERO, "VALOR SIAFE"),
                ("objeto", P.LIVRE, "OBJETO"),
                ("parecer_comissao", P.LIVRE, "PARECER DA COMISSÃO"),
                ("processo_sei", P.LIVRE, "PROCESSO / SEI"),
                ("status", P.LIVRE, "STATUS"),
            ],
        )
    ),
)

ACOMPANHAMENTO_ESPECIAL = Aba(
    nome="ACOMPANHAMENTO ESPECIAL",
    tabela="planilha_acompanhamento_especial",
    linha_cabecalho=2,
    primeira_linha=3,
    fim=Fim(TipoFim.PRIMEIRA_VAZIA),
    colunas=tuple(_colunas_geral("Tomada de Contas / Final Cancelamento")),
    deslocamento_h_k=True,
)

ABAS: tuple[Aba, ...] = (
    CONVENIOS_GERAL,
    CONVENIOS_TRANSFERIDOS,
    CONVENIOS_VIGENTES,
    PRESTACAO_CONTAS,
    REALINHADO_SEM_EXECUCAO,
    NAO_REALINHADO_EXPIRADO,
    TOMADA_CONTAS,
    ACOMPANHAMENTO_ESPECIAL,
)

# Abas reconhecidas e não importadas (podem faltar no arquivo).
ABAS_IGNORADAS: frozenset[str] = frozenset({"Planilha2"})
