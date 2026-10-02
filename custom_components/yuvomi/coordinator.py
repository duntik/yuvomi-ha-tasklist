"""Shared polling and mutation serialization."""

import asyncio
import logging
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import YuvomiApi, YuvomiAuthError, YuvomiError


class YuvomiCoordinator(DataUpdateCoordinator):
    """Keep task data outside entity properties."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, api: YuvomiApi) -> None:
        super().__init__(
            hass,
            logging.getLogger(__name__),
            name="Yuvomi tasks",
            config_entry=entry,
            update_interval=timedelta(seconds=30),
        )
        self.api = api
        self.entry = entry
        self.mutation_lock = asyncio.Lock()

    async def _async_update_data(self):
        try:
            return await self.api.tasks()
        except YuvomiAuthError as err:
            raise ConfigEntryAuthFailed(str(err)) from err
        except YuvomiError as err:
            raise UpdateFailed(str(err)) from err
