import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const bookmarklet = readFileSync("bookmarklet-v2.txt", "utf8").trim().replace(/^javascript:/, "");
const template = readFileSync("publish/release-template.js", "utf8");
const oldSha = "0ee9b249d8ecf1dd1ea070a4590166f7c8397824";
const newSha = "1234567890abcdef1234567890abcdef12345678";
function browser() {
    const scripts = [], alerts = [], timers = new Map();
    let timerId = 0;
    const parent = { appendChild(s) { scripts.push(s); } };
    const d = { head: parent, documentElement: parent, currentScript: null,
        createElement() { return { remove() { this.removed = true; } }; } };
    const w = { alert: m => alerts.push(m),
        setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
        clearTimeout(id) { timers.delete(id); } };
    const context = vm.createContext({ document: d, window: w, console: {error() {}}, Date, Math });
    const start = () => vm.runInContext(bookmarklet, context);
    const publish = (sha, script = scripts[0]) => {
        d.currentScript = script;
        vm.runInContext(template.replace("__RELEASE_SHA__", sha), context);
        d.currentScript = null;
    };
    return { scripts, alerts, timers, d, w, start, publish };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test("one fixed bookmarklet gets fresh metadata and pins both entry files to each selected SHA", async () => {
    const b = browser();
    b.start();
    const first = b.scripts[0];
    assert.match(first.src, /^https:\/\/riri-riii.github.io\/wlwBml\/release.js\?t=/);
    b.start();
    assert.equal(b.scripts.length, 1, "duplicate invocation blocked while fetching version");
    b.publish(oldSha);
    assert.equal(b.scripts[1].src, "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@" + oldSha + "/wlw-bookmarklet.js");
    b.scripts[1].onload();
    await tick();
    assert.equal(b.scripts[2].src, "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@" + oldSha + "/wlw-export.js");
    b.scripts[2].onload();
    await tick();
    assert.equal(b.w.__wlwReleaseRequest, undefined);
    assert.equal(b.timers.size, 0);
    b.start();
    assert.notEqual(b.scripts[3].src, first.src);
    b.publish(newSha, b.scripts[3]);
    assert.ok(b.scripts[4].src.includes("@" + newSha + "/"));
    b.scripts[4].onload();
    await tick();
    assert.ok(b.scripts[5].src.includes("@" + newSha + "/"));
    b.scripts[5].onload();
    await tick();
    // Rollback uses the same installed bookmarklet.
    b.start();
    b.publish(oldSha, b.scripts[6]);
    assert.ok(b.scripts[7].src.includes("@" + oldSha + "/"));
});
test("metadata failure allows retry and rejects late script from previous request", () => {
    const b = browser();
    b.start();
    const stale = b.scripts[0];
    b.timers.values().next().value();
    assert.equal(b.alerts.length, 1);
    assert.equal(b.w.__wlwReleaseRequest, undefined);
    b.start();
    b.publish(oldSha, stale);
    assert.equal(b.scripts.length, 2);
    b.publish(newSha, b.scripts[1]);
    assert.equal(b.scripts.length, 3);
    assert.ok(b.scripts[2].src.includes("@" + newSha + "/"));
});
test("metadata network errors clear request state", () => {
    const b = browser();
    b.start();
    b.scripts[0].onerror();
    assert.equal(b.alerts.length, 1);
    assert.equal(b.timers.size, 0);
    assert.equal(b.w.__wlwReleaseRequest, undefined);
});
for (const failure of ["network", "timeout"]) {
    test("entry script " + failure + " failure stops instead of mixing in another version", async () => {
        const b = browser();
        b.start(); b.publish(newSha);
        if (failure === "network") b.scripts[1].onerror();
        else b.timers.values().next().value();
        await tick();
        assert.equal(b.scripts.length, 2, "export must not load after entry failure");
        assert.equal(b.alerts.length, 1);
        assert.equal(b.w.__wlwReleaseRequest, undefined);
        assert.equal(b.timers.size, 0);
    });
}
test("do not interrupt an existing acquisition", () => {
    const b = browser();
    b.w.__wlwLoaderRunning = true; b.start();
    assert.equal(b.scripts.length, 0);
    delete b.w.__wlwLoaderRunning;
    b.start();
    b.w.__wlwBulkRunning = true;
    b.publish(newSha);
    assert.equal(b.scripts.length, 1);
    assert.equal(b.w.__wlwReleaseRequest, undefined);
});
test("existing loader derives current-only script from its pinned entry URL", () => {
    const source = readFileSync("wlw-bookmarklet.js", "utf8");
    const begin = source.indexOf('    const FALLBACK_BASE');
    const end = source.indexOf('    const originalAlert');
    const result = vm.runInNewContext(source.slice(begin, end) + "\nCURRENT_ONLY_URL", {
        document: { currentScript: { src: "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@" + newSha + "/wlw-bookmarklet.js" } }
    });
    assert.equal(result, "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@" + newSha + "/wlw-current.js");
});
