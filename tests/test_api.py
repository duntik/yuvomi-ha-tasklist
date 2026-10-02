"""Exercise the actual HTTP client against a local Yuvomi-shaped server."""

import importlib.util
import unittest
from pathlib import Path

import aiohttp
from aiohttp import web

SPEC = importlib.util.spec_from_file_location(
    "yuvomi_api", Path(__file__).parents[1] / "custom_components/yuvomi/api.py"
)
api_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(api_module)
YuvomiApi = api_module.YuvomiApi
YuvomiError = api_module.YuvomiError
YuvomiAuthError = api_module.YuvomiAuthError


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.requests = []
        self.response_status = 200
        self.response_body = {"data": [{"id": 1, "title": "Task", "status": "open"}]}
        app = web.Application()
        app.router.add_route("*", "/{path:.*}", self.handle)
        self.runner = web.AppRunner(app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, "127.0.0.1", 0)
        await self.site.start()
        port = self.site._server.sockets[0].getsockname()[1]
        self.session = aiohttp.ClientSession()
        self.api = YuvomiApi(self.session, f"http://127.0.0.1:{port}", "test-token")

    async def asyncTearDown(self):
        await self.session.close()
        await self.runner.cleanup()

    async def handle(self, request):
        self.requests.append(
            (
                request.method,
                request.path,
                dict(request.query),
                request.headers.get("Authorization"),
                await request.json() if request.can_read_body else None,
            )
        )
        if self.response_status == 302:
            return web.Response(status=302, headers={"Location": "/unexpected"})
        return web.json_response(self.response_body, status=self.response_status)

    async def test_tasks_include_future_and_bearer(self):
        self.assertEqual((await self.api.tasks())[0]["id"], 1)
        method, path, query, auth, _ = self.requests[-1]
        self.assertEqual((method, path), ("GET", "/api/v1/tasks"))
        self.assertEqual(query, {"include_future": "1"})
        self.assertEqual(auth, "Bearer test-token")

    async def test_archive_query_is_explicit(self):
        await self.api.tasks(archived=True)
        self.assertEqual(self.requests[-1][2], {"include_future": "1", "archived": "1"})

    async def test_status_uses_recurrence_endpoint(self):
        await self.api.status("12", "done")
        self.assertEqual(self.requests[-1][0:2], ("PATCH", "/api/v1/tasks/12/status"))
        self.assertEqual(self.requests[-1][4], {"status": "done"})

    async def test_update_sends_only_changed_fields(self):
        await self.api.update("1", {"title": "Renamed"})
        self.assertEqual(self.requests[-1][4], {"title": "Renamed"})

    async def test_rejects_token_redirect(self):
        self.response_status = 302
        with self.assertRaises(YuvomiError):
            await self.api.tasks()
        self.assertEqual(len(self.requests), 1)

    async def test_auth_failure_is_distinct(self):
        self.response_status = 401
        with self.assertRaises(YuvomiAuthError):
            await self.api.tasks()

    async def test_denied_task_does_not_trigger_reauth(self):
        self.response_status = 403
        with self.assertRaises(YuvomiError) as caught:
            await self.api.tasks()
        self.assertNotIsInstance(caught.exception, YuvomiAuthError)

    async def test_bad_shape_rejected(self):
        self.response_body = {"data": {"tasks": []}}
        with self.assertRaises(YuvomiError):
            await self.api.tasks()

    async def test_url_and_id_injection_rejected(self):
        for value in ["https://user:password@host", "file:///tmp/a", "https://host/?token=x"]:
            with self.assertRaises(ValueError):
                api_module.normalize_url(value)
        for uid in ["../auth/me", "1/status", "0", "-1", "１"]:
            with self.assertRaises(YuvomiError):
                await self.api.delete(uid)
        self.assertEqual(self.requests, [])


if __name__ == "__main__":
    unittest.main()
