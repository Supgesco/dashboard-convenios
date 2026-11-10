from app.config import Settings


def test_segredos_nao_aparecem_no_repr():
    settings = Settings(
        _env_file=None,
        siafe_url="https://siafe.example/api",
        siafe_user="usuario-teste",
        siafe_password="senha-super-secreta",
        siafe_ug="123456",
        siafe_consulta="CONSULTA",
        database_url="postgresql+psycopg2://u:senha-do-banco@localhost/db",
    )

    texto = repr(settings) + str(settings) + settings.model_dump_json()

    assert "senha-super-secreta" not in texto
    assert "senha-do-banco" not in texto
    assert settings.siafe_password.get_secret_value() == "senha-super-secreta"


def test_padroes_da_sessao():
    settings = Settings(_env_file=None)

    assert settings.sessao_horas == 12
    assert settings.sessao_cookie_seguro is True
