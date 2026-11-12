from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="EWS ITS")

@app.get("/health")
def health():
    return {"status": "ok"}

# endpoint API lain (/api/predict, dst.) ditaruh di sini, SEBELUM mount

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
