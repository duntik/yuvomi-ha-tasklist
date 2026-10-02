"""Home Assistant compatibility checks, run with real HA in Linux CI."""

import asyncio
import importlib.util
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

HA_AVAILABLE = importlib.util.find_spec("homeassistant") is not None
if HA_AVAILABLE:
    from homeassistant.components.todo import TodoItemStatus

    from custom_components.yuvomi.todo import YuvomiTodo
    from custom_components.yuvomi.websocket import FIELDS, get_coordinator


@unittest.skipUnless(HA_AVAILABLE, "Home Assistant runs in Linux CI")
class HomeAssistantTests(unittest.IsolatedAsyncioTestCase):
    def entity(self):
        self.coordinator = SimpleNamespace(
            hass=None,
            config_entry=None,
            mutation_lock=asyncio.Lock(),
            entry=SimpleNamespace(
                unique_id="server", data={"time_zone": "Europe/London"}, options={}
            ),
            data=[
                {
                    "id": 1,
                    "title": "Task",
                    "status": "in_progress",
                    "due_date": "2026-07-01",
                    "due_time": "10:00",
                    "description": "Description",
                }
            ],
            api=SimpleNamespace(
                task=AsyncMock(),
                update=AsyncMock(),
                status=AsyncMock(),
                create=AsyncMock(),
                delete=AsyncMock(),
            ),
            async_refresh=AsyncMock(),
        )
        return YuvomiTodo(self.coordinator)

    async def test_imports_and_timezone_mapping(self):
        entity = self.entity()
        item = entity.todo_items[0]
        self.assertEqual(item.status, TodoItemStatus.NEEDS_ACTION)
        self.assertEqual(item.due.isoformat(), "2026-07-01T10:00:00+01:00")

    async def test_rename_preserves_in_progress(self):
        entity = self.entity()
        self.coordinator.api.task.return_value = self.coordinator.data[0]
        item = entity.todo_items[0]
        item.summary = "Rename"
        await entity.async_update_todo_item(item)
        self.coordinator.api.status.assert_not_called()
        self.coordinator.api.update.assert_awaited_once_with("1", {"title": "Rename"})
        self.coordinator.async_refresh.assert_awaited_once()

    async def test_completion_uses_server_status_and_refresh(self):
        entity = self.entity()
        self.coordinator.api.task.return_value = self.coordinator.data[0]
        item = entity.todo_items[0]
        item.status = TodoItemStatus.COMPLETED
        await entity.async_update_todo_item(item)
        self.coordinator.api.update.assert_not_called()
        self.coordinator.api.status.assert_awaited_once_with("1", "done")
        self.coordinator.async_refresh.assert_awaited_once()

    async def test_archived_excluded_and_batch_delete(self):
        entity = self.entity()
        self.coordinator.data[0]["archived_at"] = "2026-10-01"
        self.assertEqual(entity.todo_items, [])
        await entity.async_delete_todo_items(["1", "2"])
        self.assertEqual(self.coordinator.api.delete.await_count, 2)
        self.coordinator.async_refresh.assert_awaited_once()

    async def test_permission_denied_before_registry_or_network(self):
        connection = SimpleNamespace(
            user=SimpleNamespace(permissions=SimpleNamespace(check_entity=lambda *_: False))
        )
        with self.assertRaisesRegex(Exception, "permission"):
            get_coordinator(None, connection, "todo.yuvomi_tasks", write=True)

    async def test_extended_fields_reject_arbitrary_request_path(self):
        import voluptuous as vol

        with self.assertRaises(vol.Invalid):
            FIELDS({"path": "auth/api-tokens"})


if __name__ == "__main__":
    unittest.main()
