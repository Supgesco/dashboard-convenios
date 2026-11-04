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
]


def upgrade() -> None:
    for nome, sql in VIEWS:
        op.execute(f"CREATE VIEW {nome} AS\n{sql.strip()}")


def downgrade() -> None:
    for nome, _ in reversed(VIEWS):
        op.execute(f"DROP VIEW {nome}")
