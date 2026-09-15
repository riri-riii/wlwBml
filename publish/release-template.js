// Published by GitHub Actions. Each deployment selects one immutable code version.
void (async function (d, w) {
    const request = w.__wlwReleaseRequest;
    if (!request || request.script !== d.currentScript) return;
    w.clearTimeout(request.timer);
    const sha = "__RELEASE_SHA__";
    const base = "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@" + sha + "/";
    try {
        if (w.__wlwLoaderRunning || w.__wlwBulkRunning) return;
        await load("wlw-bookmarklet.js");
        await load("wlw-export.js");
    } catch (error) {
        console.error("WLW publication:", error);
        w.alert(error.message);
    } finally {
        request.script.remove();
        if (w.__wlwReleaseRequest === request) delete w.__wlwReleaseRequest;
    }
    function load(file) {
        return new Promise((resolve, reject) => {
            const script = d.createElement("script");
            const timer = w.setTimeout(() => finish(new Error("読み込みがタイムアウトしました: " + file)), 30000);
            function finish(error) {
                w.clearTimeout(timer);
                script.onload = script.onerror = null;
                script.remove();
                if (error) reject(error); else resolve();
            }
            script.onload = () => finish();
            script.onerror = () => finish(new Error("読み込めませんでした: " + file + "。再実行してください。"));
            script.src = base + file;
            (d.head || d.documentElement).appendChild(script);
        });
    }
})(document, window);
