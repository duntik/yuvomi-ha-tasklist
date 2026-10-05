"""Async Yuvomi API. No credentials are returned to the frontend."""

from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import aiohttp


class YuvomiError(Exception):
    """A safe, user-visible API error."""


class YuvomiAuthError(YuvomiError):
    """Credentials expired or are invalid."""


def normalize_url(value: str) -> str:
    """Accept an origin or reverse-proxy base path, never embedded credentials."""
    parts = urlsplit(value.strip())
    if (
        parts.scheme not in {"http", "https"}
        or not parts.hostname
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
    ):
        raise ValueError("Enter an HTTP(S) URL without credentials, query or fragment")
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/"), "", ""))


class YuvomiApi:
    """Use a Home Assistant managed ClientSession."""

    def __init__(self, session: aiohttp.ClientSession, url: str, token: str) -> None:
        self.session = session
        self.url = normalize_url(url)
        self._token = token

    async def request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Reject redirects so tokens never leave the configured destination."""
        try:
            async with self.session.request(
                method,
                f"{self.url}/api/v1/{path}",
                json=body,
                params=params,
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=aiohttp.ClientTimeout(total=20),
                allow_redirects=False,
            ) as response:
                if response.status == 401:
                    raise YuvomiAuthError("Invalid or expired Yuvomi token")
                if response.status == 403:
                    raise YuvomiError(
                        "Yuvomi denied access: check token scope and task permissions"
                    )
                if not 200 <= response.status < 300:
                    raise YuvomiError(f"Yuvomi request failed (HTTP {response.status})")
                if response.status == 204:
                    return {}
                result = await response.json()
                if not isinstance(result, dict):
                    raise YuvomiError("Unexpected Yuvomi response")
                return result
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as err:
            raise YuvomiError("Cannot reach Yuvomi or decode its response") from err

    async def tasks(self, archived: bool = False) -> list[dict[str, Any]]:
        params = {"include_future": "1"}
        if archived:
            params["archived"] = "1"
        result = await self.request("GET", "tasks", params=params)
        tasks = result.get("data")
        if not isinstance(tasks, list) or any(
            not isinstance(task, dict) or "id" not in task or "title" not in task for task in tasks
        ):
            raise YuvomiError("Unexpected task list response")
        return tasks

    async def metadata(self) -> dict[str, Any]:
        return await self.request("GET", "tasks/meta/options")

    async def task(self, uid: str) -> dict[str, Any]:
        result = await self.request("GET", f"tasks/{self.task_id(uid)}")
        if not isinstance(result.get("data"), dict):
            raise YuvomiError("Unexpected task response")
        return result["data"]

    @staticmethod
    def task_id(uid: str | int) -> int:
        """IDs cannot inject arbitrary API paths."""
        value = str(uid)
        if not value.isascii() or not value.isdecimal() or int(value) < 1:
            raise YuvomiError("Invalid task ID")
        return int(value)

    async def create(self, fields: dict[str, Any]) -> dict[str, Any]:
        return await self.request("POST", "tasks", fields)

    async def update(self, uid: str, fields: dict[str, Any]) -> dict[str, Any]:
        return await self.request("PUT", f"tasks/{self.task_id(uid)}", fields)

    async def status(self, uid: str, status: str) -> dict[str, Any]:
        return await self.request("PATCH", f"tasks/{self.task_id(uid)}/status", {"status": status})

    async def archive(self, uid: str, archived: bool) -> dict[str, Any]:
        return await self.request(
            "PATCH", f"tasks/{self.task_id(uid)}/archive", {"archived": archived}
        )

    async def delete(self, uid: str) -> dict[str, Any]:
        return await self.request("DELETE", f"tasks/{self.task_id(uid)}")

    async def comments(self, uid: str) -> list[dict[str, Any]]:
        result = await self.request("GET", f"tasks/{self.task_id(uid)}/comments")
        rows = result.get("data")
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise YuvomiError("Unexpected comments response")
        return rows

    async def add_comment(self, uid: str, comment: str) -> dict[str, Any]:
        if not comment.strip():
            raise YuvomiError("Comment cannot be empty")
        return await self.request(
            "POST", f"tasks/{self.task_id(uid)}/comments", {"comment": comment.strip()}
        )
