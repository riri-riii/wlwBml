/*
 * WLWキャスト表示選択_01
 * 画像出力を廃止し、キャスト別勝率の表示行だけを切り替える。
 * 既存ブックマークとの互換性のためファイル名はwlw-export.jsを維持。
 */
void (function () {
    if (location.hostname !== "wonderland-wars.net" || location.pathname !== "/castdetail.html") return;
    if (window.__wlwCastSelectionLoaded) return;
    window.__wlwCastSelectionLoaded = true;

    const BUTTON_ID = "wlw_cast_select_button";
    const UI_ID = "wlw_cast_select_ui";
    let selectedIds = null;

    // 一括取得が長くかかっても、表示完了を待ってボタンを追加する。
    const observer = new MutationObserver(() => {
        if (mount()) observer.disconnect();
    });
    if (!mount()) observer.observe(document.body, { childList: true, subtree: true });

    function getCasts() {
        return Array.from(document.querySelectorAll("#wlw_custom [data-wlw-cast-id]"), row => {
            const rawRank = row.dataset.wlwRank;
            const rank = rawRank == null || rawRank === "" ? null : Number(rawRank);
            return {
                row,
                id: row.dataset.wlwCastId,
                name: row.dataset.wlwCastName || row.dataset.wlwCastId,
                wins: Number(row.dataset.wlwWins),
                rank: Number.isInteger(rank) && rank >= 0 ? rank : null
            };
        });
    }

    function mount() {
        if (document.getElementById(BUTTON_ID)) return true;
        const casts = getCasts();
        if (!casts.length) return false;
        selectedIds = new Set(casts.map(cast => cast.id));
        document.getElementById("wlw_export_button")?.remove();
        document.getElementById("wlw_export_ui")?.remove();

        const button = makeButton("キャスト選択", true);
        button.id = BUTTON_ID;
        button.setAttribute("aria-haspopup", "dialog");
        button.style.cssText += ";position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147483646;box-shadow:0 2px 8px #0003";
        button.addEventListener("click", () => openPanel(button));
        document.body.appendChild(button);
        return true;
    }

    function element(tag, text, css) {
        const node = document.createElement(tag);
        if (text != null) node.textContent = text;
        if (css) node.style.cssText = css;
        return node;
    }

    function makeButton(text, primary) {
        const button = element("button", text,
            "padding:8px 10px;min-height:36px;border:1px solid #999;border-radius:6px;" +
            "font:600 13px sans-serif;cursor:pointer;box-sizing:border-box;" +
            (primary ? "background:#202632;color:#fff" : "background:#fff;color:#111"));
        button.type = "button";
        return button;
    }

    function openPanel(launcher) {
        if (document.getElementById(UI_ID)) return;
        const casts = getCasts();
        const overlay = element("div", null,
            "position:fixed;inset:0;z-index:2147483647;background:#0008;display:flex;" +
            "align-items:center;justify-content:center;padding:12px;box-sizing:border-box");
        overlay.id = UI_ID;
        const panel = element("div", null,
            "width:100%;max-width:460px;max-height:90vh;overflow:auto;padding:14px;" +
            "box-sizing:border-box;background:#fff;color:#111;border-radius:10px;font:14px/1.5 sans-serif");
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-labelledby", "wlw_cast_select_title");
        panel.tabIndex = -1;
        const title = element("div", "キャスト選択", "font-size:18px;font-weight:700;margin-bottom:6px");
        title.id = "wlw_cast_select_title";
        const help = element("div", "表示したいキャストにチェックを入れ、OKで反映します。", "margin-bottom:10px");
        const toolbar = element("div", null, "display:flex;gap:8px;margin-bottom:10px");
        const toggleAll = makeButton("全解除", false);
        toolbar.append(toggleAll);
        const status = element("div", "", "margin:6px 0;font-size:13px");
        status.setAttribute("role", "status");
        const message = element("div", "", "color:#b42318;font-size:13px;white-space:pre-line");
        message.setAttribute("role", "status");
        const list = element("div", null,
            "max-height:38vh;overflow:auto;overscroll-behavior:contain;border:1px solid #ddd;border-radius:6px");
        const boxes = new Map();
        for (const cast of casts) {
            const label = element("label", null,
                "display:flex;align-items:center;gap:10px;padding:9px 10px;min-height:44px;" +
                "box-sizing:border-box;border-bottom:1px solid #eee;cursor:pointer;color:#111;background:#fff");
            const input = element("input");
            input.type = "checkbox";
            input.value = cast.id;
            input.checked = selectedIds.has(cast.id);
            input.style.cssText = "appearance:auto;-webkit-appearance:checkbox;position:static;opacity:1;width:20px;height:20px;margin:0;flex-shrink:0";
            input.setAttribute("aria-label", cast.name);
            const text = element("span", null, "min-width:0;overflow-wrap:anywhere");
            const name = element("span", cast.name, "display:block;font-weight:600");
            const detail = element("span", cast.wins + "勝 ／ CR" + (cast.rank ?? "[不明]"), "display:block;font-size:12px;color:#555");
            text.append(name, detail);
            label.append(input, text);
            list.appendChild(label);
            boxes.set(cast.id, input);
            input.addEventListener("change", updateCount);
        }

        function updateCount() {
            const count = Array.from(boxes.values()).filter(box => box.checked).length;
            status.textContent = count + " / " + casts.length + "キャストを選択";
            toggleAll.textContent = count === casts.length ? "全解除" : "全選択";
        }

        function selectWhere(predicate) {
            for (const cast of casts) boxes.get(cast.id).checked = predicate(cast);
            message.textContent = "";
            updateCount();
        }
        toggleAll.addEventListener("click", () => {
            const allSelected = Array.from(boxes.values()).every(box => box.checked);
            selectWhere(() => !allSelected);
        });

        const rankFilter = element("div", null, "display:flex;gap:8px;align-items:center;margin:8px 0");
        const rankSelect = element("select");
        rankSelect.setAttribute("aria-label", "キャストランクの下限");
        rankSelect.style.cssText = "width:82px;min-width:0;padding:7px 6px;box-sizing:border-box;border:1px solid #aaa;border-radius:6px;font:14px sans-serif;background:#fff;color:#111";
        for (const value of [1, 10, 20, 30]) {
            const option = element("option", String(value));
            option.value = String(value);
            rankSelect.appendChild(option);
        }
        rankSelect.value = "1";
        const rankButton = makeButton("CR1以上のみ", false);
        rankButton.style.flex = "1";
        rankSelect.addEventListener("change", () => {
            rankButton.textContent = "CR" + rankSelect.value + "以上のみ";
        });
        rankButton.addEventListener("click", () => {
            const value = Number(rankSelect.value);
            selectWhere(cast => cast.rank !== null && cast.rank >= value);
        });
        rankFilter.append(rankSelect, rankButton);

        const note = element("div", "", "font-size:12px;color:#555;margin-top:8px");
        if (casts.some(cast => cast.rank === null)) {
            note.textContent = "CRが[不明]のキャストはランク条件から除外されます。";
        }
        const footer = element("div", null, "display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:-14px;padding:12px 0 0;background:#fff");
        const cancel = makeButton("キャンセル", false);
        const ok = makeButton("OK", true);
        footer.append(cancel, ok);
        ok.addEventListener("click", () => {
            selectedIds = new Set(casts.filter(cast => boxes.get(cast.id).checked).map(cast => cast.id));
            for (const cast of casts) {
                // 全キャスト勝率や現在の詳細戦績は変更せず、キャスト別の行だけ切り替える。
                if (selectedIds.has(cast.id)) cast.row.style.removeProperty("display");
                else cast.row.style.setProperty("display", "none", "important");
            }
            close();
        });
        cancel.addEventListener("click", close);
        overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
        panel.addEventListener("keydown", event => {
            if (event.key === "Escape") { event.preventDefault(); close(); }
            if (event.key === "Tab") {
                const focusable = Array.from(panel.querySelectorAll("button,input"));
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
                    event.preventDefault(); last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first.focus();
                }
            }
        });
        const oldOverflow = document.body.style.overflow;
        function close() {
            document.body.style.overflow = oldOverflow;
            overlay.remove();
            launcher.focus();
        }
        panel.append(title, help, toolbar, rankFilter, message, status, list, note, footer);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        document.body.style.overflow = "hidden";
        updateCount();
        panel.focus();
    }
})();