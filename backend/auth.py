
import secrets

from fastapi import Header, HTTPException

from .schemas import LoginResponse


# Akun pengguna
USERS = {
    "dosen1": {
        "email": "dosen1@its.ac.id",
        "password": "dosen123",
        "role": "dosen",
        "nama": "Dosen Pengampu"
    },
    "siswa1": {
        "email": "siswa1@its.ac.id",
        "password": "siswa123",
        "role": "siswa",
        "nama": "Siswa Satu"
    },
    "siswa2": {
        "email": "siswa2@its.ac.id",
        "password": "siswa456",
        "role": "siswa",
        "nama": "Siswa Dua"
    },
}


# Penyimpanan session sementara
# Token akan hilang jika server restart.
SESSIONS: dict[str, str] = {}


def _extract_token(value: str) -> str:
    """Mengambil token, baik format langsung maupun Bearer."""

    if not value:
        return ""

    value = value.strip()

    if value.lower().startswith("bearer "):
        return value[7:].strip()

    return value


def find_user(identifier: str) -> tuple[str | None, dict | None]:
    """Mencari pengguna berdasarkan username atau email."""

    ident = identifier.strip().lower()

    for username, data in USERS.items():
        if ident == username or ident == data["email"].lower():
            return username, data

    return None, None


def login_user(identifier: str, password: str) -> LoginResponse:
    """Memeriksa akun dan membuat token login."""

    username, user = find_user(identifier)

    if user is None or not secrets.compare_digest(
        user["password"], password
    ):
        raise HTTPException(
            status_code=401,
            detail="Username/email atau password salah"
        )

    token = secrets.token_urlsafe(32)
    SESSIONS[token] = username

    return LoginResponse(
        token=token,
        username=username,
        nama=user["nama"],
        role=user["role"]
    )


def logout_user(token_value: str) -> None:
    """Menghapus session pengguna."""

    token = _extract_token(token_value)
    SESSIONS.pop(token, None)


def get_current_user(
    x_auth_token: str = Header(default="", alias="X-Auth-Token")
) -> dict:
    """Memeriksa token dan mengambil data pengguna."""

    token = _extract_token(x_auth_token)
    username = SESSIONS.get(token)

    if username is None:
        raise HTTPException(
            status_code=401,
            detail="Belum login atau token tidak valid"
        )

    user = USERS[username]

    return {
        "username": username,
        "nama": user["nama"],
        "email": user["email"],
        "role": user["role"]
    }
