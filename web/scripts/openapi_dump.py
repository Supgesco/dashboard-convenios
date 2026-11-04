"""Imprime o OpenAPI da API em JSON (não abre conexão com o banco). Usado por api-tipos.mjs."""

import json
import sys

from app.main import app

texto = json.dumps(app.openapi(), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
sys.stdout.buffer.write(texto.encode("utf-8"))
