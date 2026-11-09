"""Carga sob demanda da consulta FlexVision do SIAFE, com overwrite atômico.

Fluxo:
1. `reservar()` pega o advisory lock (uma carga por vez, entre processos), marca
   execuções órfãs como falha e cria o registro `em_andamento`.
2. `executar()` extrai todos os meses (2023-01 até o mês corrente) em memória e,
   só então, faz DELETE + INSERT numa única transação. Em qualquer falha os dados
   anteriores ficam intactos e a execução é registrada como `falha`.

CLI: `uv run python -m app.etl.siafe` (a partir de `api/`).
"""

import logging
import sys
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import Connection, Engine, delete, func, insert, select, text, update

from app.config import Settings, get_settings
from app.models import EtlExecucao, SiafeFlexvision
from app.siafe.client import SiafeClient
from app.siafe.transform import transformar

logger = logging.getLogger(__name__)

FUSO = ZoneInfo("America/Sao_Paulo")
INICIO = (2023, 1)
LOCK_ID = 7_310_051  # chave fixa do pg_advisory_lock desta carga
MAX_ERRO = 2000


class CargaEmAndamento(Exception):
    def __init__(self, execucao_id: int | None):
        super().__init__(f"Já existe uma carga SIAFE em andamento (execução {execucao_id})")
        self.execucao_id = execucao_id


@dataclass
class Reserva:
    execucao_id: int
    _lock_conn: Connection

    def liberar(self) -> None:
        try:
            self._lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_ID})
        finally:
            self._lock_conn.close()


def hoje_sp() -> date:
    return datetime.now(FUSO).date()


def periodos(hoje: date) -> list[tuple[int, int]]:
    """Pares (ano, mês) de 2023-01 até o mês de `hoje`, inclusive."""
    ano, mes = INICIO
    saida = []
    while (ano, mes) <= (hoje.year, hoje.month):
        saida.append((ano, mes))
        ano, mes = (ano + 1, 1) if mes == 12 else (ano, mes + 1)
    return saida


def execucao_em_andamento(engine: Engine) -> int | None:
    with engine.connect() as conn:
        return conn.scalar(
            select(EtlExecucao.id).where(EtlExecucao.status == "em_andamento").order_by(EtlExecucao.id.desc()).limit(1)
        )


def reservar(engine: Engine, origem: str) -> Reserva:
    """Pega o lock e cria a execução. Levanta CargaEmAndamento se outra carga roda."""
    lock_conn = engine.connect()
    try:
        obteve = lock_conn.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_ID})
        lock_conn.commit()
        if not obteve:
            raise CargaEmAndamento(execucao_em_andamento(engine))

        with engine.begin() as conn:
            # Com o lock em mãos, qualquer `em_andamento` é de um processo que morreu.
            conn.execute(
                update(EtlExecucao)
                .where(EtlExecucao.status == "em_andamento")
                .values(status="falha", fim=func.now(), erro="Execução interrompida (processo encerrado)")
            )
            execucao_id = conn.scalar(
                insert(EtlExecucao).values(origem=origem, status="em_andamento").returning(EtlExecucao.id)
            )
        return Reserva(execucao_id=execucao_id, _lock_conn=lock_conn)
    except BaseException:
        lock_conn.close()
        raise


def _finalizar(engine: Engine, execucao_id: int, status: str, registros: int | None, erro: str | None) -> None:
    with engine.begin() as conn:
        conn.execute(
            update(EtlExecucao)
            .where(EtlExecucao.id == execucao_id)
            .values(status=status, fim=func.now(), registros=registros, erro=erro)
        )


def executar(
    engine: Engine,
    reserva: Reserva,
    settings: Settings | None = None,
    cliente: Callable[[], SiafeClient] | None = None,
    hoje: date | None = None,
) -> int:
    """Roda a carga completa para uma reserva já obtida. Retorna o nº de registros."""
    settings = settings or get_settings()
    cliente = cliente or (lambda: SiafeClient(settings))
    hoje = hoje or hoje_sp()

    try:
        linhas = []
        with cliente() as siafe:
            for ano, mes in periodos(hoje):
                resposta = siafe.consultar(ano, mes)
                do_mes = transformar(resposta, ano, mes, settings.siafe_ug)
                logger.info("SIAFE %d-%02d: %d registros", ano, mes, len(do_mes))
                linhas.extend(do_mes)

        for linha in linhas:
            linha["execucao_id"] = reserva.execucao_id

        with engine.begin() as conn:
            conn.execute(delete(SiafeFlexvision))
            if linhas:
                conn.execute(insert(SiafeFlexvision), linhas)

        _finalizar(engine, reserva.execucao_id, "sucesso", len(linhas), None)
        return len(linhas)
    except Exception as e:
        _finalizar(engine, reserva.execucao_id, "falha", None, f"{type(e).__name__}: {e}"[:MAX_ERRO])
        raise
    finally:
        reserva.liberar()


def main(argv: list[str] | None = None, engine: Engine | None = None, **kwargs) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # httpx loga cada requisição em INFO; desnecessário aqui.
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if engine is None:
        from app.db import engine

    try:
        reserva = reservar(engine, origem="cli")
    except CargaEmAndamento as e:
        print(f"Carga não iniciada: {e}", file=sys.stderr)
        return 2

    try:
        registros = executar(engine, reserva, **kwargs)
    except Exception as e:
        print(f"Carga {reserva.execucao_id} falhou: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    print(f"Carga {reserva.execucao_id} concluída: {registros} registros.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
