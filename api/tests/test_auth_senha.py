"""Hash de senha (sem banco)."""

from app.auth import senha


def test_senha_correta_confere_e_errada_nao():
    h = senha.gerar_hash("Exemplo@123")

    assert senha.verificar("Exemplo@123", h)
    assert not senha.verificar("Exemplo@124", h)
    assert not senha.verificar("", h)


def test_hash_nao_contem_a_senha_e_usa_sal():
    a = senha.gerar_hash("Exemplo@123")
    b = senha.gerar_hash("Exemplo@123")

    assert a != b
    assert "Exemplo@123" not in a
    assert a.startswith("scrypt$")


def test_formatos_invalidos_nunca_conferem():
    for invalido in ["", "texto-puro", "md5$abc", "scrypt$1$2$3", "scrypt$x$8$1$AAAA$AAAA", "scrypt$16384$8$1$!!$!!"]:
        assert not senha.verificar("qualquer", invalido)


def test_validar_nova_senha():
    assert senha.validar_nova_senha("1234567") is not None
    assert senha.validar_nova_senha("12345678") is None
