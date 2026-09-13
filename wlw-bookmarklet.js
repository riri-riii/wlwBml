/*
 * WLWブックマークレット_06
 * キャスト表示選択用にランクと各行のキャストIDを追加。
 * 保存先をCookieからlocalStorageへ変更。
 * 全キャスト取得は非表示iframe内で「マイキャスト → キャスト詳細」と通常遷移させる。
 * 原作：syara-temp / plz-monoeye-cast
 */
void (async function () {
    const CAST_LIST_URL = "https://wonderland-wars.net/mycast.html";
    const CAST_URL = "https://wonderland-wars.net/castdetail.html?cast=";
    const STORAGE_KEY = "wlw_bookmarklet_05";
    const ZERO_DATA = () => Array(14).fill(0);

    if (window.__wlwBulkRunning) {
        alert("全キャストの取得処理はすでに実行中です。");
        return;
    }
    window.__wlwBulkRunning = true;

    let progress = null;
    let readerFrame = null;

    try {
        ensureLocalStorage();
        let state = loadState();
        state = migrateLegacyCookies(state);
        saveState(state);

        const url = new URL(location.href);

        if (url.origin + url.pathname === CAST_LIST_URL) {
            const roster = collectRosterFromCurrentPage();
            state.roster = roster;
            saveState(state);
            alert(
                "獲得済みキャスト情報取得が完了しました。\n" +
                "保存先をlocalStorageへ変更しました。\n" +
                "獲得済みキャスト数：" + roster.ids.length
            );
            return;
        }

        if (!(url.origin === location.origin &&
              url.pathname === "/castdetail.html" &&
              url.searchParams.has("cast"))) {
            alert(
                "実行するページを間違えています。\n" +
                "マイキャスト一覧またはキャスト詳細ページで実行してください。"
            );
            return;
        }

        if (document.getElementById("wlw_custom")) {
            alert("戦績はすでに表示されています。最新データを取得する場合は、ページを再読み込みしてから実行してください。");
            return;
        }

        const roster = normalizeRoster(state.roster);
        if (!roster.ids.length) {
            alert("獲得済みキャスト情報がありません。\nマイキャスト一覧のファイター1ページ目で一度実行してください。");
            return;
        }

        const currentId = url.searchParams.get("cast");
        const currentIndex = roster.ids.indexOf(currentId);
        if (currentIndex < 0) {
            alert("現在のキャストが保存済み一覧にありません。\nマイキャスト一覧でキャスト情報を再取得してください。");
            return;
        }

        const currentData = readCastData(document);
        const currentRank = readCastRank(document);

        readerFrame = await openReaderFrame();
        const fetched = await collectOtherCasts(roster, currentId);

        // 全キャスト取得に成功してから保存する。
        state.ranks ||= {};
        for (const entry of fetched) {
            updateCastState(state, entry.id, entry.data);
            state.ranks[entry.id] = entry.rank;
        }
        const baseline = updateCastState(state, currentId, currentData);
        state.ranks[currentId] = currentRank;

        state.roster = roster;
        saveState(state);
        renderResult(roster, state, currentId, currentData, baseline);

        alert(
            "全キャストの戦績取得が完了しました。\n" +
            "対象：" + roster.ids.length + "キャスト\n" +
            "戦績はlocalStorageに保存しました。"
        );
    } catch (error) {
        console.error("WLW一括取得", error);
        alert(error.message || String(error));
    } finally {
        if (readerFrame) readerFrame.remove();
        if (progress) progress.remove();
        delete window.__wlwBulkRunning;
    }

    function ensureLocalStorage() {
        try {
            const key = "__wlw_storage_test__";
            localStorage.setItem(key, "1");
            localStorage.removeItem(key);
        } catch (_) {
            throw new Error("localStorageを利用できません。ブラウザのサイトデータ保存設定を確認してください。");
        }
    }

    function emptyState() {
        return {
            version: 1,
            roster: { ids: [], names: [] },
            data: {},
            previous: {}
        };
    }

    function loadState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyState();
        try {
            const state = JSON.parse(raw);
            if (!state || typeof state !== "object") throw new Error();
            state.roster ||= { ids: [], names: [] };
            state.data ||= {};
            state.previous ||= {};
            return state;
        } catch (_) {
            throw new Error("保存済みlocalStorageデータを読み取れません。キー：" + STORAGE_KEY);
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (_) {
            throw new Error("localStorageへの保存に失敗しました。空き容量またはサイトデータ設定を確認してください。");
        }
    }

    function parseCookies() {
        const map = new Map();
        if (!document.cookie) return map;
        for (const item of document.cookie.split(";")) {
            const p = item.indexOf("=");
            if (p < 0) continue;
            map.set(item.slice(0, p).trim(), item.slice(p + 1));
        }
        return map;
    }

    function expireCookie(name) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        document.cookie = name + "=; max-age=0; path=/";
    }

    // 01～04/旧UM版のデータが残っていればlocalStorageへ移し、
    // ブックマークレットが作ったCookieだけを削除する。
    function migrateLegacyCookies(state) {
        const cookies = parseCookies();
        const rawIds = cookies.get("acqci");
        const rawNames = cookies.get("acqcn");
        if (rawIds == null && rawNames == null) return state;

        let ids = [];
        let names = [];
        try {
            if (rawIds != null) ids = unescape(rawIds).split(":").filter(Boolean);
            if (rawNames != null) names = unescape(rawNames).split(":");
        } catch (_) {}

        if (ids.length && ids.length === names.length && !state.roster.ids.length) {
            state.roster = normalizeRoster({ ids, names });
        }

        for (const id of ids) {
            if (!/^\d+$/.test(id)) continue;

            const current = cookies.get(id);
            if (current != null && state.data[id] == null) {
                const data = parseLegacyData(current);
                if (data) state.data[id] = data;
            }

            const previous = cookies.get("p" + id);
            if (previous != null && state.previous[id] == null) {
                const data = parseLegacyData(previous);
                if (data) state.previous[id] = data;
            }
        }

        saveState(state);

        expireCookie("acqci");
        expireCookie("acqcn");
        for (const id of ids) {
            if (!/^\d+$/.test(id)) continue;
            expireCookie(id);
            expireCookie("p" + id);
        }
        return state;
    }

    function parseLegacyData(value) {
        try {
            const values = unescape(value).split(":").map(Number);
            return values.length === 14 && values.every(Number.isFinite) ? values : null;
        } catch (_) {
            return null;
        }
    }

    function normalizeRoster(roster) {
        const ids = Array.isArray(roster?.ids) ? roster.ids : [];
        const names = Array.isArray(roster?.names) ? roster.names : [];
        if (ids.length !== names.length) {
            throw new Error("保存済みのキャストIDと名前の件数が一致しません。マイキャスト一覧で再取得してください。");
        }

        const map = new Map();
        ids.forEach((rawId, i) => {
            const id = String(rawId).trim();
            if (!/^\d+$/.test(id)) {
                throw new Error("保存済みのキャストIDが不正です。マイキャスト一覧で再取得してください。");
            }
            if (!map.has(id)) map.set(id, String(names[i]));
        });
        return { ids: [...map.keys()], names: [...map.values()] };
    }

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

        const roster = normalizeRoster({ ids, names });
        if (!roster.ids.length) {
            throw new Error("キャスト一覧を取得できませんでした。");
        }
        return roster;
    }

    function readCastData(source) {
        const p1 = source.querySelectorAll(".block_playdata_01_text");
        const p2 = source.querySelectorAll(".block_playdata_02_text");

        if (p1.length !== 4 || p2.length !== 6) {
            throw new Error(
                "戦績のHTMLが想定と異なります。基本項目：" + p1.length +
                "/4、平均項目：" + p2.length + "/6。"
            );
        }

        function readNumber(element, label, integer) {
            const text = element.textContent.normalize("NFKC").trim().replace(/,/g, "");
            const value = integer ? parseInt(text, 10) : parseFloat(text);
            if (!Number.isFinite(value)) {
                throw new Error(label + "を数値として読み取れません。取得値：「" + (text || "空欄").slice(0, 60) + "」");
            }
            return value;
        }

        const ur = readNumber(p1[0], "使用率", false);
        const wc = readNumber(p1[1], "勝利数", true);
        const crc = readNumber(p1[2], "総撃破数", true);
        const wdc = readNumber(p1[3], "総撤退数", true);
        const tp = readNumber(p2[0], "キャスト別評価・全体平均", false);
        const wp = readNumber(p2[1], "キャスト別評価・勝利時平均", false);
        const lp = readNumber(p2[2], "キャスト別評価・敗北時平均", false);
        const tn = readNumber(p2[3], "獲得ナイス・全体平均", false);
        const wn = readNumber(p2[4], "獲得ナイス・勝利時平均", false);
        const ln = readNumber(p2[5], "獲得ナイス・敗北時平均", false);

        let lc = 0;
        if (tp - lp !== 0) lc = Math.round((wp - tp) * wc / (tp - lp));

        let wr = 0;
        if (wc + lc !== 0) wr = Math.round(wc / (wc + lc) * 1000) / 10;

        let kr = 0;
        if (wdc !== 0) kr = Math.round(crc / wdc * 100) / 100;

        const data = [Date.now(), ur, wc, lc, wr, crc, wdc, kr, tp, wp, lp, tn, wn, ln];
        if (!data.every(Number.isFinite)) {
            throw new Error("戦績の計算結果が数値になりません。不正な値は保存していません。");
        }
        return data;
    }

    // 背景クラスがbg_castrank4のときだけ30を加え、比較用のCR換算値を読む。画像生成スクリプトを実行せず、取得できなければnull。
    function readCastRank(source) {
        const node = source.querySelector(".data_castrank");
        if (!node) return null;
        const offset = node.classList.contains("bg_castrank4") ? 30 : 0;
        for (const script of node.querySelectorAll("script")) {
            const match = script.textContent.match(
                /\bpoint_num\s*\(\s*(['"])(\d+)\1\s*,\s*['"][^'"]*num_castrank['"]/
            );
            if (match) return Number(match[2]) + offset;
        }
        const digits = Array.from(node.querySelectorAll("img[src]"), image => {
            const match = image.getAttribute("src").match(/(?:^|\/)num_castrank(\d)\.png(?:[?#]|$)/);
            return match ? match[1] : "";
        }).join("");
        if (digits) return Number(digits) + offset;
        const copy = node.cloneNode(true);
        copy.querySelectorAll("script,style").forEach(element => element.remove());
        const match = copy.textContent.normalize("NFKC").trim().match(/^(?:CR\s*)?(\d+)$/i);
        return match ? Number(match[1]) + offset : null;
    }

    function showProgress(text) {
        if (!progress) {
            progress = document.createElement("div");
            progress.id = "wlw_bulk_status";
            progress.style.cssText =
                "position:fixed;top:12px;right:12px;z-index:2147483647;" +
                "padding:12px;background:white;color:black;border:1px solid #888;" +
                "font:14px sans-serif;white-space:pre-line;max-width:85vw;";
            document.body.appendChild(progress);
        }
        progress.textContent = text;
    }

    async function openReaderFrame() {
        const frame = document.createElement("iframe");
        frame.id = "wlw_bulk_reader";
        frame.setAttribute("aria-hidden", "true");
        frame.tabIndex = -1;
        frame.style.cssText =
            "position:fixed;left:-10000px;top:0;width:320px;height:640px;" +
            "border:0;opacity:0;pointer-events:none;";
        frame.src = CAST_LIST_URL;
        document.body.appendChild(frame);

        await waitForFrame(
            frame,
            (url) => url.origin === location.origin && url.pathname === "/mycast.html",
            15000
        );
        return frame;
    }

    function waitForFrame(frame, check, timeoutMs) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            let lastError = null;

            function poll() {
                if (!frame.isConnected) {
                    reject(new Error("一括取得用の非表示画面が閉じられました。"));
                    return;
                }
                try {
                    const win = frame.contentWindow;
                    const doc = frame.contentDocument;
                    if (win && doc && doc.readyState !== "loading" && win.location.href !== "about:blank") {
                        const url = new URL(win.location.href);
                        if (check(url, doc)) {
                            resolve(doc);
                            return;
                        }
                    }
                } catch (error) {
                    lastError = error;
                }

                if (Date.now() - started >= timeoutMs) {
                    reject(new Error(
                        "非表示画面のページ取得がタイムアウトしました。" +
                        (lastError ? " " + lastError.message : "")
                    ));
                    return;
                }
                setTimeout(poll, 100);
            }
            poll();
        });
    }

    async function openMyCastInFrame() {
        if (!readerFrame || !readerFrame.isConnected) {
            throw new Error("一括取得用の非表示画面が利用できません。");
        }

        let onMyCast = false;
        try {
            const current = new URL(readerFrame.contentWindow.location.href);
            onMyCast = current.origin === location.origin && current.pathname === "/mycast.html";
        } catch (_) {}

        if (!onMyCast) readerFrame.contentWindow.location.replace(CAST_LIST_URL);

        return await waitForFrame(
            readerFrame,
            (url) => url.origin === location.origin && url.pathname === "/mycast.html",
            15000
        );
    }

    async function fetchCastInFrame(id) {
        const listDoc = await openMyCastInFrame();
        const target = new URL(CAST_URL + id);

        // 直接fetchせず、mycast.htmlをRefererに持つ通常のDocument navigationにする。
        const link = listDoc.createElement("a");
        link.href = target.href;
        link.target = "_self";
        link.style.display = "none";
        listDoc.body.appendChild(link);
        link.click();

        const castDoc = await waitForFrame(
            readerFrame,
            (url) =>
                url.origin === target.origin &&
                url.pathname === target.pathname &&
                url.searchParams.get("cast") === id,
            15000
        );

        const started = Date.now();
        let lastError = null;
        while (Date.now() - started < 3000) {
            try {
                return { data: readCastData(castDoc), rank: readCastRank(castDoc) };
            } catch (error) {
                lastError = error;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        throw new Error(
            "非表示画面では戦績を取得できませんでした。" +
            (lastError ? "\n" + lastError.message : "")
        );
    }

    async function collectOtherCasts(roster, currentId) {
        const fetched = [];
        let completed = 1;
        showProgress("全キャスト取得：" + completed + "/" + roster.ids.length);

        for (let i = 0; i < roster.ids.length; i++) {
            const id = roster.ids[i];
            if (id === currentId) continue;

            if (fetched.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            showProgress(
                "全キャスト取得：" + completed + "/" + roster.ids.length +
                "\n取得中：" + roster.names[i] + "（ID：" + id + "）"
            );

            try {
                const result = await fetchCastInFrame(id);
                fetched.push({ id, data: result.data, rank: result.rank });
            } catch (error) {
                throw new Error(
                    "一括取得を中止しました。\n" +
                    "対象：" + roster.names[i] + "（ID：" + id + "）\n" +
                    error.message +
                    "\n今回取得した戦績はまだ保存していません。"
                );
            }
            completed++;
        }

        showProgress(
            "全キャスト取得：" + completed + "/" + roster.ids.length +
            "\n結果を反映しています。"
        );
        return fetched;
    }

    function validData(value) {
        return Array.isArray(value) &&
            value.length === 14 &&
            value.every(v => Number.isFinite(Number(v)));
    }

    // 元UM版と同じ「当日差分」の基準をlocalStorageで再現する。
    function updateCastState(state, id, data) {
        const stored = validData(state.data[id])
            ? state.data[id].map(Number)
            : ZERO_DATA();

        const previousDay = validData(state.previous[id])
            ? state.previous[id].map(Number)
            : ZERO_DATA();

        const now = Date.now();
        const base = new Date(Number(stored[0]));
        base.setHours(23, 59, 59, 999);

        let diffBase;
        if (now > base.getTime()) {
            state.previous[id] = stored;
            diffBase = stored;
        } else {
            diffBase = previousDay;
        }

        if ([1, 2, 8, 9, 10].some(index => Number(data[index]) !== Number(stored[index]))) {
            state.data[id] = data;
        } else if (!validData(state.data[id])) {
            state.data[id] = data;
        }

        return diffBase;
    }

    function renderResult(roster, state, currentId, currentData, baseline) {
        const wins = {};
        const losses = {};
        const rates = {};
        let allWins = 0;
        let allLosses = 0;

        for (const id of roster.ids) {
            let data;
            if (id === currentId) {
                data = currentData;
            } else {
                data = validData(state.data[id]) ? state.data[id].map(Number) : ZERO_DATA();
            }

            const wc = Number(data[2]) || 0;
            const lc = Number(data[3]) || 0;
            const wr = wc + lc ? Math.round(wc / (wc + lc) * 1000) / 10 : 0;

            wins[id] = wc;
            losses[id] = lc;
            rates[id] = wr;
            allWins += wc;
            allLosses += lc;
        }

        const allRate = allWins + allLosses
            ? Math.round(allWins / (allWins + allLosses) * 1000) / 10
            : 0;

        const frame = document.querySelector(".frame_inner");
        if (!frame) throw new Error("戦績表示領域を取得できません。");

        const copy = frame.cloneNode(true);
        copy.id = "wlw_custom";
        const blocks = copy.querySelectorAll(".clearfix");

        function insert(index, title, value) {
            const row = blocks[0].cloneNode(true);
            const divs = row.getElementsByTagName("div");
            divs[0].innerHTML = title;
            divs[1].innerHTML = value;
            copy.insertBefore(row, blocks[index]);
            return row;
        }

        insert(2, "敗北数", currentData[3] + '<span class="font_small">敗</span>');
        insert(2, "勝率", currentData[4] + "%");
        insert(4, "Kill Ratio", currentData[7]);

        function diff(index, node) {
            const oldValue = Number(baseline[index]) || 0;
            let delta = Math.round((currentData[index] - oldValue) * 100) / 100;
            let sign = "±";
            if (delta > 0) sign = "+";
            if (delta < 0) {
                sign = "-";
                delta = Math.abs(delta);
            }
            node.innerHTML +=
                ' <span style="color:#ff0000;" class="font_small">(' +
                sign + delta + ")</span>";
        }

        const p1 = copy.querySelectorAll(".block_playdata_01_text");
        for (let i = 0; i < 7; i++) diff(i + 1, p1[i]);

        const p2 = copy.querySelectorAll(".block_playdata_02_text");
        for (let i = 0; i < 6; i++) diff(i + 8, p2[i]);

        insert(
            6,
            "全キャスト勝率",
            allRate + '% <span class="font_small">(' + allWins + "勝" + allLosses + "敗)</span>"
        );

        for (let i = 0; i < roster.ids.length; i++) {
            const id = roster.ids[i];
            const row = insert(
                6,
                '<span class="font_90">' + roster.names[i] + "</span>",
                rates[id] + '% <span class="font_small">(' +
                wins[id] + "勝" + losses[id] + "敗)</span>"
            );
            row.dataset.wlwCastId = id;
            row.dataset.wlwCastName = roster.names[i];
            row.dataset.wlwWins = String(wins[id]);
            row.dataset.wlwRank = state.ranks?.[id] == null ? "" : String(state.ranks[id]);
        }

        frame.parentNode.replaceChild(copy, frame);
    }
})();