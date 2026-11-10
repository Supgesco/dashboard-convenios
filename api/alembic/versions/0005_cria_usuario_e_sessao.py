"""cria usuario e sessao (login do painel)

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-10 16:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("cargo", sa.Text(), nullable=True),
        sa.Column("orgao", sa.Text(), nullable=True),
        sa.Column("perfil", sa.String(20), nullable=False),
        sa.Column("senha_hash", sa.Text(), nullable=False),
        sa.Column("ativo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("falhas_consecutivas", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("bloqueado_ate", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ux_usuario_email", "usuario", [sa.text("lower(email)")], unique=True)
    op.create_table(
        "sessao",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "usuario_id", sa.Integer(), sa.ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("criada_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expira_em", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessao_usuario_id", "sessao", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_sessao_usuario_id", table_name="sessao")
    op.drop_table("sessao")
    op.drop_index("ux_usuario_email", table_name="usuario")
    op.drop_table("usuario")
