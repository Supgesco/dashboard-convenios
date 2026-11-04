"""Endpoints /painel: leitura da visão gerencial da carteira de convênios.

O router só valida a entrada e monta o JSON; as somas estão em app.painel.consultas.
"""

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Connection, Engine

from app.etl.siafe import hoje_sp
from app.painel import consultas as Q
from app.painel.municipios import normalizar_municipios
from app.routers.etl import get_engine

router = APIRouter(prefix="/painel", tags=["painel"])

Recorte = Literal["31", "89", "342"]


def get_hoje() -> date:
    return hoje_sp()


# --- modelos de resposta ---


class Mes(BaseModel):
    ano: int
    mes: int


class Saldos(BaseModel):
    a_pagar: float | None
    a_comprovar: float | None
    a_aprovar: float | None
    aprovados: float | None


class Cobertura(BaseModel):
    vinculado: Saldos
    total_siafe: Saldos


class SiafeResumo(Saldos):
    mes_anterior: Saldos | None
    cobertura: Cobertura | None


class Contratual(BaseModel):
    valor_total: float | None
    repasse_estado: float | None
    contrapartida: float | None
    investido_estado: float | None
    a_repassar: float | None
    execucao_pct: float | None


class Contagem(BaseModel):
    valor: str | None
    convenios: int


class Situacao(BaseModel):
    status: list[Contagem]
    situacao_vigencia: list[Contagem]


class Referencia(BaseModel):
    ano: int
    mes: int
    posicao_siafe_em: datetime | None
    planilha_importada_em: datetime | None
    arquivo: str | None
    ultimo_mes_disponivel: Mes | None


class Resumo(BaseModel):
    recorte: Recorte
    municipios: list[str]
    convenios: int
    referencia: Referencia
    siafe: SiafeResumo | None
    contratual: Contratual | None
    situacao: Situacao | None


class PontoSerie(Saldos):
    ano: int
    mes: int


class Serie(BaseModel):
    recorte: Recorte
    municipios: list[str]
    pontos: list[PontoSerie]


class LinhaMunicipio(Saldos, Contratual):
    municipio: str
    convenios: int
    codigo_compartilhado: bool


class Municipios(BaseModel):
    recorte: Recorte
    ano: int
    mes: int
    municipios: list[str]
    itens: list[LinhaMunicipio]


class LinhaConvenio(Saldos, Contratual):
    numero_convenio: str
    municipio: str
    status: str | None
    fase: str
    codigo_seobras: str | None
    codigo_seiop: str | None
    codigo_compartilhado: bool


class Convenios(BaseModel):
    recorte: Recorte
    ano: int
    mes: int
    municipios: list[str]
    itens: list[LinhaConvenio]


# --- parâmetros ---


def get_filtro(
    recorte: Annotated[Recorte, Query(description="31 vigentes, 89 primeiro repasse, 342 histórico")] = "31",
    municipio: Annotated[list[str] | None, Query(description="Repetível; sem ele, todos")] = None,
) -> Q.Filtro:
    municipios, invalidos = normalizar_municipios(municipio or [])
    if invalidos:
        raise HTTPException(
            status_code=422,
            detail={"msg": "Município não reconhecido", "municipios_invalidos": invalidos},
        )
    return Q.Filtro(recorte, municipios)


def get_mes(
    hoje: Annotated[date, Depends(get_hoje)],
    ano: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    mes: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> tuple[int, int]:
    if (ano is None) != (mes is None):
        raise HTTPException(status_code=422, detail="Informe ano e mes juntos, ou nenhum dos dois")
    if ano is None:
        return hoje.year, hoje.month
    return ano, mes


FiltroDep = Annotated[Q.Filtro, Depends(get_filtro)]
MesDep = Annotated[tuple[int, int], Depends(get_mes)]
EngineDep = Annotated[Engine, Depends(get_engine)]


def _saldos(conn: Connection, filtro: Q.Filtro, ano: int, mes: int) -> Saldos | None:
    if not Q.mes_tem_dados(conn, ano, mes):
        return None
    return Saldos(**Q.saldos(conn, filtro, ano, mes))


# --- endpoints ---


@router.get("/resumo", response_model=Resumo)
def resumo(filtro: FiltroDep, referencia: MesDep, engine: EngineDep):
    ano, mes = referencia
    with engine.connect() as conn:
        datas = Q.datas_cargas(conn)
        ultimo = Q.ultimo_mes(conn)
        siafe = None
        atual = _saldos(conn, filtro, ano, mes)
        if atual is not None:
            cobertura = None
            if not filtro.municipios:
                cobertura = Cobertura(
                    vinculado=atual, total_siafe=Saldos(**Q.saldos_total_siafe(conn, ano, mes))
                )
            siafe = SiafeResumo(
                **atual.model_dump(),
                mes_anterior=_saldos(conn, filtro, *Q.mes_anterior(ano, mes)),
                cobertura=cobertura,
            )
        contratual = situacao = None
        if filtro.recorte == "342":
            situacao = Situacao(**Q.situacao(conn, filtro))
        else:
            contratual = Contratual(**Q.contratual(conn, filtro))
        convenios = Q.contar_convenios(conn, filtro)

    return Resumo(
        recorte=filtro.recorte,
        municipios=filtro.municipios or [],
        convenios=convenios,
        referencia=Referencia(
            ano=ano,
            mes=mes,
            posicao_siafe_em=datas.posicao_siafe_em,
            planilha_importada_em=datas.planilha_importada_em,
            arquivo=datas.arquivo,
            ultimo_mes_disponivel=Mes(ano=ultimo[0], mes=ultimo[1]) if ultimo else None,
        ),
        siafe=siafe,
        contratual=contratual,
        situacao=situacao,
    )


@router.get("/serie", response_model=Serie)
def serie(filtro: FiltroDep, engine: EngineDep):
    with engine.connect() as conn:
        pontos = Q.serie(conn, filtro)
    return Serie(recorte=filtro.recorte, municipios=filtro.municipios or [], pontos=pontos)


@router.get("/municipios", response_model=Municipios)
def municipios(filtro: FiltroDep, referencia: MesDep, engine: EngineDep):
    ano, mes = referencia
    with engine.connect() as conn:
        itens = Q.ranking_municipios(conn, filtro, ano, mes)
    return Municipios(recorte=filtro.recorte, ano=ano, mes=mes, municipios=filtro.municipios or [], itens=itens)


@router.get("/convenios", response_model=Convenios)
def convenios(filtro: FiltroDep, referencia: MesDep, engine: EngineDep):
    ano, mes = referencia
    with engine.connect() as conn:
        itens = Q.lista_convenios(conn, filtro, ano, mes)
    return Convenios(recorte=filtro.recorte, ano=ano, mes=mes, municipios=filtro.municipios or [], itens=itens)
