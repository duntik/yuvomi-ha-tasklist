"""Yuvomi Tasklist integration."""

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_URL, Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import YuvomiApi
from .const import CONF_ENHANCE_UI, CONF_TOKEN, DOMAIN, VERSION
from .coordinator import YuvomiCoordinator
from .websocket import async_register_commands


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    token = entry.data.get(CONF_TOKEN)
    if not isinstance(token, str) or not token.strip():
        raise ConfigEntryAuthFailed("Yuvomi API token is missing. Enter a tasks:write token.")
    api = YuvomiApi(async_get_clientsession(hass), entry.data[CONF_URL], token.strip())
    coordinator = YuvomiCoordinator(hass, entry, api)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    data = hass.data.setdefault(DOMAIN, {})
    if not data.get("registered"):
        async_register_commands(hass)
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    "/yuvomi_tasklist/yuvomi.js",
                    str(Path(__file__).parent / "frontend" / "yuvomi.js"),
                    False,
                )
            ]
        )
        data["registered"] = True
    if entry.options.get(CONF_ENHANCE_UI, entry.data.get(CONF_ENHANCE_UI, True)):
        add_extra_js_url(hass, f"/yuvomi_tasklist/yuvomi.js?v={VERSION}")
    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    await hass.config_entries.async_forward_entry_setups(entry, [Platform.TODO])
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, [Platform.TODO])


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
