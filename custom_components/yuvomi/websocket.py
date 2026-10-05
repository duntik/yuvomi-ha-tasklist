"""Permission-checked extended task operations through HA's websocket."""

import voluptuous as vol
from homeassistant.auth.permissions.const import POLICY_CONTROL, POLICY_READ
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .api import YuvomiError
from .const import DOMAIN

NULL_STRING = vol.Any(None, str)
FIELDS = vol.Schema(
    {
        vol.Optional("title"): vol.All(str, vol.Length(min=1, max=1000)),
        vol.Optional("description"): NULL_STRING,
        vol.Optional("priority"): vol.In(["none", "low", "medium", "high", "urgent"]),
        vol.Optional("status"): vol.In(["open", "in_progress", "done"]),
        vol.Optional("category"): str,
        vol.Optional("start_date"): NULL_STRING,
        vol.Optional("due_date"): NULL_STRING,
        vol.Optional("due_time"): NULL_STRING,
        vol.Optional("assigned_to"): [vol.All(vol.Coerce(int), vol.Range(min=1))],
        vol.Optional("tags"): [str],
        vol.Optional("parent_task_id"): vol.Any(None, vol.All(vol.Coerce(int), vol.Range(min=1))),
        vol.Optional("is_recurring"): bool,
        vol.Optional("recurrence_rule"): NULL_STRING,
        vol.Optional("recurrence_from_completion"): bool,
        vol.Optional("points"): vol.All(vol.Coerce(int), vol.Range(min=0, max=10000)),
        vol.Optional("visibility"): vol.In(["all", "private", "assignees"]),
        vol.Optional("locked"): bool,
    }
)


def get_coordinator(hass, connection, entity_id, write=False):
    policy = POLICY_CONTROL if write else POLICY_READ
    if not connection.user.permissions.check_entity(entity_id, policy):
        raise YuvomiError("You do not have permission for this entity")
    registry_entry = er.async_get(hass).async_get(entity_id)
    if not registry_entry or registry_entry.platform != DOMAIN:
        raise YuvomiError("Select a Yuvomi To-do entity")
    entry = hass.config_entries.async_get_entry(registry_entry.config_entry_id)
    if (
        not entry
        or entry.state is not ConfigEntryState.LOADED
        or not hasattr(entry, "runtime_data")
    ):
        raise YuvomiError("Yuvomi integration is not loaded")
    if not entry.runtime_data.last_update_success:
        raise YuvomiError("Yuvomi is unavailable; refresh the integration")
    return entry.runtime_data


@websocket_api.websocket_command(
    {
        vol.Required("type"): "yuvomi/tasks",
        vol.Required("entity_id"): str,
        vol.Optional("archived", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_tasks(hass, connection, msg):
    try:
        coordinator = get_coordinator(hass, connection, msg["entity_id"])
        tasks = await coordinator.api.tasks(msg["archived"])
        metadata = await coordinator.api.metadata()
        connection.send_result(msg["id"], {"tasks": tasks, "metadata": metadata})
    except YuvomiError as err:
        connection.send_error(msg["id"], "yuvomi_error", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "yuvomi/task",
        vol.Required("entity_id"): str,
        vol.Required("uid"): str,
    }
)
@websocket_api.async_response
async def ws_task(hass, connection, msg):
    try:
        coordinator = get_coordinator(hass, connection, msg["entity_id"])
        task = await coordinator.api.task(msg["uid"])
        metadata = await coordinator.api.metadata()
        connection.send_result(msg["id"], {"task": task, "metadata": metadata})
    except YuvomiError as err:
        connection.send_error(msg["id"], "yuvomi_error", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "yuvomi/mutate",
        vol.Required("entity_id"): str,
        vol.Required("operation"): vol.In(
            [
                "create",
                "update",
                "status",
                "archive",
                "delete",
                "comment",
                "edit_comment",
                "delete_comment",
            ]
        ),
        vol.Optional("comment"): vol.All(str, vol.Length(min=1, max=10000)),
        vol.Optional("comment_id"): str,
        vol.Optional("uid"): str,
        vol.Optional("fields", default={}): FIELDS,
        vol.Optional("archived", default=True): bool,
    }
)
@websocket_api.async_response
async def ws_mutate(hass, connection, msg):
    try:
        coordinator = get_coordinator(hass, connection, msg["entity_id"], write=True)
        async with coordinator.mutation_lock:
            api = coordinator.api
            operation = msg["operation"]
            uid = msg.get("uid")
            fields = msg["fields"]
            if operation != "create" and uid is None:
                raise YuvomiError("Task ID is required")
            if operation == "create":
                if not fields.get("title", "").strip():
                    raise YuvomiError("Title is required")
                result = await api.create(fields)
            elif operation == "update":
                if "parent_task_id" in fields:
                    raise YuvomiError("Moving tasks between parents is not supported")
                result = await api.update(uid, fields)
            elif operation == "status":
                if "status" not in fields:
                    raise YuvomiError("Status is required")
                result = await api.status(uid, fields["status"])
            elif operation == "archive":
                result = await api.archive(uid, msg["archived"])
            elif operation == "comment":
                result = await api.add_comment(uid, msg.get("comment", ""))
            elif operation in {"edit_comment", "delete_comment"}:
                if "comment_id" not in msg:
                    raise YuvomiError("Comment ID is required")
                if operation == "edit_comment":
                    result = await api.edit_comment(uid, msg["comment_id"], msg.get("comment", ""))
                else:
                    result = await api.delete_comment(uid, msg["comment_id"])
            else:
                result = await api.delete(uid)
            await coordinator.async_refresh()
        connection.send_result(msg["id"], result)
    except YuvomiError as err:
        # A multi-step server operation can partly succeed; reconcile HA anyway.
        if "coordinator" in locals():
            await coordinator.async_request_refresh()
        connection.send_error(msg["id"], "yuvomi_error", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "yuvomi/comments",
        vol.Required("entity_id"): str,
        vol.Required("uid"): str,
    }
)
@websocket_api.async_response
async def ws_comments(hass, connection, msg):
    try:
        coordinator = get_coordinator(hass, connection, msg["entity_id"])
        connection.send_result(msg["id"], await coordinator.api.comments(msg["uid"]))
    except YuvomiError as err:
        connection.send_error(msg["id"], "yuvomi_error", str(err))


def async_register_commands(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_tasks)
    websocket_api.async_register_command(hass, ws_task)
    websocket_api.async_register_command(hass, ws_mutate)
    websocket_api.async_register_command(hass, ws_comments)
