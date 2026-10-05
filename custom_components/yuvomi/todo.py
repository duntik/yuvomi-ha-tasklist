"""Standard Home Assistant To-do bridge."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from homeassistant.components.todo import (
    TodoItem,
    TodoItemStatus,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .api import YuvomiError
from .const import CONF_ENHANCE_UI, CONF_TIME_ZONE

FEATURES = (
    TodoListEntityFeature.CREATE_TODO_ITEM
    | TodoListEntityFeature.UPDATE_TODO_ITEM
    | TodoListEntityFeature.DELETE_TODO_ITEM
    | TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM
    | TodoListEntityFeature.SET_DUE_DATE_ON_ITEM
    | TodoListEntityFeature.SET_DUE_DATETIME_ON_ITEM
)


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([YuvomiTodo(entry.runtime_data)])


class YuvomiTodo(CoordinatorEntity, TodoListEntity):
    _attr_name = "Yuvomi Tasks"
    _attr_supported_features = FEATURES
    _attr_icon = "mdi:clipboard-list-outline"

    def __init__(self, coordinator):
        super().__init__(coordinator)
        self._attr_unique_id = f"{coordinator.entry.unique_id}_tasks"
        self.zone = ZoneInfo(
            coordinator.entry.options.get(CONF_TIME_ZONE)
            or coordinator.entry.data.get(CONF_TIME_ZONE)
            or coordinator.hass.config.time_zone
        )

    @property
    def extra_state_attributes(self):
        return {
            "yuvomi": True,
            "yuvomi_enhance_ui": self.coordinator.entry.options.get(
                CONF_ENHANCE_UI, self.coordinator.entry.data.get(CONF_ENHANCE_UI, True)
            ),
        }

    @property
    def todo_items(self):
        items = []
        for task in self.coordinator.data or []:
            if task.get("archived_at") or task.get("status") == "archived":
                continue
            due = None
            if task.get("due_date"):
                try:
                    due = (
                        datetime.fromisoformat(f"{task['due_date']}T{task['due_time']}").replace(
                            tzinfo=self.zone
                        )
                        if task.get("due_time")
                        else date.fromisoformat(task["due_date"])
                    )
                except ValueError:
                    due = None
            items.append(
                TodoItem(
                    uid=str(task["id"]),
                    summary=task["title"],
                    status=TodoItemStatus.COMPLETED
                    if task["status"] == "done"
                    else TodoItemStatus.NEEDS_ACTION,
                    description=task.get("description"),
                    due=due,
                )
            )
        return items

    def _fields(self, item):
        fields = {
            "title": item.summary,
            "description": item.description,
            "due_date": None,
            "due_time": None,
        }
        if isinstance(item.due, datetime):
            local = item.due.astimezone(self.zone)
            fields.update(due_date=local.date().isoformat(), due_time=local.strftime("%H:%M"))
        elif item.due:
            fields["due_date"] = item.due.isoformat()
        return fields

    async def async_create_todo_item(self, item):
        async with self.coordinator.mutation_lock:
            try:
                await self.coordinator.api.create(self._fields(item))
            except YuvomiError as err:
                raise HomeAssistantError(str(err)) from err
            finally:
                await self.coordinator.async_refresh()

    async def async_update_todo_item(self, item):
        async with self.coordinator.mutation_lock:
            try:
                current = await self.coordinator.api.task(item.uid)
                fields = {}
                for key, value in self._fields(item).items():
                    before = current.get(key)
                    if key == "due_time" and before:
                        before = before[:5]
                    if (before or None) != (value or None):
                        fields[key] = value
                if fields:
                    await self.coordinator.api.update(item.uid, fields)
                completed = current["status"] == "done"
                if completed != (item.status == TodoItemStatus.COMPLETED):
                    await self.coordinator.api.status(
                        item.uid, "done" if item.status == TodoItemStatus.COMPLETED else "open"
                    )
            except YuvomiError as err:
                raise HomeAssistantError(str(err)) from err
            finally:
                await self.coordinator.async_refresh()

    async def async_delete_todo_items(self, uids):
        async with self.coordinator.mutation_lock:
            try:
                for uid in uids:
                    await self.coordinator.api.delete(uid)
            except YuvomiError as err:
                raise HomeAssistantError(str(err)) from err
            finally:
                await self.coordinator.async_refresh()
