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
  ru: { title: "Название", description: "Описание", priority: "Приоритет", category: "Категория", status: "Статус",
    open: "Открыта", in_progress: "В работе", done: "Завершена", none: "Нет", low: "Низкий", medium: "Средний", high: "Высокий", urgent: "Срочный",
    assigned: "Исполнители", start: "Дата начала", due: "Срок", time: "Время", tags: "Теги через запятую",
    repeat: "Повторение", DAILY: "Ежедневно", WEEKLY: "Еженедельно", MONTHLY: "Ежемесячно", YEARLY: "Ежегодно", custom: "Другое",
    rule: "Правило повторения", fromCompletion: "Повторять от завершения", points: "Баллы", visibility: "Видимость",
    all: "Домочадцам", private: "Только мне", assignees: "Исполнителям", locked: "Защитить параметры задачи", save: "Сохранить", cancel: "Отмена",
    delete: "Удалить", archive: "В архив", restore: "Из архива", subtasks: "Подзадачи", add: "Добавить", loading: "Загрузка…",
    new: "Новая задача", filters: "Yuvomi · фильтры и архив", search: "Поиск", any: "Все", archived: "Показать архив",
    advanced: "Дополнительные настройки", confirm: "Удалить задачу и её подзадачи?", missing: "Укажи название",
    refresh: "Обновить", stale: "Задача изменилась в Yuvomi. Перезагрузи её перед сохранением.",
    saved: "Сохранено", retry: "Повторить", close: "Закрыть", timezone: "Даты — в часовом поясе семьи Yuvomi, указанном при настройке HA",
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
      this.language = this.hass.language?.startsWith("ru") ? "ru" : "en";
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
      try { return await this.call("yuvomi/mutate", {operation, ...data}); }
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
        const row = element("div", {className: "row"});
        const checkbox = element("input", {type: "checkbox", checked: subtask.status === "done"});
        checkbox.setAttribute("aria-label", subtask.title);
        checkbox.addEventListener("change", async () => {
          await this.action("status", {uid: String(subtask.id), fields: {status: checkbox.checked ? "done" : "open"}});
          // Keep unsaved parent fields; only revert a failed subtask toggle.
          if (this.error.textContent) checkbox.checked = subtask.status === "done";
        });
        const edit = this.button(subtask.title, () => launch(this.hass, this.entityId, subtask.id), "", false);
        row.append(checkbox, edit); this.main.append(row);
      }
      const row = element("div", {className: "row"}); const input = element("input", {placeholder: this.t("new")});
      input.setAttribute("aria-label", this.t("new"));
      row.append(input, this.button("add", async () => {
        if (!input.value.trim()) return;
        const result = await this.action("create", {fields: {title: input.value.trim(), parent_task_id: Number(this.uid)}});
        if (result) {input.value = ""; row.before(element("p", {}, `${this.t("saved")} · ${result.data?.title || ""}`));}
      })); this.main.append(row);
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
    let button = panel.shadowRoot.querySelector("[data-yuvomi-toolbar]");
    if (!hass?.states[entityId]?.attributes.yuvomi_enhance_ui) {button?.remove(); return;}
    if (!button) {
      const container = panel.shadowRoot.querySelector("#columns"); if (!container) return;
      button = element("button"); button.dataset.yuvomiToolbar = "true";
      button.style.cssText = "padding:12px;margin:8px;cursor:pointer;color:var(--primary-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px";
      button.addEventListener("click", () => launch(panel.hass, panel._entityId, null, true));
      container.before(button);
    }
    button.textContent = words[hass.language?.startsWith("ru") ? "ru" : "en"].filters;
  }, 1500);
}
