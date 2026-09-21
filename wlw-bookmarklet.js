/*
 * WLWブックマークレット loader
 * 一覧は取得・検証後に保存データを更新する。
 * キャスト詳細では全キャスト取得 / 現在キャストのみを選択する。
 */
void (async function () {
    if (window.__wlwLoaderRunning || window.__wlwBulkRunning) return;

    const FALLBACK_BASE = "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@main/";
    const STORAGE_KEY = "wlw_bookmarklet_05";
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
    const isMyCastPage = location.hostname === "wonderland-wars.net" && location.pathname === "/mycast.html";

    // 同期実行される一覧登録も、必ず初期化後に開始する。
    let progressObserver = null;
    let messageFilterInstalled = false;
    window.__wlwLoaderRunning = true;

    try {
        if (isMyCastPage) {
            registerRoster();
        } else if (location.hostname === "wonderland-wars.net" && location.pathname === "/castdetail.html") {
            const mode = await showModeDialog();
            if (mode === "all") await runFull();
            else await runCurrentOnly();
        } else {
            await runFull();
        }
    } catch (error) {
        console.error("WLWブックマークレット", error);
        originalAlert.call(window, error.message || String(error));
    } finally {
        restoreMessageFilter();
        delete window.__wlwLoaderRunning;
    }

    function registerRoster() {
        // 取得・検証に失敗した場合は、既存の保存データに触れない。
        const roster = collectRosterFromCurrentPage();
        let state;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            state = raw == null ? { version: 1 } : JSON.parse(raw);
            if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error();
        } catch (_) {
            throw new Error("保存済みデータを読み取れません。既存データは変更していません。");
        }

        const nextState = { ...state, roster, ranks: {}, data: {}, previous: {} };
        try {
            // 新しい一覧とリセット済み戦績を1回の書き込みで確定する。
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        } catch (_) {
            throw new Error("キャスト一覧の保存に失敗しました。既存データは変更していません。");
        }
        originalAlert.call(window,
            "獲得済みキャスト情報取得が完了しました。\n獲得済みキャスト数：" + roster.ids.length);
    }

    // 既存本体と同じタブ・ページ巡回で、一覧だけをメモリ上に取得する。
    function collectRosterFromCurrentPage() {
        const activeRole = document.querySelector(".tab_cast_on");
        if (activeRole && activeRole.id !== "fil_fig") {
            throw new Error("獲得済みキャスト情報取得はファイターのタブで実行してください。");
        }
        const activePage = document.querySelector(".page_block_page_on");
        if (activePage && activePage.textContent.trim() !== "1") {
            throw new Error("獲得済みキャスト情報取得は1ページ目で実行してください。");
        }

        const ids = [];
        const names = [];
        function addCurrentPage() {
            for (const link of document.links) {
                const match = link.href.match(/[?&]cast=(\d+)/);
                if (match) ids.push(match[1]);
            }
            for (const node of document.querySelectorAll(".block_cast_castname")) {
                names.push(node.textContent);
            }
        }

        let tabs = document.querySelectorAll(".tab_cast");
        const tabCount = tabs.length;
        for (let ti = -1; ti < tabCount; ti++) {
            if (ti !== -1) {
                tabs[ti].click();
                tabs = document.querySelectorAll(".tab_cast");
            }
            addCurrentPage();
            let pages = document.querySelectorAll(".page_block_page");
            const pageCount = pages.length;
            for (let i = 0; i < pageCount; i++) {
                pages[i].click();
                addCurrentPage();
                pages = document.querySelectorAll(".page_block_page");
            }
        }
        if (tabs[0]) tabs[0].click();

        if (!ids.length || ids.length !== names.length) {
            throw new Error("キャスト一覧を取得できませんでした。IDと名前の件数を確認してください。");
        }
        const map = new Map();
        ids.forEach((id, i) => {
            if (!names[i].trim()) throw new Error("キャスト名を取得できませんでした。");
            if (!map.has(id)) map.set(id, names[i]);
        });
        return { ids: [...map.keys()], names: [...map.values()] };
    }

    async function runFull() {
        installMessageFilter();
        await loadScript(baseUrl + "wlw-core.js", "WLWブックマークレット本体の読み込みに失敗しました。");
        await waitForFinish();
    }

    async function runCurrentOnly() {
        await loadScript(CURRENT_ONLY_URL, "現在キャスト取得処理の読み込みに失敗しました。");
        await waitForFinish();
    }

    function showModeDialog() {
        return new Promise(resolve => {
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
                resolve("all");
            });
            currentButton.addEventListener("click", function () {
                overlay.remove();
                resolve("current");
            });

            buttons.append(allButton, currentButton);
            panel.append(title, help, buttons);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);
        });
    }

    function makeButton(text, primary) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.style.cssText = "padding:9px 10px;min-height:38px;border:1px solid #999;border-radius:6px;font:600 13px sans-serif;cursor:pointer;box-sizing:border-box;" +
            (primary ? "background:#202632;color:#fff" : "background:#fff;color:#111");
        return button;
    }

    function installMessageFilter() {
        if (messageFilterInstalled) return;
        messageFilterInstalled = true;
        window.alert = function (message) {
            const filtered = String(message)
                .split("\n")
                .filter(line => !removedLines.has(line))
                .join("\n");
            if (filtered) originalAlert.call(window, filtered);
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
    }

    async function waitForFinish() {
        cleanProgress();
        while (window.__wlwBulkRunning) {
            await new Promise(resolve => setTimeout(resolve, 100));
            cleanProgress();
        }
    }

    function loadScript(src, errorMessage) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = function () {
                script.onload = script.onerror = null;
                resolve();
            };
            script.onerror = function () {
                script.onload = script.onerror = null;
                script.remove();
                reject(new Error(errorMessage));
            };
            document.body.appendChild(script);
        });
    }
})();
