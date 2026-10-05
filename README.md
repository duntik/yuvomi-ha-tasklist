# Yuvomi Tasklist for Home Assistant

Connect [Yuvomi](https://github.com/ulsklyc/yuvomi) tasks to the standard Home Assistant To-do section with two-way editing and an optional expanded task board. Install as one HACS integration; no additional container or dashboard card is required.

## Installation

1. Add `https://github.com/duntik/yuvomi-ha-tasklist` in **HACS > Custom repositories**, category **Integration**.
2. Download the latest release (enable pre-release versions if needed) and restart HA.
3. Create a Yuvomi API token under **Settings > API Tokens** with `tasks:write` access.
4. Add **Yuvomi Tasklist** in HA **Settings > Devices & services**. Enter the server URL, token and household timezone.
5. Enable **Enhance the built-in To-do interface**, refresh the browser and open **To-do lists > Yuvomi Tasks**.

For updates, select a release tag or `main`, not a commit hash. Restart HA and refresh the browser after downloading. If prompted, re-enter your API token.

Manual installation: extract `yuvomi-hacs.zip` from Releases, copy its `yuvomi` folder into `/config/custom_components/` and restart HA.

## Features

- Two-way task creation, editing, completion, reopening and deletion.
- Category groups, List/Kanban views, search and filters by category, status, assignee and priority.
- Sorting by due date, priority or title.
- Task details, assignee initials, descriptions, due dates and tags.
- Extended editor for priority, category, assignees, start/due dates, recurrence, points, visibility and locking.
- Subtask creation, editing and completion; task archive and restore.
- Reading, posting, editing and deleting comments, including author and timestamp. Drafts survive automatic refresh and failed edits. Deletion requires confirmation.

Yuvomi is the source of truth. Tasks refresh approximately every 30 seconds; writes request immediate refresh. Unedited fields are preserved by partial updates. Recurrence is calculated by Yuvomi.

## Permissions and credentials

Only tasks visible to the token owner are available. HA users allowed to access this entity act through that Yuvomi identity, including when posting comments. Entity read/control permissions are checked before API access. The token stays in HA configuration and is never sent to the browser. Redirects are rejected; enter the final server URL. Use HTTPS when sending credentials over untrusted networks.

## Compatibility and limits

This is an experimental release. CI runs against HA 2026.9.4; the manifest declares HA 2026.9.0 as the minimum. Live installation verification remains necessary.

The board uses internal HA frontend hooks. If an HA update breaks it, disable the enhancement and refresh the browser to return to the standard list. Other To-do providers keep their native view. Categories are task fields, not separate HA lists; existing Local To-do lists are not migrated.

Attachments, completion history, notifications and reward reports are not implemented. Yuvomi enforces comment ownership: authors may edit their comments; authors and Yuvomi administrators may delete them. Shopping lists are outside the scope. Keep the configured household timezone matched to Yuvomi. Concurrent edits to the same task field are last-write-wins.

## Development

Run Python tests with `python -m unittest discover -s tests -v` and frontend tests with `npm test`. HA-dependent tests run on Linux CI. DOM tests cover editor updates, board mounting, provider switching, filters, comments and draft preservation. See [DESIGN.md](DESIGN.md) for architecture.
