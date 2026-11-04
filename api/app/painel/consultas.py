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
    round(100 * sum(v.investido_estado) / nullif(sum(v.repasse_estado), 0), 2) AS execucao_pct"""


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


def saldos(conn: Connection, filtro: Filtro, ano: int, mes: int) -> dict[str, Decimal | None]:
    """Os 4 saldos do mês sobre os códigos distintos do recorte e do filtro."""
    sql = f"""
WITH {_CONV}, {_COD}
SELECT {_SOMA_SALDOS}
FROM siafe_flexvision s
JOIN cod ON cod.codigo = s.conta_corrente
WHERE s.ano = :ano AND s.mes = :mes
"""
    return _uma(conn, sql, {**filtro.params(), "ano": ano, "mes": mes})


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


def situacao(conn: Connection, filtro: Filtro) -> dict[str, list[dict]]:
    """Contagem de convênios por status e por situação da vigência (nulo é um grupo)."""
    resultado = {}
    for coluna in ("status", "situacao_vigencia"):
        sql = f"""
WITH {_CONV}
SELECT r.{coluna} AS valor, count(*) AS convenios
FROM v_recorte_convenio r
JOIN conv USING (numero_convenio, municipio)
WHERE r.recorte = :recorte
GROUP BY r.{coluna}
ORDER BY count(*) DESC, r.{coluna} NULLS LAST
"""
        resultado[coluna] = _todas(conn, sql, filtro.params())
    return resultado


def serie(conn: Connection, filtro: Filtro) -> list[dict]:
    """Os 4 saldos de cada mês carregado no SIAFE, em ordem cronológica."""
    sql = f"""
WITH {_CONV}, {_COD},
meses AS (SELECT DISTINCT ano, mes FROM siafe_flexvision)
SELECT m.ano, m.mes, {_SOMA_SALDOS}
FROM meses m
LEFT JOIN (siafe_flexvision s JOIN cod ON cod.codigo = s.conta_corrente)
    ON s.ano = m.ano AND s.mes = m.mes
GROUP BY m.ano, m.mes
ORDER BY m.ano, m.mes
"""
    return _todas(conn, sql, filtro.params())


def ranking_municipios(conn: Connection, filtro: Filtro, ano: int, mes: int) -> list[dict]:
    """Uma linha por município: convênios, saldos (códigos distintos no município) e contratuais.

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
    ct.valor_total, ct.repasse_estado, ct.contrapartida, ct.investido_estado, ct.a_repassar, ct.execucao_pct
FROM (SELECT municipio, count(*) AS convenios FROM conv GROUP BY municipio) m
LEFT JOIN saldo sa USING (municipio)
LEFT JOIN contr ct USING (municipio)
ORDER BY m.municipio
"""
    return _todas(conn, sql, {**filtro.params(), "ano": ano, "mes": mes})


def lista_convenios(conn: Connection, filtro: Filtro, ano: int, mes: int) -> list[dict]:
    """Uma linha por convênio, com códigos, saldos do mês e valores contratuais.

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
    round(100 * v.investido_estado / nullif(v.repasse_estado, 0), 2) AS execucao_pct
FROM v_recorte_convenio r
JOIN conv USING (numero_convenio, municipio)
JOIN v_convenio c USING (numero_convenio, municipio)
LEFT JOIN v_convenio_saldo s
    ON s.numero_convenio = r.numero_convenio AND s.municipio = r.municipio AND s.ano = :ano AND s.mes = :mes
LEFT JOIN v_valor_contratual v
    ON v.recorte = r.recorte AND v.numero_convenio = r.numero_convenio AND v.municipio = r.municipio
WHERE r.recorte = :recorte
ORDER BY r.municipio, r.numero_convenio
"""
    return _todas(conn, sql, {**filtro.params(), "ano": ano, "mes": mes})


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
