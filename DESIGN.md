# Design

Yuvomi is the source of truth. A Home Assistant coordinator polls tasks every 30 seconds. One standard To-do entity provides basic editing; a backend websocket API exposes extended fields and comments to the optional frontend.

Websocket requests enforce entity read/control permissions, verify the integration is loaded and serialize writes through a mutation lock. The API client validates IDs and response shapes and rejects redirects. Credentials never reach the browser. Missing tokens trigger reauthentication; missing timezone settings use the HA timezone.

The optional board mounts inside the native To-do panel for Yuvomi entities and restores the normal view for other providers. It provides category groups, filters, sorting, List/Kanban, task details, subtasks and comments. The editor sends partial updates to preserve unedited fields. Comments are rendered as plain text; drafts are stored in browser memory by task ID. Comment authors use the token owner's identity.

The hook depends on HA frontend internals and does not extend the upstream TodoItem model. Task field conflicts remain last-write-wins. Attachments, history and notifications are not implemented. Comment edits and deletes use task-scoped API endpoints with validated IDs; Yuvomi enforces ownership and administrator permissions. Automated tests do not replace live installation verification.
