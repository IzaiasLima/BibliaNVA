"""Utilitários compartilhados pelas rotas da API."""

from datetime import date
from typing import Any

from fastapi.responses import JSONResponse

# O Turso bloqueia leituras quando a cota do plano é esgotada. Nesse caso
# devolvemos 503 com uma mensagem amigável — o frontend exibe o campo
# "detail" de respostas 4xx/5xx como toast (ver functions.js).
BLOCKED_MARKERS = (
    "reads are blocked",
    "Operation was blocked",
    "upgrade your plan",
)


def is_quota_blocked_error(exc: BaseException) -> bool:
    """True se a exceção indica bloqueio de operações do banco (cota)."""
    seen: set[int] = set()
    current: BaseException | None = exc
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if "BLOCKED" in str(current):
            return True
        if any(marker in str(current) for marker in BLOCKED_MARKERS):
            return True
        current = current.__cause__ or current.__context__
    return False


def first_day_of_next_month(today: date | None = None) -> date:
    """Primeiro dia do mês seguinte à data informada (padrão: hoje)."""
    today = today or date.today()
    if today.month == 12:
        return date(today.year + 1, 1, 1)
    return date(today.year, today.month + 1, 1)


def quota_blocked_response() -> JSONResponse:
    """Resposta 503 informando a indisponibilidade e a previsão de retorno."""
    forecast = first_day_of_next_month().strftime("%d/%m/%Y")
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Estamos trabalhando para sanar um problema de acesso ao banco "
                f"de dados. Previsão de retorno dia {forecast}."
            )
        },
    )


def db_guard(exc: BaseException, fallback: Any) -> JSONResponse | Any:
    """Converte erro de cota bloqueada em 503 amigável.

    Para qualquer outro erro, devolve o `fallback` da rota (comportamento
    original), preservando a resposta vazia que o frontend já espera.
    """
    if is_quota_blocked_error(exc):
        return quota_blocked_response()
    return fallback
