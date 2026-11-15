
import secrets
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Header, HTTPException

from .schemas import LoginResponse


TOKEN_TTL_SECONDS = 60 * 60
_hasher = PasswordHasher()


# Akun pengguna demo lokal, bukan autentikasi produksi.
USERS = {
    "dosen1": {
        "email": "dosen1@its",
        "password_hash": _hasher.hash("password"),
        "role": "dosen",
        "nama": "Dosen Pengampu",
        "student_id": None,
    },
    "mahasiswa1": {
        "email": "mahasiswa1@its",
        "password_hash": _hasher.hash("password"),
        "role": "mahasiswa",
        "nama": "Mahasiswa Satu",
        "student_id": "S-001",
    },
    "mahasiswa2": {
        "email": "mahasiswa2@its",
        "password_hash": _hasher.hash("password"),
        "role": "mahasiswa",
        "nama": "Mahasiswa Dua",
        "student_id": "S-002",
    },
}


# Penyimpanan session sementara di memory server.
# Token akan hilang jika server restart; expiry dibatasi untuk prototype lokal.
SESSIONS: dict[str, dict[str, str | float]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def cleanup_expired_sessions() -> None:
    now = _now().timestamp()
    for token, session in list(SESSIONS.items()):
        expires_at = float(session.get("expires_at", 0))
        if expires_at <= now:
            SESSIONS.pop(token, None)


def _extract_token(value: str) -> str:
    """Mengambil token, baik format langsung maupun Bearer."""

    if not value:
        return ""

    value = value.strip()

    if value.lower().startswith("bearer "):
        return value[7:].strip()

    return value


def _verify_password(user: dict, password: str) -> bool:
    password_hash = user.get("password_hash")
    if not password_hash:
        return False
    try:
        _hasher.verify(password_hash, password)
        return True
    except VerifyMismatchError:
        return False


def find_user(identifier: str) -> tuple[str | None, dict | None]:
    """Mencari pengguna berdasarkan username atau email."""

    ident = identifier.strip().lower()

    for username, data in USERS.items():
        if ident == username or ident == data["email"].lower():
            return username, data

    return None, None


def login_user(identifier: str, password: str) -> LoginResponse:
    """Memeriksa akun dan membuat token login."""

    cleanup_expired_sessions()
    username, user = find_user(identifier)

    if user is None or not _verify_password(user, password):
        raise HTTPException(
            status_code=401,
            detail="Username/email atau password salah",
        )

    token = secrets.token_urlsafe(32)
    expires_at = (_now() + timedelta(seconds=TOKEN_TTL_SECONDS)).timestamp()
    SESSIONS[token] = {"username": username, "expires_at": expires_at}

    return LoginResponse(
        token=token,
        username=username,
        nama=user["nama"],
        role=user["role"],
        student_id=user.get("student_id"),
    )


def logout_user(token_value: str) -> None:
    """Menghapus session pengguna."""

    token = _extract_token(token_value)
    SESSIONS.pop(token, None)


def get_optional_current_user(
    x_auth_token: str = Header(default="", alias="X-Auth-Token")
) -> dict | None:
    """Mengambil user aktif; tanpa token berarti mode demo, token invalid ditolak."""

    cleanup_expired_sessions()
    token = _extract_token(x_auth_token)
    if not token:
        return None

    session = SESSIONS.get(token)
    if session is None:
        raise HTTPException(
            status_code=401,
            detail="Belum login atau token tidak valid",
        )

    username = str(session["username"])
    user = USERS.get(username)
    if user is None:
        SESSIONS.pop(token, None)
        raise HTTPException(
            status_code=401,
            detail="Belum login atau token tidak valid",
        )

    return {
        "username": username,
        "nama": user["nama"],
        "email": user["email"],
        "role": user["role"],
        "student_id": user.get("student_id"),
    }


def get_current_user(
    x_auth_token: str = Header(default="", alias="X-Auth-Token")
) -> dict:
    """Memeriksa token dan mengambil data pengguna."""

    user = get_optional_current_user(x_auth_token)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Belum login atau token tidak valid",
        )
    return user
