"""cria views do painel gerencial

Views comuns (calculadas na leitura) sobre as views do cruzamento (0003) e as tabelas
planilha_* das abas 31, 89 e 342. Como na 0003, o SQL é literal e as views ficam fora de
Base.metadata. Uma migration futura que alterar uma tabela usada aqui precisa recriá-las.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-04 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (recorte, tabela da aba, coluna de "total investido" da aba).
_ABAS_CONTRATUAIS = [
    ("31", "planilha_convenios_vigentes", "total_investido"),
    ("89", "planilha_convenios_transferidos", "total_investido_estado"),
]

_CONTRATUAL = "\nUNION ALL\n".join(
    f"""SELECT
    '{recorte}'::text AS recorte,
    a.numero_convenio,
    a.municipio,
    CASE WHEN a.realinhado THEN 'realinhado' ELSE 'inicial' END AS base,
    CASE WHEN a.realinhado THEN a.valor_total_realinhado ELSE a.valor_total_inicial END AS valor_total,
    CASE WHEN a.realinhado THEN a.repasse_realinhado ELSE a.repasse_inicial END AS repasse_estado,
    CASE WHEN a.realinhado THEN a.contrapartida_realinhado ELSE a.contrapartida_inicial END AS contrapartida,
    a.investido_estado,
    a.a_repassar
FROM (
    SELECT
        t.numero_convenio,
        t.municipio,
        bool_or(t.valor_total_realinhado IS NOT NULL) AS realinhado,
        sum(t.valor_total_inicial) AS valor_total_inicial,
        sum(t.repasse_inicial) AS repasse_inicial,
        sum(t.contrapartida_inicial) AS contrapartida_inicial,
        sum(t.valor_total_realinhado) AS valor_total_realinhado,
        sum(t.repasse_realinhado) AS repasse_realinhado,
        sum(t.contrapartida_realinhado) AS contrapartida_realinhado,
        sum(t.{investido}) AS investido_estado,
        sum(t.valor_a_repassar) AS a_repassar
    FROM {tabela} t
    JOIN v_recorte_convenio r
        ON r.recorte = '{recorte}' AND r.numero_convenio = t.numero_convenio AND r.municipio = t.municipio
    GROUP BY t.numero_convenio, t.municipio
) a"""
    for recorte, tabela, investido in _ABAS_CONTRATUAIS
)

# (nome, SQL), na ordem de criação; o downgrade remove na ordem inversa.
VIEWS: list[tuple[str, str]] = [
    # Convênios de cada recorte (31 ⊂ 89 ⊂ 342), com status e situação da linha da 342.
    (
        "v_recorte_convenio",
        """
SELECT r.recorte, c.numero_convenio, c.municipio, c.status, g.situacao_vigencia, c.fase
FROM v_convenio c
JOIN planilha_convenios_geral g ON g.linha = c.linha
CROSS JOIN LATERAL (
    VALUES ('31'::text, c.fase = 'vigente'),
           ('89'::text, c.fase IN ('vigente', 'realinhado')),
           ('342'::text, true)
) AS r (recorte, pertence)
WHERE r.pertence
""",
    ),
    # Valores contratuais por convênio nos recortes 31 e 89, cada um da sua aba, somando
    # todas as linhas da chave. Realinhado ou inicial é escolhido uma vez por convênio.
    ("v_valor_contratual", _CONTRATUAL),
]


def upgrade() -> None:
    for nome, sql in VIEWS:
        op.execute(f"CREATE VIEW {nome} AS\n{sql.strip()}")


def downgrade() -> None:
    for nome, _ in reversed(VIEWS):
        op.execute(f"DROP VIEW {nome}")
