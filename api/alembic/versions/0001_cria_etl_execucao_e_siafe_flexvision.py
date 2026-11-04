"""cria etl_execucao e siafe_flexvision

Revision ID: 0001
Revises:
Create Date: 2026-11-03 22:27:50.377863

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DINHEIRO = sa.Numeric(18, 2)


def upgrade() -> None:
    op.create_table(
        "etl_execucao",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("origem", sa.String(10), nullable=False),
        sa.Column("inicio", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("fim", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("registros", sa.Integer(), nullable=True),
        sa.Column("erro", sa.Text(), nullable=True),
    )
    op.create_table(
        "siafe_flexvision",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("execucao_id", sa.Integer(), sa.ForeignKey("etl_execucao.id"), nullable=False),
        sa.Column("ano", sa.SmallInteger(), nullable=False),
        sa.Column("mes", sa.SmallInteger(), nullable=False),
        sa.Column("ug", sa.Text(), nullable=False),
        sa.Column("ug_nome", sa.Text(), nullable=False),
        sa.Column("conta_corrente", sa.Text(), nullable=False),
        sa.Column("conta_contabil", sa.Text(), nullable=False),
        sa.Column("conta_contabil_nome", sa.Text(), nullable=False),
        sa.Column("credor", sa.Text(), nullable=True),
        sa.Column("credor_nome", sa.Text(), nullable=True),
        sa.Column("convenios_a_pagar", DINHEIRO, nullable=False),
        sa.Column("convenios_a_comprovar", DINHEIRO, nullable=False),
        sa.Column("convenios_a_aprovar", DINHEIRO, nullable=False),
        sa.Column("convenios_aprovados", DINHEIRO, nullable=False),
    )
    op.create_index("ix_siafe_flexvision_ano_mes", "siafe_flexvision", ["ano", "mes"])


def downgrade() -> None:
    op.drop_index("ix_siafe_flexvision_ano_mes", table_name="siafe_flexvision")
    op.drop_table("siafe_flexvision")
    op.drop_table("etl_execucao")
