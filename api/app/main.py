from fastapi import FastAPI

from app.routers import etl, painel

app = FastAPI(title="Dashboard Convênios API")
app.include_router(etl.router)
app.include_router(painel.router)
