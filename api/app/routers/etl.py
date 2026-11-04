import logging
from collections.abc import Callable
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import Engine, func, select

from app.etl import siafe as etl
from app.models import EtlExecucao

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/etl", tags=["etl"])


def get_engine() -> Engine:
    from app.db import engine

    return engine


def get_executor() -> Callable[[Engine, etl.Reserva], int]:
    return etl.executar


class ExecucaoIniciada(BaseModel):
    execucao_id: int
    status: str


class ExecucaoStatus(BaseModel):
    id: int
    origem: str
    status: str
    inicio: datetime
    fim: datetime | None
    registros: int | None
    erro: str | None


class Execucoes(BaseModel):
    pagina: int
    tamanho: int
    total: int
    itens: list[ExecucaoStatus]


def _rodar(executor: Callable[[Engine, etl.Reserva], int], engine: Engine, reserva: etl.Reserva) -> None:
    try:
        executor(engine, reserva)
    except Exception:
        # O erro já foi gravado em etl_execucao; aqui só registramos o tipo.
        logger.exception("Carga SIAFE %s falhou", reserva.execucao_id)


@router.post(
    "/siafe",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ExecucaoIniciada,
    responses={409: {"description": "Já existe uma carga em andamento"}},
)
def disparar_carga_siafe(
    background: BackgroundTasks,
    engine: Annotated[Engine, Depends(get_engine)],
    executor: Annotated[Callable[[Engine, etl.Reserva], int], Depends(get_executor)],
):
    try:
        reserva = etl.reservar(engine, origem="http")
    except etl.CargaEmAndamento as e:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "Já existe uma carga SIAFE em andamento", "execucao_id": e.execucao_id},
        )
    background.add_task(_rodar, executor, engine, reserva)
    return ExecucaoIniciada(execucao_id=reserva.execucao_id, status="em_andamento")


@router.get("/siafe/status", response_model=ExecucaoStatus)
def status_carga_siafe(engine: Annotated[Engine, Depends(get_engine)]):
    with engine.connect() as conn:
        ultima = conn.execute(select(EtlExecucao).order_by(EtlExecucao.id.desc()).limit(1)).first()
    if ultima is None:
        raise HTTPException(status_code=404, detail="Nenhuma carga SIAFE executada ainda")
    return ExecucaoStatus.model_validate(ultima, from_attributes=True)


@router.get("/siafe/execucoes", response_model=Execucoes)
def historico_cargas_siafe(
    engine: Annotated[Engine, Depends(get_engine)],
    pagina: Annotated[int, Query(ge=1, description="A partir de 1")] = 1,
    tamanho: Annotated[int, Query(ge=1, le=100, description="Itens por página")] = 20,
):
    """Execuções de carga SIAFE, da mais recente para a mais antiga."""
    with engine.connect() as conn:
        total = conn.scalar(select(func.count()).select_from(EtlExecucao))
        linhas = conn.execute(
            select(EtlExecucao).order_by(EtlExecucao.id.desc()).limit(tamanho).offset((pagina - 1) * tamanho)
        ).all()
    return Execucoes(
        pagina=pagina,
        tamanho=tamanho,
        total=total,
        itens=[ExecucaoStatus.model_validate(l, from_attributes=True) for l in linhas],
    )
