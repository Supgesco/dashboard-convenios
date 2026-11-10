"""Administração de usuários do painel pela linha de comando.

    uv run python -m app.auth.usuarios criar EMAIL --nome "Nome" --perfil analista [--cargo ..] [--orgao ..]
    uv run python -m app.auth.usuarios senha EMAIL
    uv run python -m app.auth.usuarios desativar EMAIL
    uv run python -m app.auth.usuarios ativar EMAIL
    uv run python -m app.auth.usuarios listar

A senha é digitada duas vezes sem eco, ou lida de uma linha da entrada padrão com
--senha-stdin. Nunca é aceita como argumento (ficaria no histórico do shell e no `ps`).
Código de saída: 0 sucesso, 1 erro (validação, e-mail duplicado ou inexistente).
"""

import argparse
import getpass
import sys
from collections.abc import Callable

from sqlalchemy import Engine

from app.auth import servico


class _SenhaNaoConfere(Exception):
    pass


def _ler_senha(senha_stdin: bool, entrada=None) -> str:
    if senha_stdin:
        return (entrada or sys.stdin).readline().rstrip("\r\n")
    primeira = getpass.getpass("Senha: ")
    if getpass.getpass("Repita a senha: ") != primeira:
        raise _SenhaNaoConfere
    return primeira


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m app.auth.usuarios", description="Usuários do painel de convênios")
    sub = p.add_subparsers(dest="comando", required=True)

    criar = sub.add_parser("criar", help="cria um usuário ativo")
    criar.add_argument("email")
    criar.add_argument("--nome", required=True)
    criar.add_argument("--perfil", required=True, choices=servico.PERFIS)
    criar.add_argument("--cargo")
    criar.add_argument("--orgao")
    criar.add_argument("--senha-stdin", action="store_true", help="lê a senha de uma linha da entrada padrão")

    senha = sub.add_parser("senha", help="troca a senha, desfaz o bloqueio e encerra as sessões")
    senha.add_argument("email")
    senha.add_argument("--senha-stdin", action="store_true", help="lê a senha de uma linha da entrada padrão")

    for nome, ajuda in [("desativar", "impede o login e encerra as sessões"), ("ativar", "libera o login")]:
        sub.add_parser(nome, help=ajuda).add_argument("email")

    sub.add_parser("listar", help="lista os usuários (sem senhas)")
    return p


def main(argv: list[str] | None = None, engine: Engine | None = None, ler_senha: Callable[[bool], str] = _ler_senha) -> int:
    args = _parser().parse_args(argv)
    if engine is None:
        from app.db import engine

    try:
        if args.comando == "criar":
            uid = servico.criar_usuario(
                engine, args.email, args.nome, args.perfil, ler_senha(args.senha_stdin), args.cargo, args.orgao
            )
            print(f"Usuário {servico.normalizar_email(args.email)} criado (id {uid}).")
        elif args.comando == "senha":
            servico.trocar_senha(engine, args.email, ler_senha(args.senha_stdin))
            print(f"Senha de {servico.normalizar_email(args.email)} alterada; sessões encerradas.")
        elif args.comando in ("ativar", "desativar"):
            servico.definir_ativo(engine, args.email, args.comando == "ativar")
            print(f"Usuário {servico.normalizar_email(args.email)} {args.comando[:-1]}do.")
        else:
            usuarios = servico.listar(engine)
            if not usuarios:
                print("Nenhum usuário cadastrado.")
            for u in usuarios:
                situacao = "ativo" if u["ativo"] else "inativo"
                bloqueio = f", bloqueado até {u['bloqueado_ate']:%d/%m/%Y %H:%M}" if u["bloqueado_ate"] else ""
                print(f"{u['id']:>4}  {u['email']:<40} {u['perfil']:<14} {situacao}{bloqueio}  {u['nome']}")
    except _SenhaNaoConfere:
        print("Erro: as senhas digitadas não conferem.", file=sys.stderr)
        return 1
    except servico.ErroUsuario as e:
        print(f"Erro: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
