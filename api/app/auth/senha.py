"""Hash de senha com scrypt (biblioteca padrão).

Formato: ``scrypt$<n>$<r>$<p>$<sal_b64>$<hash_b64>``. Os parâmetros vão no próprio hash,
então podem aumentar no futuro sem invalidar os hashes já gravados.
"""

import base64
import hashlib
import hmac
import secrets

N, R, P = 2**15, 8, 1
TAMANHO_SAL = 16
TAMANHO_CHAVE = 32
MINIMO_CARACTERES = 8


def _derivar(senha: str, sal: bytes, n: int, r: int, p: int) -> bytes:
    # maxmem acima do necessário (128 * n * r = 32 MiB com os padrões).
    return hashlib.scrypt(
        senha.encode("utf-8"), salt=sal, n=n, r=r, p=p, dklen=TAMANHO_CHAVE, maxmem=256 * n * r
    )


def gerar_hash(senha: str) -> str:
    sal = secrets.token_bytes(TAMANHO_SAL)
    chave = _derivar(senha, sal, N, R, P)
    b64 = lambda b: base64.b64encode(b).decode("ascii")  # noqa: E731
    return f"scrypt${N}${R}${P}${b64(sal)}${b64(chave)}"


def verificar(senha: str, senha_hash: str) -> bool:
    """True se a senha confere. Hash em formato desconhecido nunca confere."""
    try:
        algoritmo, n, r, p, sal, chave = senha_hash.split("$")
        if algoritmo != "scrypt":
            return False
        esperado = base64.b64decode(chave, validate=True)
        obtido = _derivar(senha, base64.b64decode(sal, validate=True), int(n), int(r), int(p))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(obtido, esperado)


# Hash fixo usado quando o e-mail não existe, para o login levar o mesmo tempo
# com ou sem conta (não revela quais e-mails estão cadastrados).
HASH_FICTICIO = gerar_hash(secrets.token_urlsafe(16))


def verificar_ficticio(senha: str) -> None:
    verificar(senha, HASH_FICTICIO)


def validar_nova_senha(senha: str) -> str | None:
    """Mensagem de erro para uma senha nova inaceitável, ou None se ela serve."""
    if len(senha) < MINIMO_CARACTERES:
        return f"A senha precisa ter pelo menos {MINIMO_CARACTERES} caracteres."
    return None
