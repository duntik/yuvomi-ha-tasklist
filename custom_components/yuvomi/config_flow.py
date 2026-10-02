"""Configure Yuvomi without YAML."""

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, OptionsFlow
from homeassistant.const import CONF_URL
from homeassistant.core import callback
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util import dt as dt_util

from .api import YuvomiApi, YuvomiAuthError, YuvomiError, normalize_url
from .const import CONF_ENHANCE_UI, CONF_TIME_ZONE, CONF_TOKEN, DOMAIN


class YuvomiConfigFlow(ConfigFlow, domain=DOMAIN):
    """Validate the task endpoint, not /auth/me (blocked for scoped tokens)."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return YuvomiOptionsFlow()

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            try:
                user_input[CONF_URL] = normalize_url(user_input[CONF_URL])
                user_input[CONF_TOKEN] = user_input[CONF_TOKEN].strip()
                if not user_input[CONF_TOKEN]:
                    raise ValueError("Empty token")
                if dt_util.get_time_zone(user_input[CONF_TIME_ZONE]) is None:
                    raise ValueError("Invalid timezone")
                api = YuvomiApi(
                    async_get_clientsession(self.hass), user_input[CONF_URL], user_input[CONF_TOKEN]
                )
                await api.tasks()
                await api.metadata()
            except ValueError:
                errors["base"] = "invalid_config"
            except YuvomiAuthError:
                errors["base"] = "invalid_auth"
            except YuvomiError:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(user_input[CONF_URL])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title="Yuvomi", data=user_input)
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_URL): str,
                    vol.Required(CONF_TOKEN): selector.TextSelector({"type": "password"}),
                    vol.Required(CONF_TIME_ZONE, default=self.hass.config.time_zone): str,
                    vol.Required(CONF_ENHANCE_UI, default=True): bool,
                }
            ),
            errors=errors,
        )

    async def async_step_reauth(self, entry_data):
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(self, user_input=None):
        entry = self._get_reauth_entry()
        errors = {}
        if user_input:
            token = user_input[CONF_TOKEN].strip()
            api = YuvomiApi(async_get_clientsession(self.hass), entry.data[CONF_URL], token)
            try:
                await api.tasks()
                await api.metadata()
            except YuvomiAuthError:
                errors["base"] = "invalid_auth"
            except YuvomiError:
                errors["base"] = "cannot_connect"
            else:
                return self.async_update_reload_and_abort(entry, data_updates={CONF_TOKEN: token})
        return self.async_show_form(
            step_id="reauth_confirm",
            data_schema=vol.Schema(
                {vol.Required(CONF_TOKEN): selector.TextSelector({"type": "password"})}
            ),
            errors=errors,
        )


class YuvomiOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input=None):
        errors = {}
        if user_input is not None:
            if dt_util.get_time_zone(user_input[CONF_TIME_ZONE]) is None:
                errors["base"] = "invalid_config"
            else:
                return self.async_create_entry(title="", data=user_input)
        values = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_TIME_ZONE, default=values[CONF_TIME_ZONE]): str,
                    vol.Required(CONF_ENHANCE_UI, default=values.get(CONF_ENHANCE_UI, True)): bool,
                }
            ),
            errors=errors,
        )
