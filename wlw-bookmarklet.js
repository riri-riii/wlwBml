/*
 * WLWブックマークレット loader
 * キャスト詳細では全キャスト取得 / 現在キャストのみを選択する。
 */
void (function () {
    if (window.__wlwLoaderRunning) return;
    window.__wlwLoaderRunning = true;

    const CORE_URL = "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@a9a8ee750f0f0c55a82866976a353ed77019cb4e/wlw-bookmarklet.js";
    const FALLBACK_BASE = "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@main/";
    const currentScriptUrl = document.currentScript?.src || "";
    const baseUrl = /\/wlw-bookmarklet\.js(?:[?#].*)?$/.test(currentScriptUrl)
        ? currentScriptUrl.replace(/wlw-bookmarklet\.js(?:[?#].*)?$/, "")
        : FALLBACK_BASE;
    const CURRENT_ONLY_URL = baseUrl + "wlw-current.js";

    const originalAlert = window.alert;
    const removedLines = new Set([
        "保存先をlocalStorageへ変更しました。",
        "戦績はlocalStorageに保存しました。"
    ]);
    let deferredListCompletion = null;

    if (location.hostname === "wonderland-wars.net" && location.pathname === "/castdetail.html") {
        showModeDialog();
    } else {
        runFull();
    }

    function runFull() {
        installMessageFilter();
        loadScript(CORE_URL, function () {
            waitForFinish(function () {
                restoreMessageFilter();
                if (location.hostname === "wonderland-wars.net" && location.pathname === "/mycast.html") {
                    showListCompletion();
                }
            });
        }, function () {
            restoreMessageFilter();
            originalAlert.call(window, "WLWブックマークレット本体の読み込みに失敗しました。");
        });
    }

    function runCurrentOnly() {
        loadScript(CURRENT_ONLY_URL, function () {
            waitForFinish(finishLoader);
        }, function () {
            finishLoader();
            originalAlert.call(window, "現在キャスト取得処理の読み込みに失敗しました。");
        });
    }

    function showModeDialog() {
        const existing = document.getElementById("wlw_fetch_mode_ui");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.id = "wlw_fetch_mode_ui";
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#0008;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box";

        const panel = document.createElement("div");
        panel.style.cssText = "width:100%;max-width:360px;background:#fff;color:#111;border-radius:10px;padding:16px;box-sizing:border-box;font:14px/1.5 sans-serif;box-shadow:0 8px 30px #0005";

        const title = document.createElement("div");
        title.textContent = "取得範囲を選択";
        title.style.cssText = "font-size:17px;font-weight:700;margin-bottom:6px";

        const help = document.createElement("div");
        help.textContent = "戦績を取得する範囲を選んでください。";
        help.style.cssText = "margin-bottom:12px";

        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:8px";

        const allButton = makeButton("全キャスト取得", true);
        const currentButton = makeButton("このキャストのみ", false);
        allButton.style.flex = "1";
        currentButton.style.flex = "1";

        allButton.addEventListener("click", function () {
            overlay.remove();
            runFull();
        });
        currentButton.addEventListener("click", function () {
            overlay.remove();
            runCurrentOnly();
        });

        buttons.append(allButton, currentButton);
        panel.append(title, help, buttons);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    function makeButton(text, primary) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.style.cssText = "padding:9px 10px;min-height:38px;border:1px solid #999;border-radius:6px;font:600 13px sans-serif;cursor:pointer;box-sizing:border-box;" +
            (primary ? "background:#202632;color:#fff" : "background:#fff;color:#111");
        return button;
    }

    let progressObserver = null;
    let messageFilterInstalled = false;

    function installMessageFilter() {
        if (messageFilterInstalled) return;
        messageFilterInstalled = true;
        window.alert = function (message) {
            const filtered = String(message)
                .split("\n")
                .filter(line => !removedLines.has(line))
                .join("\n");
            if (!filtered) return;

            if (location.pathname === "/mycast.html" && filtered.includes("獲得済みキャスト情報取得が完了しました。")) {
                deferredListCompletion = filtered;
                return;
            }
            originalAlert.call(window, filtered);
        };

        progressObserver = new MutationObserver(cleanProgress);
        progressObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function cleanProgress() {
        const node = document.getElementById("wlw_bulk_status");
        if (!node) return;
        const cleaned = node.textContent.replace(/（ID：\d+）/g, "");
        if (cleaned !== node.textContent) node.textContent = cleaned;
    }

    function restoreMessageFilter() {
        progressObserver?.disconnect();
        progressObserver = null;
        if (messageFilterInstalled) window.alert = originalAlert;
        messageFilterInstalled = false;
        finishLoader();
    }

    function showListCompletion() {
        const old = document.getElementById("wlw_list_complete_ui");
        if (old) old.remove();

        let message = deferredListCompletion;
        deferredListCompletion = null;

        if (!message) {
            try {
                const raw = localStorage.getItem("wlw_bookmarklet_05");
                const state = raw ? JSON.parse(raw) : null;
                const count = Array.isArray(state?.roster?.ids) ? state.roster.ids.length : null;
                message = "獲得済みキャスト情報取得が完了しました。" +
                    (count != null ? "\n獲得済みキャスト数：" + count : "");
            } catch (_) {
                message = "獲得済みキャスト情報取得が完了しました。";
            }
        }

        const overlay = document.createElement("div");
        overlay.id = "wlw_list_complete_ui";
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#0008;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box";

        const panel = document.createElement("div");
        panel.style.cssText = "width:100%;max-width:360px;background:#fff;color:#111;border-radius:10px;padding:16px;box-sizing:border-box;font:14px/1.6 sans-serif;box-shadow:0 8px 30px #0005;white-space:pre-line";

        const text = document.createElement("div");
        text.textContent = message;
        text.style.cssText = "margin-bottom:12px";

        const ok = makeButton("OK", true);
        ok.style.width = "100%";
        ok.addEventListener("click", function () { overlay.remove(); });

        panel.append(text, ok);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    function waitForFinish(done) {
        cleanProgress();
        if (window.__wlwBulkRunning) {
            setTimeout(function () { waitForFinish(done); }, 100);
        } else {
            done();
        }
    }

    function finishLoader() {
        delete window.__wlwLoaderRunning;
    }

    function loadScript(src, onload, onerror) {
        const script = document.createElement("script");
        script.src = src;
        script.onload = onload;
        script.onerror = onerror;
        document.body.appendChild(script);
    }
})();