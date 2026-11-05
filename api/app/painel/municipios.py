"""Normalização do filtro de municípios do painel: mesma regra da carga da planilha."""

from app.planilha.dominios import MUNICIPIO_POR_CHAVE, chave


def normalizar_municipios(valores: list[str]) -> tuple[list[str], list[str]]:
    """Devolve (nomes canônicos sem repetição, na ordem de chegada; valores não reconhecidos)."""
    canonicos: list[str] = []
    invalidos: list[str] = []
    for valor in valores:
        nome = MUNICIPIO_POR_CHAVE.get(chave(valor))
        if nome is None:
            if valor not in invalidos:
                invalidos.append(valor)
        elif nome not in canonicos:
            canonicos.append(nome)
    return canonicos, invalidos
