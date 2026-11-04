from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, Numeric, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

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
