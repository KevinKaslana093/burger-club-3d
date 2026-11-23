"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {webcrypto} = require("node:crypto");

const key = "burger-club.shift.v1";
const sourceFile = path.join(__dirname, "burger", "dist", "logic.js");
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function memoryStorage() {
  const values = new Map();
  return {
    writes: 0,
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(name) { return values.get(String(name)) ?? null; },
    setItem(name, value) {
      if (name === key) this.writes++;
      values.set(String(name), String(value));
    },
    removeItem(name) { values.delete(String(name)); },
    clear() { values.clear(); }
  };
}

function makeBrowser(source, denyStorage = false, capabilities = {}) {
  const events = new EventTarget();
  const browser = {
    console, crypto: webcrypto, Event, EventTarget, URL, setTimeout, clearTimeout,
    setInterval, clearInterval, queueMicrotask, structuredClone, performance,
    navigator: {}, location: new URL("file:///isolated-test/diner.html"),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events)
  };
  Object.assign(browser, capabilities);
  browser.window = browser;
  browser.self = browser;
  if (denyStorage) {
    const denied = () => { throw new DOMException("Storage disabled", "SecurityError"); };
    for (const name of ["localStorage", "sessionStorage", "indexedDB"])
      Object.defineProperty(browser, name, {get: denied});
  }
  vm.runInNewContext(source, browser, {filename: "logic.js"});
  assert.equal(typeof browser.DinerGame?.create, "function");
  return browser.DinerGame;
}

async function until(check, message) {
  const end = Date.now() + 4000;
  while (!check() && Date.now() < end) await delay(10);
  assert.ok(check(), message);
}

function finishFromSecondSide(game) {
  game.tick(7);
  assert.equal(game.act("grill"), true);
  for (const id of game.state.recipe.slice(1)) assert.equal(game.act("add", id), true);
  assert.equal(game.act("serve"), true);
  assert.equal(game.act("deliver", game.state.table), true);
  game.tick(4);
  return game.state.score;
}

function reachFirstSide(game) {
  game.tick(5);
  assert.equal(game.act("take"), true);
  game.tick(3);
  assert.equal(game.act("grill"), true);
  game.tick(7);
  assert.equal(game.state.heatA, 77);
}

async function ownerAndObservers(api) {
  const storage = memoryStorage();
  const tabs = [api.create({storage, coordinated: true})];
  const first = tabs[0];
  try {
    await until(() => first.session.mode === "owner", "first tab must own the shift");
    tabs.push(api.create({storage, coordinated: true}), api.create({storage, coordinated: true}));
    const [, second, third] = tabs;
    await until(() => tabs.slice(1).every(tab => tab.session.mode === "observer"), "both later tabs must observe");
    const secondState = second.state;
    let updates = 0;
    const off = second.session.subscribe(() => updates++);
    const baseline = JSON.stringify(second.state);
    const writes = storage.writes;
    second.tick(100);
    for (const action of ["restart", "next", "take", "grill"]) assert.equal(second.act(action), false);
    assert.equal(storage.writes, writes, "observer must never save a local action");
    assert.equal(JSON.stringify(second.state), baseline, "observer must not advance its local order");

    reachFirstSide(first);
    await until(() => second.state.grillStage === "sideA" && second.state.heatA === 77, "observer must follow the active grill");
    assert.equal(second.state, secondState, "renderers retain a reference to the original state");
    assert.ok(updates > 0, "live saves must notify the spectator");
    off();
    assert.equal(await second.session.takeControl(), true);
    await until(() => first.session.mode === "observer" && second.session.mode === "owner", "takeover must demote the prior owner");
    const snapshot = storage.getItem(key);
    assert.equal(first.act("restart"), false);
    first.tick(1000);
    assert.equal(storage.getItem(key), snapshot);
    assert.equal(second.state.heatA, 77);
    assert.equal(second.act("grill"), true);
    const score = finishFromSecondSide(second);
    assert.equal(score.total, 100);
    await until(() => first.state.score?.tip === 10 && third.state.phase === "result", "all tabs must share the settled score");

    await second.session.close();
    await until(() => [first, third].filter(tab => tab.session.mode === "owner").length === 1, "owner closure must elect one successor");
    const successor = [first, third].find(tab => tab.session.mode === "owner");
    assert.equal(successor.state.allTips, 10);
    assert.equal(successor.act("next"), true);
    assert.equal(successor.state.orderNo, 2);
    await until(() => first.state.orderNo === 2 && third.state.orderNo === 2, "next guest must be visible in both surviving tabs");
    const reopened = api.create({storage, coordinated: true});
    tabs.push(reopened);
    await until(() => reopened.session.mode === "observer" && reopened.state.orderNo === 2, "reopening must retain the shift");
    assert.equal(reopened.state.allTips, 10, "the same payout may only be counted once");

    const live = [first, third, reopened];
    await Promise.all([first.session.takeControl(), reopened.session.takeControl()]);
    await until(() => live.filter(tab => tab.session.mode === "owner").length === 1, "two claims must converge to one owner");
    const writesBefore = storage.writes;
    for (const tab of live.filter(tab => tab.session.mode === "observer")) {
      assert.equal(tab.act("restart"), false);
      tab.tick(42);
    }
    assert.equal(storage.writes, writesBefore);
    for (const tab of live) assert.equal(tab.state.allTips, 10);
  } finally {
    for (const tab of tabs.reverse()) await tab.session.close();
  }
}

async function olderAndCorruptSaves(api) {
  const seed = memoryStorage();
  const original = api.create({storage: seed});
  reachFirstSide(original);
  const savedState = JSON.parse(seed.getItem(key)).state;
  await original.session.close();
  const legacy = memoryStorage();
  legacy.setItem(key, JSON.stringify({v: 1, state: savedState}));
  const resumed = api.create({storage: legacy, coordinated: true});
  try {
    await until(() => resumed.session.mode === "owner", "legacy owner acquisition");
    assert.equal(resumed.state.phase, "playing");
    assert.equal(resumed.state.grillStage, "sideA");
    assert.equal(resumed.state.heatA, 77);
    assert.equal(resumed.act("grill"), true);
    assert.equal(finishFromSecondSide(resumed).total, 100);
  } finally { await resumed.session.close(); }

  for (const value of ["{invalid", JSON.stringify({v: 1, state: {...savedState, orderNo: -3}})]) {
    const storage = memoryStorage();
    storage.setItem(key, value);
    const recovered = api.create({storage, coordinated: true});
    try {
      await until(() => recovered.session.mode === "owner", "corrupt saves must not block startup");
      assert.equal(recovered.state.phase, "waiting");
      assert.equal(recovered.state.orderNo, 1);
      assert.equal(recovered.state.allTips, 0);
      reachFirstSide(recovered);
      assert.equal(JSON.parse(storage.getItem(key)).state.heatA, 77, "recovered shift must save normally");
    } finally { await recovered.session.close(); }
  }
}

async function staleInjectedWriter(api) {
  const storage = memoryStorage();
  const a = api.create({storage}), b = api.create({storage});
  try {
    reachFirstSide(a);
    const committed = storage.getItem(key);
    assert.equal(b.act("restart"), false, "a stale writer cannot restart a more recent shift");
    assert.equal(storage.getItem(key), committed);
    assert.equal(b.state.heatA, 77, "refused stale actions must restore the latest save");
  } finally {
    await a.session.close();
    await b.session.close();
  }
}

async function pendingBrowserWrites(source) {
  const storage = memoryStorage(), jobs = [];
  const locks = {
    request(_name, callback) {
      return new Promise((resolve, reject) => jobs.push(() => {
        try { resolve(callback()); } catch (error) { reject(error); }
      }));
    }
  };
  async function drain() {
    do {
      while (jobs.length) jobs.shift()();
      await delay(0);
    } while (jobs.length);
  }
  const tab = () => makeBrowser(source, false, {
    localStorage: storage, sessionStorage: memoryStorage(), navigator: {locks}
  }).create();
  const a = tab(), b = tab();
  try {
    assert.equal(a.session.mode, "opening");
    a.tick(120);
    assert.equal(a.act("restart"), false);
    assert.equal(a.state.elapsed, 0);
    assert.equal(storage.writes, 0);
    await drain();
    assert.equal(a.session.mode, "owner");
    assert.equal(b.session.mode, "observer");
    a.tick(5);
    await drain();
    assert.equal(a.act("take"), true);
    const transfer = b.session.takeControl();
    a.tick(3); // The old window may enqueue one last frame before it sees the handoff.
    assert.equal(a.state.phase, "playing");
    await drain();
    assert.equal(await transfer, true);
    assert.equal(b.state.visit, "dining", "takeover must include the old owner's last accepted action");
    assert.equal(b.state.station, "grill");
    assert.equal(JSON.parse(storage.getItem(key)).state.visit, "dining");
    assert.equal(b.act("grill"), true);
    await drain();
    assert.equal(a.act("restart"), false);
    assert.equal(a.session.mode, "observer");
    assert.equal(b.session.mode, "owner");
    assert.equal(JSON.parse(storage.getItem(key)).state.grillStage, "sideA", "the old window must not undo the new owner's action");
  } finally {
    const closed = [a.session.close(), b.session.close()];
    await drain();
    await Promise.all(closed);
  }
}

async function deniedStorage(source) {
  const api = makeBrowser(source, true), a = api.create(), b = api.create();
  try {
    await until(() => a.session.mode === "memory" && b.session.mode === "memory", "disabled storage must allow independent memory-only play");
    reachFirstSide(a);
    assert.equal(a.act("grill"), true);
    assert.equal(finishFromSecondSide(a).tip, 10);
    assert.equal(b.state.phase, "waiting");
    assert.equal(b.state.allTips, 0);
  } finally {
    await a.session.close();
    await b.session.close();
  }

  const readOnly = {
    getItem() { return null; },
    setItem() { throw new DOMException("No disk space", "QuotaExceededError"); }
  };
  const quota = api.create({storage: readOnly, coordinated: true});
  try {
    await until(() => quota.session.mode === "memory", "readable but unwritable storage must permit temporary play");
    reachFirstSide(quota);
  } finally { await quota.session.close(); }
}

function inlineLogic(file) {
  const html = fs.readFileSync(file, "utf8");
  const marker = html.indexOf("root.DinerGame = api");
  assert.ok(marker > 0, "single HTML must contain an inline game module");
  const open = html.lastIndexOf("<script", marker);
  const start = html.indexOf(">", open) + 1, end = html.indexOf("</script>", marker);
  assert.ok(open >= 0 && end > start);
  return html.slice(start, end);
}

async function run(source, label) {
  const api = makeBrowser(source);
  await ownerAndObservers(api);
  await olderAndCorruptSaves(api);
  await staleInjectedWriter(api);
  await pendingBrowserWrites(source);
  await deniedStorage(source);
  console.log(label + " passed: shared shift, takeover, closure, reload, legacy/corrupt saves, stale writes and disabled storage.");
}

(async () => {
  await run(fs.readFileSync(sourceFile, "utf8"), "Source rules");
  for (const file of process.argv.slice(2)) await run(inlineLogic(file), path.basename(file));
})().catch(error => { console.error(error); process.exitCode = 1; });
