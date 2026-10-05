"""Home Assistant compatibility checks, run with real HA in Linux CI."""

import asyncio
import importlib.util
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, PropertyMock, patch

HA_AVAILABLE = importlib.util.find_spec("homeassistant") is not None
if HA_AVAILABLE:
    from homeassistant.components.frontend import add_extra_js_url
    from homeassistant.components.todo import TodoItemStatus

    from custom_components.yuvomi.config_flow import YuvomiConfigFlow, YuvomiOptionsFlow
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

    async def test_legacy_entry_without_timezone_opens_options(self):
        flow = YuvomiOptionsFlow()
        flow.hass = SimpleNamespace(config=SimpleNamespace(time_zone="Europe/London"))
        entry = SimpleNamespace(data={}, options={})
        with patch.object(
            YuvomiOptionsFlow, "config_entry", new_callable=PropertyMock, return_value=entry
        ):
            result = await flow.async_step_init()
        self.assertEqual(result["data_schema"]({})["time_zone"], "Europe/London")

    async def test_legacy_entity_uses_ha_timezone_and_option_override(self):
        self.entity()
        self.coordinator.entry.data = {}
        self.coordinator.hass = SimpleNamespace(config=SimpleNamespace(time_zone="Europe/London"))
        self.assertEqual(YuvomiTodo(self.coordinator).zone.key, "Europe/London")
        self.coordinator.entry.options = {"time_zone": "Europe/Paris"}
        self.assertEqual(YuvomiTodo(self.coordinator).zone.key, "Europe/Paris")

    async def test_setup_form_is_valid_with_current_ha_selectors(self):
        flow = YuvomiConfigFlow()
        flow.hass = SimpleNamespace(config=SimpleNamespace(time_zone="Europe/London"))
        result = await flow.async_step_user()
        self.assertEqual(result["step_id"], "user")
        values = result["data_schema"]({"url": "http://yuvomi.local", "token": "test"})
        self.assertEqual(values["time_zone"], "Europe/London")
        self.assertTrue(values["enhance_ui"])

    async def test_frontend_module_registration_uses_supported_ha_api(self):
        hass = SimpleNamespace(
            data={"frontend": {"extra_module_url": set(), "extra_js_url_es5": set()}}
        )
        # Inspect registration through the real frontend helper.
        from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL

        hass.data[DATA_EXTRA_MODULE_URL] = set()
        add_extra_js_url(hass, "/yuvomi_tasklist/yuvomi.js?v=0.1.0")
        self.assertIn("/yuvomi_tasklist/yuvomi.js?v=0.1.0", hass.data[DATA_EXTRA_MODULE_URL])

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
