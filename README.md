# Yuvomi Tasklist for Home Assistant

Connect [Yuvomi](https://github.com/ulsklyc/yuvomi) tasks to Home Assistant's
**built-in To-do lists**, with two-way editing and an optional enhanced editor.

**0.1.0 is an experimental prototype.** The standard To-do bridge uses HA's
entity API. The UI enhancement intercepts Yuvomi editor requests and adds a
toolbar to the native To-do panel; it depends on frontend internals. It does
not modify Home Assistant Core, and has not yet been verified on a live
Home Assistant + Yuvomi installation. Start with test tasks.

## Installation / Установка

[Пошаговая инструкция на русском](INSTALL.ru.md)

1. In **HACS → ⋮ → Custom repositories**, add
   `https://github.com/duntik/yuvomi-ha-tasklist`, category **Integration**.
2. Download **Yuvomi Tasklist**, then restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration → Yuvomi Tasklist**.
4. Enter your Yuvomi address (e.g. `http://192.168.1.50:3000`), API token and
   the **household timezone from Yuvomi**. The address must be reachable from HA.
5. Open the standard **To-do lists** section and select **Yuvomi Tasks**.
   Refresh the browser tab after installation to load the enhanced editor.

В HACS добавь этот репозиторий как **Integration**, скачай и перезапусти HA.
Затем добавь **Yuvomi Tasklist** в «Настройки → Устройства и службы».
Введи адрес Yuvomi, токен и часовой пояс семьи. Список появится в стандартном
разделе «Списки дел». Открытие задачи покажет расширенный редактор.

No extra Proxmox container, dashboard resource or custom card is required.
Manual installation: copy `custom_components/yuvomi` into
`/config/custom_components/yuvomi` and restart HA.

## Token

In Yuvomi, create a token under **Settings → API Tokens** with **tasks:write**
(includes read). Token management may require a Yuvomi admin account.
Only tasks visible to the token's user are available to HA. HA users allowed
to access this To-do entity can access those tasks through the integration;
Yuvomi does not receive each HA user's identity.

Use HTTPS when passing the token over an untrusted network. The token stays
in HA configuration; the browser talks to HA, not directly to Yuvomi.
Redirects are rejected: enter the final server URL, not a redirecting address.

## Features

| Feature | Standard HA To-do | Enhanced editor |
|---|---|---|
| Add, rename, complete, reopen, delete | Yes | Yes |
| Description and due date/time | Yes | Yes |
| Open / in progress / done | Two HA statuses | All three |
| Priority, category, tags | — | Yes |
| Multiple assignees | — | Yes |
| Start date | — | Yes |
| Recurrence and repeat from completion | Server-managed | Editable |
| Points, visibility, definition lock | — | Editable |
| Subtasks | — | Add, complete, open editor |
| Archive / restore | — | Yes |
| Search and category/status filters | — | Native panel's Yuvomi toolbar |

Yuvomi is the source of truth. Changes made in Yuvomi appear in HA within
about 30 seconds; writes from HA request an immediate refresh. Recurrence
is calculated by Yuvomi, including creation of the next occurrence.
Unedited fields are not sent by the enhanced editor. Concurrent edits to the
same field are last-write-wins; there is no conflict-resolution UI.

## Limits and compatibility

- Target: **HA 2026.9.4**; minimum declared version **2026.9.0**. API contract
  researched from Yuvomi on 2 October 2026. Older Yuvomi versions may lack
  metadata, archive or scoped-token endpoints; the minimum version is not yet
  established by live tests.
- The native editor is replaced **only for Yuvomi entities** when the optional
  enhancement is enabled. Other To-do integrations keep their standard UI.
- The enhanced dialog is our own component inside the native To-do flow; this
  is not an upstream extension of HA's `TodoItem` data model. Full upstream
  model changes remain a separate project.
- Disable **Enhance the built-in To-do interface** in the integration's options
  if an HA frontend update causes trouble, then reload the browser. The normal
  To-do bridge remains usable.
- One HA list shows top-level Yuvomi tasks. Categories are fields, not separate
  HA lists. Existing Local To-do lists are not merged or migrated.
- Comments, attachments, completion history, notifications and reward reports
  are not implemented yet. Shopping lists are outside this release's scope.
- Times use the configured Yuvomi household timezone. Keep it matched to Yuvomi.
- The overview fetches on opening/refresh. It is not a live subscription; close
  and reopen the task editor to see changes made elsewhere while editing.

## Development and validation

```sh
python -m pip install aiohttp ruff
python -m unittest discover -s tests -v
npm ci
npm test
ruff check .
ruff format --check .
```

Linux CI also installs HA 2026.9.4 and tests the entity adapter and websocket
permission boundaries against its real Python API. Local Windows runs skip
those HA-specific tests. HTTP tests use a local fake server; frontend tests
use a DOM fixture. These checks do not substitute for a real HA/Yuvomi test.

Before calling the integration stable, verify creation, rename, status changes,
recurrence, permissions, subtasks, archive and browser/mobile layout on an
actual installation. This repository is installable as a HACS custom
repository; it is not currently included in the default HACS catalog.
