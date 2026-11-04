from fastapi import FastAPI

from app.routers import etl

app = FastAPI(title="Dashboard Convênios API")
app.include_router(etl.router)
