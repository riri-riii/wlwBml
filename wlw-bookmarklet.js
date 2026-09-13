/*
 * WLWブックマークレット loader
 * 本体の処理は既存版を読み込み、表示メッセージだけを調整する。
 */
void (function () {
    if (window.__wlwLoaderRunning) return;
    window.__wlwLoaderRunning = true;

    const CORE_URL = "https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@a9a8ee750f0f0c55a82866976a353ed77019cb4e/wlw-bookmarklet.js";
    const originalAlert = window.alert;
    const removedLines = new Set([
        "保存先をlocalStorageへ変更しました。",
        "戦績はlocalStorageに保存しました。"
    ]);

    window.alert = function (message) {
        const filtered = String(message)
            .split("\n")
            .filter(line => !removedLines.has(line))
            .join("\n");
        if (filtered) originalAlert.call(window, filtered);
    };

    function cleanProgress() {
        const node = document.getElementById("wlw_bulk_status");
        if (!node) return;
        const cleaned = node.textContent.replace(/（ID：\d+）/g, "");
        if (cleaned !== node.textContent) node.textContent = cleaned;
    }

    const observer = new MutationObserver(cleanProgress);
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
    });

    function restore() {
        observer.disconnect();
        window.alert = originalAlert;
        delete window.__wlwLoaderRunning;
    }

    function waitForFinish() {
        cleanProgress();
        if (window.__wlwBulkRunning) {
            setTimeout(waitForFinish, 100);
        } else {
            restore();
        }
    }

    const script = document.createElement("script");
    script.src = CORE_URL;
    script.onload = waitForFinish;
    script.onerror = function () {
        restore();
        originalAlert.call(window, "WLWブックマークレット本体の読み込みに失敗しました。");
    };
    document.body.appendChild(script);
})();