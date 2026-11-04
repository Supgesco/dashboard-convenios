from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.planilha.layout import ABAS, Aba, Papel

Dinheiro = Numeric(18, 2)


class EtlExecucao(Base):
    """Registro de cada execução de carga (sobrevive ao rollback dos dados)."""

    __tablename__ = "etl_execucao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    origem: Mapped[str] = mapped_column(String(10))  # "cli" | "http"
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20))  # "em_andamento" | "sucesso" | "falha"
    registros: Mapped[int | None] = mapped_column(Integer)
    erro: Mapped[str | None] = mapped_column(Text)


class SiafeFlexvision(Base):
    """Linhas da consulta FlexVision do SIAFE (substituídas integralmente a cada carga)."""

    __tablename__ = "siafe_flexvision"
    __table_args__ = (Index("ix_siafe_flexvision_ano_mes", "ano", "mes"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    execucao_id: Mapped[int] = mapped_column(ForeignKey("etl_execucao.id"))
    ano: Mapped[int] = mapped_column(SmallInteger)
    mes: Mapped[int] = mapped_column(SmallInteger)
    ug: Mapped[str] = mapped_column(Text)
    ug_nome: Mapped[str] = mapped_column(Text)
    conta_corrente: Mapped[str] = mapped_column(Text)
    conta_contabil: Mapped[str] = mapped_column(Text)
    conta_contabil_nome: Mapped[str] = mapped_column(Text)
    credor: Mapped[str | None] = mapped_column(Text)
    credor_nome: Mapped[str | None] = mapped_column(Text)
    convenios_a_pagar: Mapped[Decimal] = mapped_column(Dinheiro)
    convenios_a_comprovar: Mapped[Decimal] = mapped_column(Dinheiro)
    convenios_a_aprovar: Mapped[Decimal] = mapped_column(Dinheiro)
    convenios_aprovados: Mapped[Decimal] = mapped_column(Dinheiro)


class PlanilhaImportacao(Base):
    """Registro de cada execução do ETL da planilha (sobrevive ao rollback dos dados)."""

    __tablename__ = "planilha_importacao"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20))  # "em_andamento" | "sucesso" | "falha"
    arquivo: Mapped[str] = mapped_column(Text)  # só o nome do arquivo, sem o caminho
    sha256: Mapped[str] = mapped_column(String(64))
    linhas_por_aba: Mapped[dict | None] = mapped_column(JSONB)
    total_avisos: Mapped[int | None] = mapped_column(Integer)
    avisos_por_motivo: Mapped[dict | None] = mapped_column(JSONB)
    avisos: Mapped[list | None] = mapped_column(JSONB)
    erro: Mapped[str | None] = mapped_column(Text)


_TIPO_SQL = {
    Papel.ROTULO: Text,
    Papel.LIVRE: Text,
    Papel.CATEGORIA: Text,
    Papel.MUNICIPIO: Text,
    Papel.NUMERO_CONVENIO: Text,
    Papel.CODIGO: Text,
    Papel.BOOLEANO: Boolean,
    Papel.DATA: Date,
    Papel.NUMERO: Numeric,
    Papel.INTEIRO: Integer,
}


def _tabela_planilha(aba: Aba) -> Table:
    colunas = [
        Column("id", BigInteger, primary_key=True),
        Column("importacao_id", Integer, ForeignKey("planilha_importacao.id"), nullable=False),
        Column("linha", Integer, nullable=False),
        Column("linha_principal", Boolean, nullable=False),
    ]
    if aba.bloco_extra:
        colunas.append(Column("bloco", SmallInteger, nullable=False))
    if aba.deslocamento_h_k:
        colunas.append(Column("colunas_corrigidas", Boolean, nullable=False))
    colunas += [Column(c.nome, _TIPO_SQL[c.papel]()) for c in aba.colunas if not c.repete]
    return Table(aba.tabela, Base.metadata, *colunas)


# Tabelas normalizadas da planilha, uma por aba, geradas a partir do layout.
TABELAS_PLANILHA: dict[str, Table] = {aba.nome: _tabela_planilha(aba) for aba in ABAS}
