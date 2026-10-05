/* Yuvomi enhancement for the built-in To-do section. No Yuvomi token in JS. */
export const changedFields = (original, fields) => Object.fromEntries(
  Object.entries(fields).filter(([key, value]) => {
    let before = original[key];
    if (key === "assigned_to") before = original.assigned_to instanceof Array ? original.assigned_to : (original.assigned_users || []).map((u) => Number(u.id));
    if (typeof value === "boolean") before = Boolean(before);
    if (Array.isArray(value)) return JSON.stringify([...value].sort()) !== JSON.stringify([...(before || [])].sort());
    return (before ?? "") !== (value ?? "");
  })
);

const words = {
  en: { title: "Title", description: "Description", priority: "Priority", category: "Category", status: "Status",
    open: "Open", in_progress: "In progress", done: "Done", none: "None", low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
    assigned: "Assigned to", start: "Start date", due: "Due date", time: "Due time", tags: "Tags (comma separated)",
    repeat: "Repeat", DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly", custom: "Custom",
    rule: "Recurrence rule", fromCompletion: "Repeat from completion", points: "Points", visibility: "Visibility",
    all: "Household", private: "Private", assignees: "Assignees", locked: "Lock definition", save: "Save", cancel: "Cancel",
    delete: "Delete", archive: "Archive", restore: "Restore", subtasks: "Subtasks", add: "Add", loading: "Loading…",
    new: "New task", filters: "Yuvomi · filters and archive", search: "Search", any: "All", archived: "Show archive",
    advanced: "Additional settings", confirm: "Delete this task and its subtasks?", missing: "Title is required",
    refresh: "Refresh", stale: "The task changed in Yuvomi. Reload it before saving.",
    saved: "Saved", retry: "Retry", close: "Close", timezone: "Dates use the Yuvomi household timezone configured in HA",
  },

};

const css = `
  :host {font:14px var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif);color:var(--primary-text-color,#202124)}
  dialog {box-sizing:border-box;width:min(650px,calc(100vw - 24px));max-height:90dvh;border:0;border-radius:16px;
    background:var(--card-background-color,#fff);color:inherit;padding:0;box-shadow:0 10px 40px #0005}
  dialog::backdrop {background:#0007} header,footer {padding:16px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  header {border-bottom:1px solid var(--divider-color,#ddd)} h2 {font-size:20px;margin:0;flex:1}
  main {padding:16px 20px;overflow:auto} footer {border-top:1px solid var(--divider-color,#ddd);justify-content:flex-end}
  label {display:block;margin:12px 0 4px} input,textarea,select {box-sizing:border-box;font:inherit;background:var(--secondary-background-color,#f5f5f5);
    color:inherit;border:1px solid var(--divider-color,#ccc);border-radius:8px;padding:10px;width:100%;min-height:40px}
  input[type=checkbox] {width:20px;min-height:20px;margin:0 8px 0 0;vertical-align:middle}
  button {font:inherit;cursor:pointer;color:var(--primary-color,#03a9f4);background:transparent;border:1px solid var(--divider-color,#ddd);
    border-radius:8px;padding:10px 14px;min-height:40px} button:disabled {opacity:.5;cursor:wait}
  .primary {background:var(--primary-color,#03a9f4);color:var(--text-primary-color,#fff);border:0}
  .danger {color:var(--error-color,#b00020)} .grid {display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
  .error {white-space:pre-wrap;color:var(--error-color,#b00020);padding:8px 0} .hint {color:var(--secondary-text-color,#666);font-size:12px}
  .row {display:flex;gap:8px;align-items:center;margin:8px 0}.row input {flex:1} .row button {flex-shrink:0}
  .task {padding:12px 0;border-bottom:1px solid var(--divider-color,#ddd)} .task button {width:100%;text-align:start}
  .badges {font-size:12px;color:var(--secondary-text-color,#666);margin-top:5px} details {margin:16px 0} summary {cursor:pointer}
  @media(max-width:430px) {.grid {grid-template-columns:1fr} header,main,footer {padding:12px} dialog {max-height:95dvh}}
`;

const element = (tag, props = {}, text) => {
  const node = document.createElement(tag);
  Object.assign(node, props);
  if (text !== undefined) node.textContent = String(text);
  return node;
};

const hassFromEvent = (event) => event.composedPath().find((node) => node?.hass)?.hass
  || document.querySelector("home-assistant")?.hass;

function launch(hass, entityId, uid = null, overview = false, parentId = null) {
  const dialog = document.createElement("yuvomi-task-dialog");
  Object.assign(dialog, {hass, entityId, uid, overview, parentId});
  document.body.append(dialog);
  return dialog;
}

if (typeof window !== "undefined") {
  class YuvomiTaskDialog extends HTMLElement {
    connectedCallback() {
      this.attachShadow({mode: "open"});
      this.language = "en";
      this.t = (key) => words[this.language][key] || key;
      this.shadowRoot.append(element("style", {}, css));
      this.dialog = element("dialog");
      this.shadowRoot.append(this.dialog);
      this.dialog.setAttribute("aria-label", "Yuvomi");
      this.dialog.addEventListener("cancel", (event) => {event.preventDefault(); this.close();});
      this.returnFocus = document.activeElement;
      this.dialog.showModal();
      this.load();
    }
    disconnectedCallback() { this.destroyed = true; }
    close() {
      if (this.busy) return;
      this.dialog.close(); this.remove(); this.returnFocus?.focus?.();
    }
    async call(type, fields = {}) { return this.hass.callWS({type, entity_id: this.entityId, ...fields}); }
    button(text, handler, className = "", translate = true) {
      const button = element("button", {type: "button", className}, translate ? this.t(text) : text);
      button.addEventListener("click", handler); return button;
    }
    frame(title) {
      this.dialog.replaceChildren();
      const header = element("header"); header.append(element("h2", {}, title), this.button("close", () => this.close()));
      this.main = element("main"); this.footer = element("footer"); this.error = element("div", {className: "error"});
      this.error.setAttribute("role", "alert");
      this.dialog.append(header, this.error, this.main, this.footer);
    }
    async load() {
      this.frame(`Yuvomi · ${this.t("loading")}`);
      try {
        if (this.overview) {
          const result = await this.call("yuvomi/tasks", {archived: Boolean(this.showArchive)});
          this.tasks = result.tasks; this.metadata = result.metadata; this.renderOverview();
        } else {
          const result = this.uid ? await this.call("yuvomi/task", {uid: String(this.uid)})
            : await this.call("yuvomi/tasks");
          this.task = result.task || {title: "", status: "open", priority: "none", category: "misc", parent_task_id: this.parentId};
          this.metadata = result.metadata; this.renderEditor();
        }
      } catch (error) {
        this.error.textContent = error.message || String(error);
        this.footer.append(this.button("retry", () => this.load()));
      }
    }
    field(container, key, label, value = "", type = "text", options = null) {
      const id = `yuvomi-${key}`;
      const control = element(options ? "select" : type === "textarea" ? "textarea" : "input", {id});
      if (options) for (const [value, text] of options) control.append(element("option", {value: String(value)}, text));
      else if (type !== "textarea") control.type = type;
      control.value = value ?? "";
      const caption = element("label", {htmlFor: id}, this.t(label));
      container.append(caption, control); this.controls[key] = control; return control;
    }
    check(container, key, label, checked) {
      const caption = element("label"); const control = element("input", {type: "checkbox", checked: Boolean(checked)});
      caption.append(control, document.createTextNode(this.t(label))); container.append(caption); this.controls[key] = control;
    }
    async action(operation, data = {}) {
      if (this.busy) return null;
      this.busy = true;
      this.dialog.querySelectorAll("button").forEach((button) => {button.disabled = true;});
      this.error.textContent = "";
      try {
        const result = await this.call("yuvomi/mutate", {operation, ...data});
        window.dispatchEvent(new window.CustomEvent("yuvomi-task-changed", {detail: {entityId: this.entityId}}));
        return result;
      }
      catch (error) { this.error.textContent = error.message || String(error); return null; }
      finally { this.busy = false; this.dialog.querySelectorAll("button").forEach((button) => {button.disabled = false;}); }
    }
    renderEditor() {
      if (this.destroyed) return;
      const task = this.task;
      this.frame(`Yuvomi · ${this.uid ? task.title : this.t("new")}`);
      this.controls = {};
      this.field(this.main, "title", "title", task.title).required = true;
      this.field(this.main, "description", "description", task.description, "textarea").rows = 3;
      const grid = element("div", {className: "grid"}); this.main.append(grid);
      const slot = () => {const node = element("div"); grid.append(node); return node;};
      this.field(slot(), "status", "status", task.status, "text", ["open", "in_progress", "done"].map((s) => [s, this.t(s)]));
      this.field(slot(), "priority", "priority", task.priority, "text", ["none", "low", "medium", "high", "urgent"].map((s) => [s, this.t(s)]));
      const categories = (this.metadata.categories || []).map((category) => [category.key, category.name || category.key]);
      if (!categories.some(([key]) => key === task.category)) categories.push([task.category || "misc", task.category || "misc"]);
      this.field(slot(), "category", "category", task.category, "text", categories);
      this.field(slot(), "start_date", "start", task.start_date, "date");
      this.field(slot(), "due_date", "due", task.due_date, "date");
      this.field(slot(), "due_time", "time", task.due_time, "time");
      this.main.append(element("p", {className: "hint"}, this.t("timezone")));
      const assignments = element("details", {open: Boolean(task.assigned_users?.length)});
      assignments.append(element("summary", {}, this.t("assigned")));
      this.assignees = new Map();
      const users = new Map([...(this.metadata.users || []), ...(task.assigned_users || [])].map((user) => [user.id, user]));
      for (const user of users.values()) {
        const label = element("label"); const input = element("input", {type: "checkbox", checked: (task.assigned_users || []).some((u) => u.id === user.id)});
        label.append(input, document.createTextNode(user.display_name)); assignments.append(label); this.assignees.set(Number(user.id), input);
      }
      this.main.append(assignments);
      this.field(this.main, "tags", "tags", (task.tags || []).join(", "));
      const advanced = element("details"); advanced.append(element("summary", {}, this.t("advanced"))); this.main.append(advanced);
      const rule = task.recurrence_rule || "";
      const simple = /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)$/.exec(rule)?.[1];
      const repeat = this.field(advanced, "repeat", "repeat", task.is_recurring ? simple || "custom" : "none", "text",
        ["none", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "custom"].map((s) => [s, this.t(s)]));
      const ruleContainer = element("div"); advanced.append(ruleContainer);
      this.field(ruleContainer, "recurrence_rule", "rule", rule);
      const showRule = () => {ruleContainer.hidden = repeat.value !== "custom";}; repeat.addEventListener("change", showRule); showRule();
      this.check(advanced, "recurrence_from_completion", "fromCompletion", task.recurrence_from_completion);
      this.field(advanced, "points", "points", task.points ?? this.metadata.default_points ?? 0, "number").min = "0";
      this.controls.points.max = "10000";
      this.field(advanced, "visibility", "visibility", task.visibility || "all", "text", ["all", "private", "assignees"].map((s) => [s, this.t(s)]));
      this.check(advanced, "locked", "locked", task.locked);
      if (this.uid && !task.parent_task_id) this.renderSubtasks();
      if (this.uid) {
        this.footer.append(this.button(task.archived_at ? "restore" : "archive", async () => {
          if (await this.action("archive", {uid: String(this.uid), archived: !task.archived_at})) this.close();
        }));
        this.footer.append(this.button("delete", async () => {
          if (window.confirm(this.t("confirm")) && await this.action("delete", {uid: String(this.uid)})) this.close();
        }, "danger"));
      }
      this.footer.append(this.button("cancel", () => this.close()), this.button("save", () => this.save(), "primary"));
      this.initialFields = this.fields();
      this.controls.title.focus();
    }
    renderSubtasks() {
      this.main.append(element("h3", {}, this.t("subtasks")));
      for (const subtask of this.task.subtasks || []) {
        this.main.append(this.subtaskRow(subtask));
      }
      const row = element("div", {className: "row"}); const input = element("input", {placeholder: this.t("new")});
      input.setAttribute("aria-label", this.t("new"));
      row.append(input, this.button("add", async () => {
        if (!input.value.trim()) return;
        const result = await this.action("create", {fields: {title: input.value.trim(), parent_task_id: Number(this.uid)}});
        if (result?.data?.id) {input.value = ""; row.before(this.subtaskRow(result.data));}
      })); this.main.append(row);
    }
    subtaskRow(subtask) {
        const row = element("div", {className: "row"});
        const checkbox = element("input", {type: "checkbox", checked: subtask.status === "done"});
        checkbox.setAttribute("aria-label", subtask.title);
        checkbox.addEventListener("change", async () => {
          const status = checkbox.checked ? "done" : "open";
          const result = await this.action("status", {uid: String(subtask.id), fields: {status}});
          // Keep unsaved parent fields; only revert a failed subtask toggle.
          if (this.error.textContent) checkbox.checked = subtask.status === "done";
          else if (result) subtask.status = status;
        });
        const edit = this.button(subtask.title, () => launch(this.hass, this.entityId, subtask.id), "", false);
        row.append(checkbox, edit); return row;
    }
    fields() {
      const c = this.controls; const repeat = c.repeat.value;
      return {title: c.title.value.trim(), description: c.description.value || null, priority: c.priority.value,
        category: c.category.value, status: c.status.value, start_date: c.start_date.value || null,
        due_date: c.due_date.value || null, due_time: c.due_date.value ? c.due_time.value || null : null,
        assigned_to: [...this.assignees].filter(([, input]) => input.checked).map(([id]) => id),
        tags: [...new Set(c.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean))],
        is_recurring: repeat !== "none", recurrence_rule: repeat === "none" ? null : repeat === "custom" ? c.recurrence_rule.value : `FREQ=${repeat}`,
        recurrence_from_completion: c.recurrence_from_completion.checked,
        points: Number(c.points.value), visibility: c.visibility.value, locked: c.locked.checked};
    }
    async save() {
      if (this.busy) return;
      if (!this.controls.title.value.trim()) {this.error.textContent = this.t("missing"); return;}
      if (![...Object.values(this.controls)].every((c) => c.reportValidity())) return;
      const fields = this.uid ? changedFields(this.initialFields, this.fields()) : this.fields();
      if (!this.uid && this.parentId) fields.parent_task_id = this.parentId;
      if (!Object.keys(fields).length) {this.close(); return;}
      // Partial updates preserve fields changed elsewhere that this editor never touched.
      if (await this.action(this.uid ? "update" : "create", {fields, ...(this.uid ? {uid: String(this.uid)} : {})})) this.close();
    }
    renderOverview() {
      if (this.destroyed) return;
      this.frame("Yuvomi"); this.controls = {};
      const search = this.field(this.main, "search", "search", this.search || "", "search");
      const categories = this.field(this.main, "category", "category", this.category || "", "text",
        [["", this.t("any")], ...(this.metadata.categories || []).map((c) => [c.key, c.name || c.key])]);
      const status = this.field(this.main, "status", "status", this.status || "", "text",
        [["", this.t("any")], ...["open", "in_progress", "done"].map((s) => [s, this.t(s)])]);
      this.check(this.main, "archived", "archived", this.showArchive);
      this.controls.archived.addEventListener("change", () => {this.showArchive = this.controls.archived.checked; this.load();});
      const list = element("div"); this.main.append(list);
      const renderList = () => {
        this.search = search.value; this.category = categories.value; this.status = status.value;
        list.replaceChildren();
        for (const task of this.tasks.filter((task) => (!this.category || task.category === this.category)
          && (!this.status || task.status === this.status)
          && task.title.toLocaleLowerCase().includes(this.search.toLocaleLowerCase()))) {
          const row = element("div", {className: "task"});
          row.append(this.button(task.title, () => {this.overview = false; this.uid = task.id; this.load();}, "", false));
          const assigned = (task.assigned_users || []).map((u) => u.display_name).join(", ");
          row.append(element("div", {className: "badges"}, [this.t(task.status), this.t(task.priority), task.category,
            task.due_date, assigned, task.archived_at ? this.t("archive") : ""].filter(Boolean).join(" · ")));
          list.append(row);
        }
      };
      for (const field of [search, categories, status]) field.addEventListener("input", renderList);
      renderList();
      this.footer.append(this.button("refresh", () => this.load()), this.button("new", () => {
        this.overview = false; this.uid = null; this.load();
      }, "primary"));
    }
  }
  if (!customElements.get("yuvomi-task-dialog")) customElements.define("yuvomi-task-dialog", YuvomiTaskDialog);

  // Intercept only Yuvomi's native editor requests. Other To-do providers are untouched.
  window.addEventListener("show-dialog", (event) => {
    if (event.detail?.dialogTag !== "dialog-todo-item-editor") return;
    const params = event.detail.dialogParams; const hass = hassFromEvent(event);
    if (!hass?.states[params?.entity]?.attributes.yuvomi_enhance_ui) return;
    event.preventDefault(); event.stopImmediatePropagation();
    launch(hass, params.entity, params.item?.uid || null);
  }, true);

  class YuvomiTaskBoard extends YuvomiTaskDialog {
    connectedCallback() {
      this.attachShadow({mode: "open"});
      this.language = "en";
      this.t = (key) => words.en[key] || key;
      this.overview = true;
      this.shadowRoot.append(element("style", {}, css + `
        :host{display:block;width:100%;box-sizing:border-box;padding:16px}
        .board{max-width:1400px;margin:auto} header{padding:0 0 16px;gap:8px}
        header input{flex:1;min-width:160px;width:auto} header select{width:auto;max-width:180px}
        .workspace{display:grid;grid-template-columns:minmax(280px,1fr) minmax(300px,1.2fr);gap:20px}
        .list,.detail{background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:14px;overflow:hidden}
        .list{max-height:calc(100dvh - 220px);overflow:auto}.detail{padding:20px;align-self:start;position:sticky;top:16px}
        .task{display:flex;gap:12px;padding:16px;align-items:center}.task button{border:0;padding:0;min-height:24px}
        .task input{flex-shrink:0}.task .body{flex:1;min-width:0}.task.selected{background:var(--secondary-background-color)}
        .group{margin:0;padding:14px 16px;font-size:13px;color:var(--secondary-text-color);background:var(--secondary-background-color)}
        .avatars{display:flex;gap:4px}.avatar{border-radius:50%;padding:5px;background:var(--primary-color);color:var(--text-primary-color);font-size:11px}
        .detail h2{margin-bottom:20px}.detail dt{color:var(--secondary-text-color);font-size:12px;margin-top:16px}.detail dd{margin:6px 0;white-space:pre-wrap}
        .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.description{white-space:pre-wrap}.kanban{display:grid;grid-template-columns:repeat(3,minmax(200px,1fr));gap:12px;overflow:auto}
        .empty{padding:20px;color:var(--secondary-text-color)}
        @media(max-width:850px){.workspace{grid-template-columns:1fr}.detail{position:static}.list{max-height:55dvh}.kanban{grid-template-columns:1fr}header select{max-width:140px}}
      `));
      this.dialog = element("div", {className: "board"});
      this.shadowRoot.append(this.dialog);
      this.load();
      this.refreshTimer = setInterval(() => {if (!this.busy) this.load();}, 30000);
      this.onChange = (event) => {if (event.detail.entityId === this.entityId) {this.detailTask = null;this.load();}};
      window.addEventListener("yuvomi-task-changed", this.onChange);
    }
    disconnectedCallback() {this.destroyed = true; clearInterval(this.refreshTimer);window.removeEventListener("yuvomi-task-changed", this.onChange);}
    frame() {
      if (this.tasks) return;
      this.dialog.replaceChildren();
      this.error = element("div", {className: "error"});this.error.setAttribute("role", "alert");
      this.main = element("div", {}, "Loading tasks…");this.footer = element("footer");
      this.dialog.append(this.error, this.main, this.footer);
    }
    async load() {
      if (this.loading) return;
      this.loading = true;
      this.frame();
      try {
        const result = await this.call("yuvomi/tasks", {archived: Boolean(this.showArchive)});
        if (this.destroyed) return;
        this.tasks = result.tasks;this.metadata = result.metadata;this.detailTask = null;this.renderOverview();
      } catch (err) {if (!this.destroyed) this.error.textContent = err.message || String(err);}
      finally {this.loading = false;}
    }
    async mutate(task, operation, fields = {}) {
      if (this.busy) return;
      this.busy = true;
      try {
        await this.call("yuvomi/mutate", {operation, uid: String(task.id), ...fields});
        this.detailTask = null;
        await this.load();
      } catch (err) {this.error.textContent = err.message || String(err);}
      finally {this.busy = false;}
    }
    categoryName(key) {return (this.metadata.categories || []).find((c) => c.key === key)?.name || key || "Miscellaneous";}
    renderOverview() {
      const active = this.shadowRoot.activeElement;
      const selection = active?.selectionStart;
      const focusSearch = active?.id === "board-search";
      this.dialog.replaceChildren();
      const header = element("header");header.append(element("h2", {}, "Tasks"));
      const search = element("input", {id: "board-search", type: "search", placeholder: "Search tasks…", value: this.search || ""});
      search.setAttribute("aria-label", "Search tasks");
      search.addEventListener("input", () => {this.search = search.value;this.renderOverview();});
      header.append(search);
      const select = (label, options, value, change) => {
        const control = element("select");control.setAttribute("aria-label", label);
        for (const [key, name] of options) control.append(element("option", {value: key}, name));
        control.value = value || "";control.addEventListener("change", () => {change(control.value);this.renderOverview();});
        header.append(control);
      };
      select("Category", [["", "All categories"], ...(this.metadata.categories || []).map((c) => [c.key, c.name || c.key])], this.category, (value) => {this.category = value;});
      select("Status", [["", "Active"], ["all", "All statuses"], ...["open", "in_progress", "done"].map((key) => [key, this.t(key)])], this.status, (value) => {this.status = value;});
      select("Assignee", [["", "All assignees"], ...(this.metadata.users || []).map((u) => [String(u.id), u.display_name])], this.assignee, (value) => {this.assignee = value;});
      select("Priority", [["", "All priorities"], ...["none", "low", "medium", "high", "urgent"].map((key) => [key, this.t(key)])], this.priority, (value) => {this.priority = value;});
      select("Sort", [["", "Default order"], ["due", "Due date"], ["priority", "Priority"], ["title", "Title"]], this.sort, (value) => {this.sort = value;});
      header.append(this.button(this.kanban ? "List view" : "Kanban view", () => {this.kanban = !this.kanban;this.renderOverview();}, "", false));
      header.append(this.button(this.showArchive ? "Show active" : "archive", () => {this.showArchive = !this.showArchive;this.load();}));
      header.append(this.button("refresh", () => this.load()), this.button("new", () => launch(this.hass, this.entityId), "primary"));
      this.error = element("div", {className: "error"});this.error.setAttribute("role", "alert");
      const workspace = element("div", {className: "workspace"});
      const list = element("div", {className: this.kanban ? "kanban" : "list"});
      const tasks = this.tasks.filter((task) => !task.parent_task_id
        && (!this.category || task.category === this.category)
        && (this.status === "all" || (this.status ? task.status === this.status : task.status !== "done"))
        && (!this.assignee || (task.assigned_users || []).some((u) => String(u.id) === this.assignee))
        && (!this.priority || task.priority === this.priority)
        && `${task.title} ${task.description || ""}`.toLocaleLowerCase().includes((this.search || "").toLocaleLowerCase()));
      if (this.sort === "due") tasks.sort((a,b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));
      if (this.sort === "title") tasks.sort((a,b) => a.title.localeCompare(b.title));
      if (this.sort === "priority") {const rank = {urgent:4,high:3,medium:2,low:1,none:0};tasks.sort((a,b) => (rank[b.priority] || 0) - (rank[a.priority] || 0));}
      const groups = new Map();
      if (this.kanban) for (const status of ["open", "in_progress", "done"]) groups.set(status, []);
      for (const task of tasks) {const key = this.kanban ? task.status : task.category || "misc";if (!groups.has(key)) groups.set(key, []);groups.get(key).push(task);}
      for (const [key, group] of groups) {
        const section = element("section");section.append(element("h3", {className: "group"}, `${this.kanban ? this.t(key) : this.categoryName(key)} · ${group.length}`));
        for (const task of group) {
          const row = element("div", {className: `task${String(this.selectedId) === String(task.id) ? " selected" : ""}`});
          const checkbox = element("input", {type: "checkbox", checked: task.status === "done", disabled: this.busy});checkbox.setAttribute("aria-label", `Complete ${task.title}`);
          checkbox.addEventListener("change", () => this.mutate(task, "status", {fields: {status: checkbox.checked ? "done" : "open"}}));
          const body = element("div", {className: "body"});body.append(this.button(task.title, () => {this.selectedId = task.id;this.detailTask = null;this.renderOverview();}, "", false));
          body.append(element("div", {className: "badges"}, [task.status === "in_progress" ? "In progress" : "", task.priority !== "none" ? this.t(task.priority || "") : "", task.due_date, task.is_recurring ? "Repeats" : "", (task.tags || []).join(", ")].filter(Boolean).join(" · ")));
          const avatars = element("div", {className: "avatars"});
          for (const user of task.assigned_users || []) {const avatar = element("span", {className: "avatar", title: user.display_name}, (user.display_name || "?").split(/\s+/).map((s) => s[0]).slice(0,2).join(""));avatars.append(avatar);}
          row.append(checkbox, body, avatars);section.append(row);
        }
        list.append(section);
      }
      if (!tasks.length) list.append(element("div", {className: "empty"}, "No matching tasks"));
      this.detail = element("aside", {className: "detail"});
      const selected = tasks.find((t) => String(t.id) === String(this.selectedId));
      if (selected) {this.renderDetail(this.detailTask?.id === selected.id ? this.detailTask : selected);this.loadDetail(selected);}
      else this.detail.append(element("div", {className: "empty"}, "Select a task to see details"));
      workspace.append(list, this.detail);this.dialog.append(header, this.error, workspace);
      if (focusSearch) {search.focus();search.setSelectionRange(selection, selection);}
    }
    async loadDetail(task) {
      try {
        const result = await this.call("yuvomi/task", {uid: String(task.id)});
        if (!this.destroyed && this.selectedId === task.id) {
          this.detailTask = result.task;this.renderDetail(result.task);
          const target = this.commentsContainer;
          try {
            const comments = await this.call("yuvomi/comments", {uid: String(task.id)});
            if (!this.destroyed && this.selectedId === task.id && target.isConnected) {
              target.replaceChildren();
              for (const comment of comments) {
                const row = element("div", {className: "task"});
                const body = element("div", {className: "body"});
                body.append(element("strong", {}, comment.author_name || "Unknown author"), element("div", {className: "badges"}, comment.created_at || ""), element("div", {className: "description"}, comment.comment));
                row.append(body);
                if (comment.id) {
                  body.append(this.button("Edit comment", () => this.editComment(task, comment, body), "", false));
                  body.append(this.button("Delete comment", async () => {
                    if (!window.confirm("Delete this comment?")) return;
                    await this.changeComment(task, "delete_comment", comment.id);
                  }, "danger", false));
                  if (this.commentEdits?.[comment.id] !== undefined) this.editComment(task, comment, body);
                }
                target.append(row);
              }
              if (!comments.length) target.textContent = "No comments yet";
            }
          } catch (err) {if (target.isConnected) target.textContent = `Comments unavailable: ${err.message || err}`;}
        }
      } catch (err) {this.error.textContent = err.message || String(err);}
    }
    renderDetail(task) {
      this.detail.replaceChildren(element("h2", {}, task.title));
      this.detail.append(this.button("Edit", () => launch(this.hass, this.entityId, task.id), "", false));
      const fields = element("dl");
      for (const [label, value] of [["Status", this.t(task.status)], ["Category", this.categoryName(task.category)], ["Priority", this.t(task.priority || "none")], ["Assigned to", (task.assigned_users || []).map((u) => u.display_name).join(", ") || "Unassigned"], ["Due date", [task.due_date, task.due_time].filter(Boolean).join(" ")], ["Description", task.description], ["Tags", (task.tags || []).join(", ")]]) {
        if (value) fields.append(element("dt", {}, label), element("dd", {}, value));
      }
      this.detail.append(fields, element("h3", {}, "Subtasks"));
      for (const subtask of task.subtasks || []) this.detail.append(this.subtaskRow(subtask));
      this.detail.append(this.button("Add subtask", () => launch(this.hass, this.entityId, null, false, task.id), "", false));
      const actions = element("div", {className: "actions"});
      actions.append(this.button(task.status === "done" ? "Reopen" : "Complete", () => this.mutate(task, "status", {fields: {status: task.status === "done" ? "open" : "done"}}), "primary", false));
      if (task.status === "open") actions.append(this.button("Start", () => this.mutate(task, "status", {fields: {status: "in_progress"}}), "", false));
      actions.append(this.button(task.archived_at ? "restore" : "archive", () => this.mutate(task, "archive", {archived: !task.archived_at})));
      actions.append(this.button("delete", () => {if (window.confirm(this.t("confirm"))) this.mutate(task, "delete");}, "danger"));
      this.detail.append(actions);
      this.detail.append(element("h3", {}, "Comments"));
      this.commentsContainer = element("div", {className: "comments"}, "Loading comments…");
      const draft = element("textarea", {placeholder: "Write a comment…", maxLength:10000, value:this.commentDrafts?.[task.id] || ""});
      draft.setAttribute("aria-label", "Write a comment");
      draft.addEventListener("input", () => {this.commentDrafts ||= {};this.commentDrafts[task.id] = draft.value;});
      const send = this.button("Post comment", async () => {
        if (!draft.value.trim() || this.busy) return;
        send.disabled = true;this.busy = true;
        try {
          await this.call("yuvomi/mutate", {operation: "comment", uid: String(task.id), comment: draft.value.trim()});
          this.commentDrafts ||= {};delete this.commentDrafts[task.id];
          await this.loadDetail(task);
        } catch (err) {this.error.textContent = err.message || String(err);}
        finally {this.busy = false;send.disabled = false;}
      }, "primary", false);
      this.detail.append(this.commentsContainer, draft, send);
    }
    editComment(task, comment, container) {
      this.commentEdits ||= {};
      this.commentEdits[comment.id] ??= comment.comment;
      const input = element("textarea", {value:this.commentEdits[comment.id], maxLength:10000});
      input.setAttribute("aria-label", "Edit comment");
      input.addEventListener("input", () => {this.commentEdits[comment.id] = input.value;});
      container.replaceChildren(input);
      container.append(this.button("save", () => this.changeComment(task, "edit_comment", comment.id, input.value)),
        this.button("cancel", () => {delete this.commentEdits[comment.id];this.loadDetail(task);}));
      input.focus();
    }
    async changeComment(task, operation, id, comment) {
      if (this.busy || (operation === "edit_comment" && !comment?.trim())) return;
      this.busy = true;
      try {
        await this.call("yuvomi/mutate", {operation, uid:String(task.id), comment_id:String(id),
          ...(operation === "edit_comment" ? {comment:comment.trim()} : {})});
        if (this.commentEdits) delete this.commentEdits[id];
        await this.loadDetail(task);
      } catch (err) {this.error.textContent = err.message || String(err);}
      finally {this.busy = false;}
    }
  }
  if (!customElements.get("yuvomi-task-board")) customElements.define("yuvomi-task-board", YuvomiTaskBoard);

  const findPanel = (root) => {
    for (const node of root.querySelectorAll("*")) {
      if (node.localName === "ha-panel-todo") return node;
      if (node.shadowRoot) {const found = findPanel(node.shadowRoot); if (found) return found;}
    }
    return null;
  };
  // The native panel has no public extension slot. This small hook is optional.
  setInterval(() => {
    if (!window.location.pathname.startsWith("/todo")) return;
    const panel = findPanel(document); if (!panel?.shadowRoot) return;
    const entityId = panel._entityId; const hass = panel.hass;
    let board = panel.shadowRoot.querySelector("yuvomi-task-board");
    const container = panel.shadowRoot.querySelector("#columns");
    if (!container) return;
    if (!hass?.states[entityId]?.attributes.yuvomi_enhance_ui) {
      board?.remove();container.style.removeProperty("display");return;
    }
    if (board && board.entityId !== entityId) {board.remove();board = null;}
    if (!board) {
      board = element("yuvomi-task-board", {hass, entityId});container.before(board);
    }
    board.hass = hass;
    container.style.display = "none";
  }, 1500);
}
