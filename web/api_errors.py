"""HTTP errors that keep a string `detail` and add a stable `code` for clients."""

from __future__ import annotations

from fastapi import HTTPException
from fastapi.responses import JSONResponse


class CodedHTTPException(HTTPException):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        extra: dict | None = None,
    ):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.extra = dict(extra or {})


async def coded_handler(_request, exc: CodedHTTPException) -> JSONResponse:
    content = {"detail": exc.detail, "code": exc.code}
    if exc.extra:
        content.update(exc.extra)
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
    )
