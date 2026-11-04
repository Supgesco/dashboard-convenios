"""ETL sob demanda da planilha geral de convênios, com overwrite atômico.

Fluxo:
1. `reservar()` pega o advisory lock (uma importação por vez, entre processos;
   independente do lock da carga SIAFE), marca importações órfãs como falha,
   calcula o SHA-256 do arquivo e cria o registro `em_andamento`.
2. `executar()` extrai e transforma as 8 abas em memória e, só então, faz
   DELETE + INSERT nas 8 tabelas numa única transação. Em qualquer falha os
   dados anteriores ficam intactos e o registro é finalizado como `falha`.

CLI: `uv run python -m app.etl.planilha <arquivo.xlsx>` (a partir de `api/`).
"""

import argparse
import hashlib
import logging
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import Connection, Engine, delete, func, insert, select, text, update

from app.models import TABELAS_PLANILHA, PlanilhaImportacao
from app.planilha.extracao import ErroArquivo, ErroPlanilha, extrair
from app.planilha.layout import ABAS
from app.planilha.transformacao import transformar_aba

logger = logging.getLogger(__name__)

LOCK_ID = 7_310_052  # chave fixa do pg_advisory_lock desta carga (a do SIAFE é 7_310_051)
MAX_ERRO = 2000
MAX_AVISOS = 1000
AVISOS_NA_CLI = 20


class ImportacaoEmAndamento(Exception):
    def __init__(self, importacao_id: int | None):
        super().__init__(f"Já existe uma importação da planilha em andamento (importação {importacao_id})")
        self.importacao_id = importacao_id


@dataclass
class Reserva:
    importacao_id: int
    _lock_conn: Connection

    def liberar(self) -> None:
        try:
            self._lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_ID})
        finally:
            self._lock_conn.close()


@dataclass
class Resultado:
    importacao_id: int
    linhas_por_aba: dict[str, int]  # tabela -> linhas
    avisos: list[dict] = field(default_factory=list)

    @property
    def total_linhas(self) -> int:
        return sum(self.linhas_por_aba.values())

    @property
    def avisos_por_motivo(self) -> dict[str, int]:
        return dict(Counter(a["motivo"] for a in self.avisos).most_common())


def _sha256(caminho: Path) -> str:
    h = hashlib.sha256()
    with caminho.open("rb") as arquivo:
        for bloco in iter(lambda: arquivo.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def importacao_em_andamento(engine: Engine) -> int | None:
    with engine.connect() as conn:
        return conn.scalar(
            select(PlanilhaImportacao.id)
            .where(PlanilhaImportacao.status == "em_andamento")
            .order_by(PlanilhaImportacao.id.desc())
            .limit(1)
        )


def reservar(engine: Engine, caminho: Path) -> Reserva:
    """Pega o lock e cria o registro. Levanta ImportacaoEmAndamento ou ErroArquivo."""
    caminho = Path(caminho)
    lock_conn = engine.connect()
    try:
        obteve = lock_conn.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_ID})
        lock_conn.commit()
        if not obteve:
            raise ImportacaoEmAndamento(importacao_em_andamento(engine))

        try:
            sha256 = _sha256(caminho)
        except OSError:
            raise ErroArquivo(f"Arquivo não encontrado ou ilegível: {caminho.name}") from None

        with engine.begin() as conn:
            # Com o lock em mãos, qualquer `em_andamento` é de um processo que morreu.
            conn.execute(
                update(PlanilhaImportacao)
                .where(PlanilhaImportacao.status == "em_andamento")
                .values(status="falha", fim=func.now(), erro="Importação interrompida (processo encerrado)")
            )
            importacao_id = conn.scalar(
                insert(PlanilhaImportacao)
                .values(status="em_andamento", arquivo=caminho.name, sha256=sha256)
                .returning(PlanilhaImportacao.id)
            )
        return Reserva(importacao_id=importacao_id, _lock_conn=lock_conn)
    except BaseException:
        try:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_ID})
        finally:
            lock_conn.close()
        raise


def _finalizar(engine: Engine, importacao_id: int, **valores) -> None:
    with engine.begin() as conn:
        conn.execute(
            update(PlanilhaImportacao).where(PlanilhaImportacao.id == importacao_id).values(fim=func.now(), **valores)
        )


def executar(engine: Engine, reserva: Reserva, caminho: Path) -> Resultado:
    """Roda o ETL completo para uma reserva já obtida."""
    try:
        extracao = extrair(Path(caminho))
        avisos = list(extracao.avisos)
        linhas: dict[str, list[dict]] = {}
        for aba in ABAS:
            registros, avisos_aba = transformar_aba(aba, extracao.linhas[aba.nome])
            for registro in registros:
                registro["importacao_id"] = reserva.importacao_id
            linhas[aba.nome] = registros
            avisos += avisos_aba
            logger.info("%s: %d linhas, %d avisos", aba.nome, len(registros), len(avisos_aba))

        with engine.begin() as conn:
            for aba in ABAS:
                conn.execute(delete(TABELAS_PLANILHA[aba.nome]))
            for aba in ABAS:
                if linhas[aba.nome]:
                    conn.execute(insert(TABELAS_PLANILHA[aba.nome]), linhas[aba.nome])

        resultado = Resultado(
            importacao_id=reserva.importacao_id,
            linhas_por_aba={aba.tabela: len(linhas[aba.nome]) for aba in ABAS},
            avisos=avisos,
        )
        _finalizar(
            engine,
            reserva.importacao_id,
            status="sucesso",
            linhas_por_aba=resultado.linhas_por_aba,
            total_avisos=len(avisos),
            avisos_por_motivo=resultado.avisos_por_motivo,
            avisos=avisos[:MAX_AVISOS],
        )
        return resultado
    except Exception as e:
        mensagem = str(e) if isinstance(e, ErroPlanilha) else f"{type(e).__name__}: {e}"
        _finalizar(engine, reserva.importacao_id, status="falha", erro=mensagem[:MAX_ERRO])
        raise
    finally:
        reserva.liberar()


def _imprimir_resumo(resultado: Resultado) -> None:
    print(f"Importação {resultado.importacao_id} concluída: {resultado.total_linhas} linhas.")
    for aba in ABAS:
        print(f"  {aba.nome} ({aba.tabela}): {resultado.linhas_por_aba[aba.tabela]}")
    motivos = ", ".join(f"{m}: {n}" for m, n in resultado.avisos_por_motivo.items())
    print(f"Avisos: {len(resultado.avisos)}" + (f" ({motivos})" if motivos else ""))
    for aviso in resultado.avisos[:AVISOS_NA_CLI]:
        valor = aviso["valor"].replace("\n", "\\n")
        print(f"  {aviso['aba']}!{aviso['celula']} [{aviso['motivo']}] {aviso['coluna']}: {valor}")
    if len(resultado.avisos) > AVISOS_NA_CLI:
        print(f"  ... e mais {len(resultado.avisos) - AVISOS_NA_CLI} (ver planilha_importacao.avisos)")


def main(argv: list[str] | None = None, engine: Engine | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.etl.planilha",
        description="Importa a planilha geral de convênios (xlsx) para o Postgres, substituindo a anterior.",
    )
    parser.add_argument("arquivo", type=Path, help="caminho do arquivo .xlsx")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    if not args.arquivo.is_file():
        print(f"Importação não iniciada: arquivo não encontrado: {args.arquivo}", file=sys.stderr)
        return 1

    if engine is None:
        from app.db import engine

    try:
        reserva = reservar(engine, args.arquivo)
    except ImportacaoEmAndamento as e:
        print(f"Importação não iniciada: {e}", file=sys.stderr)
        return 2
    except ErroArquivo as e:
        print(f"Importação não iniciada: {e}", file=sys.stderr)
        return 1

    try:
        resultado = executar(engine, reserva, args.arquivo)
    except ErroPlanilha as e:
        print(f"Importação {reserva.importacao_id} falhou: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Importação {reserva.importacao_id} falhou: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    _imprimir_resumo(resultado)
    return 0


if __name__ == "__main__":
    sys.exit(main())
