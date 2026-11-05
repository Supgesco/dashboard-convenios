"""Consultas do painel gerencial sobre as views do cruzamento (0003) e do painel (0004).

Todas as somas são feitas no SQL, com parâmetros nomeados. As regras:
- os saldos do SIAFE somam o conjunto *distinto* de códigos dos convênios selecionados,
  para que um código de dois convênios conte uma vez;
- meses nunca são somados entre si;
- percentuais são quocientes de somas;
- ausência de dado é NULL, nunca zero.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Connection, text

SALDOS = ("a_pagar", "a_comprovar", "a_aprovar", "aprovados")
CONTRATUAIS = ("valor_total", "repasse_estado", "contrapartida", "investido_estado", "a_repassar")

# Campos aceitos em `ordem` (com `-` na frente para decrescente). O ORDER BY é montado só a
# partir destes nomes, que são colunas da consulta externa; o texto recebido nunca entra no SQL.
ORDEM_RANKING = ("municipio", "convenios", *SALDOS, *CONTRATUAIS, "execucao_pct", "investido_sobre_total_pct")
ORDEM_LISTA = ("numero_convenio", "municipio", "status", "fase", *SALDOS, *CONTRATUAIS, "execucao_pct", "investido_sobre_total_pct")


@dataclass(frozen=True)
class Pagina:
    pagina: int = 1
    tamanho: int = 20
    ordem: str | None = None  # "campo" ou "-campo"; None: ordem padrão


@dataclass(frozen=True)
class Paginado:
    itens: list[dict]
    total: int


def campo_de_ordem(ordem: str | None, permitidos: tuple[str, ...]) -> tuple[str, bool] | None:
    """(campo, decrescente) se `ordem` é válida; None se é inválida. `ordem` vazia vira o padrão."""
    if not ordem:
        return ("", False)
    decrescente = ordem.startswith("-")
    campo = ordem[1:] if decrescente else ordem
    return (campo, decrescente) if campo in permitidos else None


def _paginar(
    conn: Connection,
    base: str,
    params: dict,
    pagina: Pagina,
    permitidos: tuple[str, ...],
    desempate: tuple[str, ...],
) -> Paginado:
    """Ordena o conjunto inteiro, corta a página e conta o total na mesma consulta."""
    escolha = campo_de_ordem(pagina.ordem, permitidos)
    if escolha is None:
        raise ValueError(f"ordem inválida: {pagina.ordem!r}")
    campo, decrescente = escolha
    ordem = [f"b.{campo} {'DESC' if decrescente else 'ASC'} NULLS LAST"] if campo else []
    ordem += [f"b.{c}" for c in desempate]
    sql = f"""
SELECT b.*, count(*) OVER () AS _total
FROM ({base}) b
ORDER BY {", ".join(ordem)}
LIMIT :_tamanho OFFSET :_offset
"""
    linhas = _todas(
        conn,
        sql,
        {**params, "_tamanho": pagina.tamanho, "_offset": (pagina.pagina - 1) * pagina.tamanho},
    )
    if linhas:
        total = linhas[0]["_total"]
    else:  # página além do fim: a janela não tem linha para trazer o total
        total = conn.scalar(text(f"SELECT count(*) FROM ({base}) b"), params)
    for linha in linhas:
        del linha["_total"]
    return Paginado(itens=linhas, total=total)


@dataclass(frozen=True)
class Filtro:
    recorte: str
    municipios: list[str] | None = None  # None ou vazio: sem filtro

    def params(self) -> dict:
        return {"recorte": self.recorte, "municipios": self.municipios or None}


# Convênios do recorte e do filtro. `:municipios` NULL significa sem filtro.
_CONV = """
conv AS (
    SELECT numero_convenio, municipio
    FROM v_recorte_convenio
    WHERE recorte = :recorte
      AND (CAST(:municipios AS text[]) IS NULL OR municipio = ANY(CAST(:municipios AS text[])))
)"""

# Códigos distintos desses convênios.
_COD = """
cod AS (
    SELECT DISTINCT cc.codigo
    FROM v_convenio_codigo cc
    JOIN conv USING (numero_convenio, municipio)
)"""

_SOMA_SALDOS = """
    round(sum(s.convenios_a_pagar), 2) AS a_pagar,
    round(sum(s.convenios_a_comprovar), 2) AS a_comprovar,
    round(sum(s.convenios_a_aprovar), 2) AS a_aprovar,
    round(sum(s.convenios_aprovados), 2) AS aprovados"""

_SOMA_CONTRATUAIS = """
    round(sum(v.valor_total), 2) AS valor_total,
    round(sum(v.repasse_estado), 2) AS repasse_estado,
    round(sum(v.contrapartida), 2) AS contrapartida,
    round(sum(v.investido_estado), 2) AS investido_estado,
    round(sum(v.a_repassar), 2) AS a_repassar,
    round(100 * sum(v.investido_estado) / nullif(sum(v.repasse_estado), 0), 2) AS execucao_pct,
    round(100 * sum(v.investido_estado) / nullif(sum(v.valor_total), 0), 2) AS investido_sobre_total_pct"""


def _uma(conn: Connection, sql: str, params: dict) -> dict:
    return dict(conn.execute(text(sql), params).mappings().one())


def _todas(conn: Connection, sql: str, params: dict) -> list[dict]:
    return [dict(r) for r in conn.execute(text(sql), params).mappings()]


def mes_anterior(ano: int, mes: int) -> tuple[int, int]:
    return (ano - 1, 12) if mes == 1 else (ano, mes - 1)


def mes_tem_dados(conn: Connection, ano: int, mes: int) -> bool:
    return bool(
        conn.scalar(
            text("SELECT EXISTS (SELECT 1 FROM siafe_flexvision WHERE ano = :ano AND mes = :mes)"),
            {"ano": ano, "mes": mes},
        )
    )


def ultimo_mes(conn: Connection) -> tuple[int, int] | None:
    linha = conn.execute(
        text("SELECT ano, mes FROM siafe_flexvision ORDER BY ano DESC, mes DESC LIMIT 1")
    ).first()
    return (linha.ano, linha.mes) if linha else None


def contar_convenios(conn: Connection, filtro: Filtro) -> int:
    return conn.scalar(text(f"WITH {_CONV} SELECT count(*) FROM conv"), filtro.params())


def _sql_saldos(conv: str) -> str:
    """Os 4 saldos do mês sobre os códigos distintos dos convênios do CTE `conv`."""
    return f"""
WITH {conv}, {_COD}
SELECT {_SOMA_SALDOS}
FROM siafe_flexvision s
JOIN cod ON cod.codigo = s.conta_corrente
WHERE s.ano = :ano AND s.mes = :mes
"""


def _sql_serie(conv: str) -> str:
    """Os 4 saldos de cada mês carregado, sobre os códigos distintos do CTE `conv`."""
    return f"""
WITH {conv}, {_COD},
meses AS (SELECT DISTINCT ano, mes FROM siafe_flexvision)
SELECT m.ano, m.mes, {_SOMA_SALDOS}
FROM meses m
LEFT JOIN (siafe_flexvision s JOIN cod ON cod.codigo = s.conta_corrente)
    ON s.ano = m.ano AND s.mes = m.mes
GROUP BY m.ano, m.mes
ORDER BY m.ano, m.mes
"""


def saldos(conn: Connection, filtro: Filtro, ano: int, mes: int) -> dict[str, Decimal | None]:
    """Os 4 saldos do mês sobre os códigos distintos do recorte e do filtro."""
    return _uma(conn, _sql_saldos(_CONV), {**filtro.params(), "ano": ano, "mes": mes})


def saldos_total_siafe(conn: Connection, ano: int, mes: int) -> dict[str, Decimal | None]:
    """Os 4 saldos de todas as contas do SIAFE no mês, com ou sem convênio."""
    sql = f"SELECT {_SOMA_SALDOS} FROM siafe_flexvision s WHERE s.ano = :ano AND s.mes = :mes"
    return _uma(conn, sql, {"ano": ano, "mes": mes})


def contratual(conn: Connection, filtro: Filtro) -> dict[str, Decimal | None]:
    """Valores contratuais somados (recortes 31 e 89) e o percentual de execução."""
    sql = f"""
WITH {_CONV}
SELECT {_SOMA_CONTRATUAIS}
FROM v_valor_contratual v
JOIN conv USING (numero_convenio, municipio)
WHERE v.recorte = :recorte
"""
    return _uma(conn, sql, filtro.params())


STATUS_VIGENTE = "Vigente"
STATUS_VIGENCIA_NAO_CONFIRMADA = "Vigência não confirmada"

# Status usado na contagem. A coluna de status da planilha histórica (342) fica desatualizada:
# marca como "Vigente" convênios que já saíram do último repasse. Por isso, na contagem, vigente é
# estar no recorte 31 (Vigentes), qualquer que seja o status escrito; quem a planilha marca como
# "Vigente" mas não está nos 31 vira "Vigência não confirmada". Os demais status ficam como estão.
_STATUS_EFETIVO = """
CASE
    WHEN EXISTS (
        SELECT 1 FROM v_recorte_convenio v
        WHERE v.recorte = '31' AND v.numero_convenio = r.numero_convenio AND v.municipio = r.municipio
    ) THEN :_vigente
    WHEN r.status = :_vigente THEN :_nao_confirmada
    ELSE r.status
END"""


def situacao(conn: Connection, filtro: Filtro) -> dict[str, list[dict]]:
    """Contagem de convênios por status (ver `_STATUS_EFETIVO`) e por situação da vigência (nulo é um grupo)."""
    params = {**filtro.params(), "_vigente": STATUS_VIGENTE, "_nao_confirmada": STATUS_VIGENCIA_NAO_CONFIRMADA}
    resultado = {}
    for coluna, expressao in (("status", _STATUS_EFETIVO), ("situacao_vigencia", "r.situacao_vigencia")):
        sql = f"""
WITH {_CONV}, base AS (
    SELECT {expressao} AS valor
    FROM v_recorte_convenio r
    JOIN conv USING (numero_convenio, municipio)
    WHERE r.recorte = :recorte
)
SELECT valor, count(*) AS convenios
FROM base
GROUP BY valor
ORDER BY count(*) DESC, valor NULLS LAST
"""
        resultado[coluna] = _todas(conn, sql, params)
    return resultado


def serie(conn: Connection, filtro: Filtro) -> list[dict]:
    """Os 4 saldos de cada mês carregado no SIAFE, em ordem cronológica."""
    return _todas(conn, _sql_serie(_CONV), filtro.params())


def ranking_municipios(
    conn: Connection, filtro: Filtro, ano: int, mes: int, pagina: Pagina = Pagina()
) -> Paginado:
    """Uma linha por município: convênios, saldos (códigos distintos no município) e contratuais.

    Paginado e ordenado por `pagina` (campos em ORDEM_RANKING), com desempate por município.

    `codigo_compartilhado` indica que algum código do município também é de convênio de outro
    município do conjunto, e por isso a soma das linhas pode passar do total do resumo.
    """
    sql = f"""
WITH {_CONV},
cod_mun AS (
    SELECT DISTINCT conv.municipio, cc.codigo
    FROM v_convenio_codigo cc
    JOIN conv USING (numero_convenio, municipio)
),
compartilhado AS (
    SELECT codigo FROM cod_mun GROUP BY codigo HAVING count(*) > 1
),
saldo AS (
    SELECT c.municipio, {_SOMA_SALDOS}
    FROM cod_mun c
    JOIN siafe_flexvision s ON s.conta_corrente = c.codigo AND s.ano = :ano AND s.mes = :mes
    GROUP BY c.municipio
),
contr AS (
    SELECT conv.municipio, {_SOMA_CONTRATUAIS}
    FROM v_valor_contratual v
    JOIN conv USING (numero_convenio, municipio)
    WHERE v.recorte = :recorte
    GROUP BY conv.municipio
)
SELECT
    m.municipio,
    m.convenios,
    EXISTS (
        SELECT 1 FROM cod_mun c JOIN compartilhado x USING (codigo) WHERE c.municipio = m.municipio
    ) AS codigo_compartilhado,
    sa.a_pagar, sa.a_comprovar, sa.a_aprovar, sa.aprovados,
    ct.valor_total, ct.repasse_estado, ct.contrapartida, ct.investido_estado, ct.a_repassar, ct.execucao_pct,
    ct.investido_sobre_total_pct
FROM (SELECT municipio, count(*) AS convenios FROM conv GROUP BY municipio) m
LEFT JOIN saldo sa USING (municipio)
LEFT JOIN contr ct USING (municipio)
"""
    params = {**filtro.params(), "ano": ano, "mes": mes}
    return _paginar(conn, sql, params, pagina, ORDEM_RANKING, ("municipio",))


def lista_convenios(
    conn: Connection, filtro: Filtro, ano: int, mes: int, pagina: Pagina = Pagina()
) -> Paginado:
    """Uma linha por convênio, com códigos, saldos do mês e valores contratuais.

    Paginada e ordenada por `pagina` (campos em ORDEM_LISTA), com desempate por município e número.

    `codigo_compartilhado` indica que algum código do convênio também é de outro convênio
    do conjunto.
    """
    sql = f"""
WITH {_CONV},
cod_conv AS (
    SELECT cc.numero_convenio, cc.municipio, cc.codigo
    FROM v_convenio_codigo cc
    JOIN conv USING (numero_convenio, municipio)
),
compartilhado AS (
    SELECT codigo FROM cod_conv GROUP BY codigo HAVING count(*) > 1
)
SELECT
    r.numero_convenio,
    r.municipio,
    r.status,
    r.fase,
    c.codigo_seobras,
    c.codigo_seiop,
    EXISTS (
        SELECT 1 FROM cod_conv x JOIN compartilhado y USING (codigo)
        WHERE x.numero_convenio = r.numero_convenio AND x.municipio = r.municipio
    ) AS codigo_compartilhado,
    round(s.convenios_a_pagar, 2) AS a_pagar,
    round(s.convenios_a_comprovar, 2) AS a_comprovar,
    round(s.convenios_a_aprovar, 2) AS a_aprovar,
    round(s.convenios_aprovados, 2) AS aprovados,
    round(v.valor_total, 2) AS valor_total,
    round(v.repasse_estado, 2) AS repasse_estado,
    round(v.contrapartida, 2) AS contrapartida,
    round(v.investido_estado, 2) AS investido_estado,
    round(v.a_repassar, 2) AS a_repassar,
    round(100 * v.investido_estado / nullif(v.repasse_estado, 0), 2) AS execucao_pct,
    round(100 * v.investido_estado / nullif(v.valor_total, 0), 2) AS investido_sobre_total_pct
FROM v_recorte_convenio r
JOIN conv USING (numero_convenio, municipio)
JOIN v_convenio c USING (numero_convenio, municipio)
LEFT JOIN v_convenio_saldo s
    ON s.numero_convenio = r.numero_convenio AND s.municipio = r.municipio AND s.ano = :ano AND s.mes = :mes
LEFT JOIN v_valor_contratual v
    ON v.recorte = r.recorte AND v.numero_convenio = r.numero_convenio AND v.municipio = r.municipio
WHERE r.recorte = :recorte
"""
    params = {**filtro.params(), "ano": ano, "mes": mes}
    return _paginar(conn, sql, params, pagina, ORDEM_LISTA, ("municipio", "numero_convenio"))


# --- detalhe de um convênio (chave já normalizada) ---

# CTE `conv` com um único convênio, no lugar de _CONV. A chave pode não existir: aí `cod`
# fica vazio e as somas, nulas.
_CONV_UM = """
conv AS (SELECT CAST(:numero AS text) AS numero_convenio, CAST(:municipio AS text) AS municipio)"""


def convenio(conn: Connection, numero: str, municipio: str) -> dict | None:
    """Identificação do convênio, com a linha da 342 e os recortes; None se a chave não existe."""
    sql = """
SELECT
    c.numero_convenio,
    c.municipio,
    c.fase,
    c.status,
    g.situacao_vigencia,
    g.vigencia_final,
    g.objeto,
    c.codigo_seobras,
    c.codigo_seiop,
    ARRAY(
        SELECT r.recorte FROM v_recorte_convenio r
        WHERE r.numero_convenio = c.numero_convenio AND r.municipio = c.municipio
        ORDER BY r.recorte::int
    ) AS recortes
FROM v_convenio c
JOIN planilha_convenios_geral g ON g.linha = c.linha
WHERE c.numero_convenio = :numero AND c.municipio = :municipio
"""
    linha = conn.execute(text(sql), {"numero": numero, "municipio": municipio}).mappings().first()
    return dict(linha) if linha else None


def compartilhamentos(conn: Connection, numero: str, municipio: str) -> list[dict]:
    """Os outros convênios que têm algum código em comum com este, com o código."""
    sql = """
SELECT o.numero_convenio, o.municipio, o.codigo
FROM v_convenio_codigo m
JOIN v_convenio_codigo o
    ON o.codigo = m.codigo AND (o.numero_convenio, o.municipio) <> (m.numero_convenio, m.municipio)
WHERE m.numero_convenio = :numero AND m.municipio = :municipio
ORDER BY o.municipio, o.numero_convenio, o.codigo
"""
    return _todas(conn, sql, {"numero": numero, "municipio": municipio})


def saldos_convenio(conn: Connection, numero: str, municipio: str, ano: int, mes: int) -> dict[str, Decimal | None]:
    """Os 4 saldos do convênio no mês, com cada código contado uma vez."""
    return _uma(conn, _sql_saldos(_CONV_UM), {"numero": numero, "municipio": municipio, "ano": ano, "mes": mes})


def serie_convenio(conn: Connection, numero: str, municipio: str) -> list[dict]:
    """Os 4 saldos do convênio em cada mês carregado no SIAFE, em ordem cronológica."""
    return _todas(conn, _sql_serie(_CONV_UM), {"numero": numero, "municipio": municipio})


def contratual_convenio(conn: Connection, numero: str, municipio: str) -> list[dict]:
    """Um bloco de valores contratuais por aba de recorte (31, 89) em que o convênio está."""
    sql = """
SELECT
    v.recorte,
    round(v.valor_total, 2) AS valor_total,
    round(v.repasse_estado, 2) AS repasse_estado,
    round(v.contrapartida, 2) AS contrapartida,
    round(v.investido_estado, 2) AS investido_estado,
    round(v.a_repassar, 2) AS a_repassar,
    round(100 * v.investido_estado / nullif(v.repasse_estado, 0), 2) AS execucao_pct,
    round(100 * v.investido_estado / nullif(v.valor_total, 0), 2) AS investido_sobre_total_pct
FROM v_valor_contratual v
WHERE v.numero_convenio = :numero AND v.municipio = :municipio
ORDER BY v.recorte::int
"""
    return _todas(conn, sql, {"numero": numero, "municipio": municipio})


@dataclass(frozen=True)
class DatasCargas:
    posicao_siafe_em: datetime | None
    planilha_importada_em: datetime | None
    arquivo: str | None


def datas_cargas(conn: Connection) -> DatasCargas:
    """Fim da última carga SIAFE e da última importação da planilha com sucesso."""
    siafe = conn.scalar(text("SELECT max(fim) FROM etl_execucao WHERE status = 'sucesso'"))
    planilha = conn.execute(
        text(
            "SELECT fim, arquivo FROM planilha_importacao WHERE status = 'sucesso' "
            "ORDER BY id DESC LIMIT 1"
        )
    ).first()
    return DatasCargas(
        posicao_siafe_em=siafe,
        planilha_importada_em=planilha.fim if planilha else None,
        arquivo=planilha.arquivo if planilha else None,
    )
