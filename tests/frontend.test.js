import {test} from "node:test";
import assert from "node:assert/strict";
import {changedFields} from "../custom_components/yuvomi/frontend/yuvomi.js";
import {JSDOM} from "jsdom";

test("partial update preserves the in-progress state and unedited fields", () => {
  assert.deepEqual(changedFields({title: "Before", status: "in_progress", priority: "high"},
    {title: "After", status: "in_progress", priority: "high"}), {title: "After"});
});
test("assigned user arrays, tags and integer booleans normalize", () => {
  assert.deepEqual(changedFields({assigned_users: [{id: 2}, {id: 1}], tags: ["b", "a"], locked: 1},
    {assigned_to: [1, 2], tags: ["a", "b"], locked: true}), {});
});
test("clearing an existing field is sent explicitly", () => {
  assert.deepEqual(changedFields({description: "Old", due_date: "2026-10-01"},
    {description: null, due_date: null}), {description: null, due_date: null});
});
test("new assignments and removal are preserved", () => {
  assert.deepEqual(changedFields({assigned_users: [{id: 1}]}, {assigned_to: []}), {assigned_to: []});
});

test("native Yuvomi editor opens extended fields and saves only changed values", async () => {
  const dom = new JSDOM("<!doctype html><home-assistant></home-assistant>", {url: "http://ha.local/todo"});
  for (const key of ["window", "document", "HTMLElement", "customElements"]) globalThis[key] = dom.window[key];
  dom.window.HTMLDialogElement.prototype.showModal = function () {this.open = true;};
  dom.window.HTMLDialogElement.prototype.close = function () {this.open = false;};
  const nativeTimer = globalThis.setInterval;
  const timers = [];
  globalThis.setInterval = (callback) => {timers.push(callback);return 0;};
  const requests = [];
  const task = {id: 1, title: "<img src=x onerror=alert(1)>", status: "in_progress", priority: "high",
    category: "misc", points: 0, assigned_users: [], visibility: "all", tags: [], locked: 0,
    is_recurring: 0, recurrence_rule: null, recurrence_from_completion: 0,
    due_date: "2026-10-05", due_time: "10:00", description: "Text"};
  const hass = {language: "ru", states: {"todo.yuvomi_tasks": {attributes: {yuvomi_enhance_ui: true}}},
    async callWS(request) {requests.push(request); return request.type === "yuvomi/mutate" ? {data: task} :
      {task: structuredClone(task), tasks: [structuredClone(task)], metadata: {categories: [{key: "misc", name: "Misc"}], users: []}};}};
  const host = document.querySelector("home-assistant"); host.hass = hass;
  try {
    await import("../custom_components/yuvomi/frontend/yuvomi.js?dom-test");
    const event = new dom.window.CustomEvent("show-dialog", {bubbles: true, composed: true, cancelable: true,
      detail: {dialogTag: "dialog-todo-item-editor", dialogParams: {entity: "todo.yuvomi_tasks", item: {uid: "1"}}}});
    host.dispatchEvent(event);
    await new Promise((resolve) => setImmediate(resolve));
    const editor = document.querySelector("yuvomi-task-dialog");
    assert.ok(editor);
    assert.equal(event.defaultPrevented, true);
    assert.equal(editor.controls.priority.value, "high");
    assert.equal(editor.shadowRoot.querySelectorAll("img").length, 0, "task titles remain plain text");
    editor.controls.title.value = "Renamed";
    await editor.save();
    assert.deepEqual(requests.at(-1), {type: "yuvomi/mutate", entity_id: "todo.yuvomi_tasks",
      operation: "update", uid: "1", fields: {title: "Renamed"}});
    assert.equal(document.querySelector("yuvomi-task-dialog"), null);
    const local = new dom.window.CustomEvent("show-dialog", {bubbles: true, composed: true, cancelable: true,
      detail: {dialogTag: "dialog-todo-item-editor", dialogParams: {entity: "todo.local", item: {uid: "1"}}}});
    host.dispatchEvent(local);
    assert.equal(local.defaultPrevented, false, "other To-do providers keep their native dialog");

    const board = document.createElement("yuvomi-task-board");
    Object.assign(board, {hass, entityId: "todo.yuvomi_tasks"});
    document.body.append(board);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(board.shadowRoot.querySelector(".group").textContent, "Misc · 1");
    assert.equal(board.shadowRoot.querySelectorAll("img").length, 0);
    assert.ok(board.shadowRoot.querySelector('select[aria-label="Assignee"]'));
    board.selectedId = 1;
    board.renderOverview();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(board.detail.textContent.includes("Description"));
    assert.ok(board.detail.textContent.includes("In progress"));
    board.kanban = true;
    board.status = "all";
    board.renderOverview();
    assert.equal(board.shadowRoot.querySelectorAll(".kanban .group").length, 3);
    board.search = "no matching title";
    board.renderOverview();
    assert.ok(board.shadowRoot.textContent.includes("No matching tasks"));
    board.search = "";
    await board.mutate(task, "status", {fields: {status: "done"}});
    assert.deepEqual(requests.findLast((r) => r.type === "yuvomi/mutate"), {
      type: "yuvomi/mutate", entity_id: "todo.yuvomi_tasks", operation: "status", uid: "1", fields: {status: "done"}
    });
    board.remove();
    const panel = document.createElement("ha-panel-todo");
    panel.attachShadow({mode: "open"});
    panel.shadowRoot.innerHTML = '<div id="columns"></div>';
    Object.assign(panel, {hass, _entityId: "todo.yuvomi_tasks"});
    host.append(panel);
    timers[0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(panel.shadowRoot.querySelector("yuvomi-task-board"), "board mounts in the native To-do panel");
    assert.equal(panel.shadowRoot.querySelector("#columns").style.display, "none");
    panel._entityId = "todo.local";
    timers[0]();
    assert.equal(panel.shadowRoot.querySelector("yuvomi-task-board"), null);
    assert.equal(panel.shadowRoot.querySelector("#columns").style.display, "", "native lists are restored");
  } finally {
    globalThis.setInterval = nativeTimer;
    dom.window.close();
    for (const key of ["window", "document", "HTMLElement", "customElements"]) delete globalThis[key];
  }
});
