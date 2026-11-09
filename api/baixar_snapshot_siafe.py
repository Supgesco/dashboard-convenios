"""Baixa o snapshot completo de saldos SIAFE da API de produção para cache local instantâneo."""

import json
from pathlib import Path
import httpx

BASE = "https://subtsi.obras.rj.gov.br/convenios/api"
DEST = Path(__file__).resolve().parent.parent / "data" / "siafe_producao_snapshot.json"


def main():
    snap = {
        "resumos": {},
        "series": {},
        "convenios_por_mes": {},
        "municipios_por_mes": {},
        "etl_status": None,
        "etl_execucoes": None,
    }

    with httpx.Client(base_url=BASE, verify=False, timeout=30.0) as client:
        for rec in ["31", "89", "342"]:
            print(f"Baixando resumo e série do recorte {rec}...")
            r_res = client.get("/painel/resumo", params={"recorte": rec})
            if r_res.status_code == 200:
                snap["resumos"][rec] = r_res.json()

            r_ser = client.get("/painel/serie", params={"recorte": rec})
            if r_ser.status_code == 200:
                snap["series"][rec] = r_ser.json().get("pontos", [])

            # Municípios do mês atual e de 2026-02
            for chave_mes, params_mes in [("atual", {}), ("2026-02", {"ano": 2026, "mes": 2})]:
                r_mun = client.get(
                    "/painel/municipios",
                    params={"recorte": rec, "tamanho": 100, "pagina": 1, **params_mes},
                )
                if r_mun.status_code == 200:
                    snap["municipios_por_mes"].setdefault(chave_mes, {})[rec] = r_mun.json().get("itens", [])

        # Todos os convênios (342, 89, 31) no mês atual e em 2026-02
        for chave_mes, params_mes in [("atual", {}), ("2026-02", {"ano": 2026, "mes": 2})]:
            snap["convenios_por_mes"][chave_mes] = {}
            for rec, paginas in [("31", 1), ("89", 1), ("342", 4)]:
                print(f"Baixando convênios recorte {rec} ({chave_mes})...")
                itens_rec = []
                for pag in range(1, paginas + 1):
                    r_conv = client.get(
                        "/painel/convenios",
                        params={"recorte": rec, "tamanho": 100, "pagina": pag, **params_mes},
                    )
                    if r_conv.status_code == 200:
                        itens_rec.extend(r_conv.json().get("itens", []))
                snap["convenios_por_mes"][chave_mes][rec] = itens_rec

        try:
            r_st = client.get("/etl/siafe/status")
            if r_st.status_code == 200:
                snap["etl_status"] = r_st.json()
            r_ex = client.get("/etl/siafe/execucoes", params={"tamanho": 50})
            if r_ex.status_code == 200:
                snap["etl_execucoes"] = r_ex.json()
        except Exception as e:
            print("Aviso ETL:", e)

    DEST.parent.mkdir(parents=True, exist_ok=True)
    with open(DEST, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False)
    print(
        "Snapshot concluído:",
        {rec: len(snap["convenios_por_mes"]["atual"].get(rec, [])) for rec in ["31", "89", "342"]},
    )


if __name__ == "__main__":
    main()
