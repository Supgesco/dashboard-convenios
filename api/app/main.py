from fastapi import Depends, FastAPI

from app.auth.dependencias import usuario_atual
from app.routers import auth, etl, painel

app = FastAPI(title="Dashboard Convênios API")
app.include_router(auth.router)
# Tudo em /painel e /etl exige sessão (401 sem ela), inclusive rotas novas desses routers.
app.include_router(etl.router, dependencies=[Depends(usuario_atual)])
app.include_router(painel.router, dependencies=[Depends(usuario_atual)])
