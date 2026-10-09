"""HTTP errors that keep a string `detail` and add a stable `code` for clients."""

from __future__ import annotations

from fastapi import HTTPException
from fastapi.responses import JSONResponse


class CodedHTTPException(HTTPException):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(status_code=status_code, detail=message)
        self.code = code


async def coded_handler(_request, exc: CodedHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
    )
