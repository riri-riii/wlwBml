/*
 * WLW 現在キャストのみ取得
 * 他キャストへの通信を行わず、表示中キャストの戦績とランクだけを更新する。
 */
void (function () {
    const STORAGE_KEY = "wlw_bookmarklet_05";
    const ZERO_DATA = () => Array(14).fill(0);

    if (window.__wlwBulkRunning) return;
    window.__wlwBulkRunning = true;

    try {
        if (location.hostname !== "wonderland-wars.net" || location.pathname !== "/castdetail.html") {
            throw new Error("キャスト詳細ページで実行してください。");
        }
        if (document.getElementById("wlw_custom")) {
            throw new Error("戦績はすでに表示されています。最新データを取得する場合は、ページを再読み込みしてから実行してください。");
        }

        const state = loadState();
        const roster = normalizeRoster(state.roster);
        if (!roster.ids.length) {
            throw new Error("獲得済みキャスト情報がありません。マイキャスト一覧のファイター1ページ目で一度実行してください。");
        }

        const currentId = new URL(location.href).searchParams.get("cast");
        if (!currentId || !roster.ids.includes(currentId)) {
            throw new Error("現在のキャストが保存済み一覧にありません。マイキャスト一覧でキャスト情報を再取得してください。");
        }

        const currentData = readCastData(document);
        const currentRank = readCastRank(document);

        state.ranks ||= {};
        const baseline = updateCastState(state, currentId, currentData);
        state.ranks[currentId] = currentRank;
        state.roster = roster;
        saveState(state);

        renderResult(roster, state, currentId, currentData, baseline);
        alert("このキャストの戦績取得が完了しました。");
    } catch (error) {
        console.error("WLW現在キャスト取得", error);
        alert(error.message || String(error));
    } finally {
        delete window.__wlwBulkRunning;
    }

    function loadState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { version: 1, roster: { ids: [], names: [] }, data: {}, previous: {}, ranks: {} };
        try {
            const state = JSON.parse(raw);
            state.roster ||= { ids: [], names: [] };
            state.data ||= {};
            state.previous ||= {};
            state.ranks ||= {};
            return state;
        } catch (_) {
            throw new Error("保存済みデータを読み取れません。");
        }
    }

    function saveState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function normalizeRoster(roster) {
        const ids = Array.isArray(roster?.ids) ? roster.ids : [];
        const names = Array.isArray(roster?.names) ? roster.names : [];
        if (ids.length !== names.length) throw new Error("保存済みのキャストIDと名前の件数が一致しません。");
        const map = new Map();
        ids.forEach((rawId, i) => {
            const id = String(rawId).trim();
            if (!/^\d+$/.test(id)) throw new Error("保存済みのキャストIDが不正です。");
            if (!map.has(id)) map.set(id, String(names[i]));
        });
        return { ids: [...map.keys()], names: [...map.values()] };
    }

    function readCastData(source) {
        const p1 = source.querySelectorAll(".block_playdata_01_text");
        const p2 = source.querySelectorAll(".block_playdata_02_text");
        if (p1.length !== 4 || p2.length !== 6) {
            throw new Error("戦績のHTMLが想定と異なります。");
        }

        function readNumber(element, label, integer) {
            const text = element.textContent.normalize("NFKC").trim().replace(/,/g, "");
            const value = integer ? parseInt(text, 10) : parseFloat(text);
            if (!Number.isFinite(value)) throw new Error(label + "を数値として読み取れません。");
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
        const wr = wc + lc !== 0 ? Math.round(wc / (wc + lc) * 1000) / 10 : 0;
        const kr = wdc !== 0 ? Math.round(crc / wdc * 100) / 100 : 0;
        return [Date.now(), ur, wc, lc, wr, crc, wdc, kr, tp, wp, lp, tn, wn, ln];
    }

    function readCastRank(source) {
        const node = source.querySelector(".data_castrank");
        if (!node) return null;
        const offset = node.classList.contains("bg_castrank4") ? 30 : 0;
        for (const script of node.querySelectorAll("script")) {
            const match = script.textContent.match(/\bpoint_num\s*\(\s*(['"])(\d+)\1\s*,\s*['"][^'"]*num_castrank['"]/);
            if (match) return Number(match[2]) + offset;
        }
        const digits = Array.from(node.querySelectorAll("img[src]"), image => {
            const match = image.getAttribute("src").match(/(?:^|\/)num_castrank(\d)\.png(?:[?#]|$)/);
            return match ? match[1] : "";
        }).join("");
        return digits ? Number(digits) + offset : null;
    }

    function validData(value) {
        return Array.isArray(value) && value.length === 14 && value.every(v => Number.isFinite(Number(v)));
    }

    function updateCastState(state, id, data) {
        const stored = validData(state.data[id]) ? state.data[id].map(Number) : ZERO_DATA();
        const previousDay = validData(state.previous[id]) ? state.previous[id].map(Number) : ZERO_DATA();
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

        if ([1, 2, 8, 9, 10].some(index => Number(data[index]) !== Number(stored[index])) || !validData(state.data[id])) {
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
            const data = id === currentId
                ? currentData
                : (validData(state.data[id]) ? state.data[id].map(Number) : ZERO_DATA());
            const wc = Number(data[2]) || 0;
            const lc = Number(data[3]) || 0;
            wins[id] = wc;
            losses[id] = lc;
            rates[id] = wc + lc ? Math.round(wc / (wc + lc) * 1000) / 10 : 0;
            allWins += wc;
            allLosses += lc;
        }

        const allRate = allWins + allLosses ? Math.round(allWins / (allWins + allLosses) * 1000) / 10 : 0;
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
            if (delta < 0) { sign = "-"; delta = Math.abs(delta); }
            node.innerHTML += ' <span style="color:#ff0000;" class="font_small">(' + sign + delta + ")</span>";
        }

        const p1 = copy.querySelectorAll(".block_playdata_01_text");
        for (let i = 0; i < 7; i++) diff(i + 1, p1[i]);
        const p2 = copy.querySelectorAll(".block_playdata_02_text");
        for (let i = 0; i < 6; i++) diff(i + 8, p2[i]);

        insert(6, "全キャスト勝率", allRate + '% <span class="font_small">(' + allWins + "勝" + allLosses + "敗)</span>");

        for (let i = 0; i < roster.ids.length; i++) {
            const id = roster.ids[i];
            const row = insert(
                6,
                '<span class="font_90">' + roster.names[i] + "</span>",
                rates[id] + '% <span class="font_small">(' + wins[id] + "勝" + losses[id] + "敗)</span>"
            );
            row.dataset.wlwCastId = id;
            row.dataset.wlwCastName = roster.names[i];
            row.dataset.wlwWins = String(wins[id]);
            row.dataset.wlwRank = state.ranks?.[id] == null ? "" : String(state.ranks[id]);
        }

        frame.parentNode.replaceChild(copy, frame);
    }
})();