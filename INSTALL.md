# Installation and updates

Follow the installation steps in [README.md](README.md).

For an update, use HACS **Download again** and choose the latest release. Enable pre-release versions if needed. Select a release tag or `main`, not a commit hash. Restart Home Assistant, then refresh the browser with Ctrl+Shift+R.

If a token is missing, HA requests reauthentication. Enter a Yuvomi API token with `tasks:write` access. Do not share it in logs or issue reports.

For manual installation, extract `yuvomi-hacs.zip` from Releases and copy the `yuvomi` directory into `/config/custom_components/`. Restart HA.

Enable **Enhance the built-in To-do interface** in the integration options to show the task board. Disable this option if an HA frontend update causes problems; the standard To-do entity remains available.
