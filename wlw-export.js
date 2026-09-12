/*
 * WLWブックマークレット 画像エクスポート
 * localStorageに保存された全キャスト戦績から、指定キャストの勝率カードをPNG出力する。
 */
void (function () {
    const STORAGE_KEY = "wlw_bookmarklet_05";
    const UI_ID = "wlw_export_ui";
    const BUTTON_ID = "wlw_export_button";

    if (document.getElementById(BUTTON_ID) || document.getElementById(UI_ID)) return;

    waitUntilReady();

    function waitUntilReady() {
        const started = Date.now();

        function check() {
            if (!window.__wlwBulkRunning) {
                const state = loadState();
                if (state && getAvailableCasts(state).length) {
                    createLauncher(state);
                    return;
                }
            }

            if (Date.now() - started < 30000) {
                setTimeout(check, 300);
            }
        }

        check();
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const state = JSON.parse(raw);
            if (!state || typeof state !== "object") return null;
            return state;
        } catch (_) {
            return null;
        }
    }

    function validData(data) {
        return Array.isArray(data) &&
            data.length === 14 &&
            data.every(value => Number.isFinite(Number(value)));
    }

    function getAvailableCasts(state) {
        const ids = Array.isArray(state?.roster?.ids) ? state.roster.ids : [];
        const names = Array.isArray(state?.roster?.names) ? state.roster.names : [];
        const result = [];

        for (let i = 0; i < ids.length; i++) {
            const id = String(ids[i]);
            const data = state?.data?.[id];
            if (!validData(data)) continue;
            result.push({
                id,
                name: String(names[i] ?? id),
                data: data.map(Number)
            });
        }

        return result;
    }

    function createLauncher(initialState) {
        const button = document.createElement("button");
        button.id = BUTTON_ID;
        button.type = "button";
        button.textContent = "勝率画像";
        button.style.cssText = [
            "position:fixed",
            "right:12px",
            "bottom:12px",
            "z-index:2147483646",
            "padding:10px 14px",
            "border:1px solid #555",
            "border-radius:8px",
            "background:#fff",
            "color:#111",
            "font:600 14px sans-serif",
            "box-shadow:0 2px 8px rgba(0,0,0,.25)",
            "cursor:pointer"
        ].join(";");

        button.addEventListener("click", () => {
            const state = loadState() || initialState;
            openPanel(state);
        });

        document.body.appendChild(button);
    }

    function openPanel(state) {
        document.getElementById(UI_ID)?.remove();

        const casts = getAvailableCasts(state);
        if (!casts.length) {
            alert("画像出力できるキャスト戦績がありません。先に全キャスト取得を実行してください。");
            return;
        }

        const overlay = document.createElement("div");
        overlay.id = UI_ID;
        overlay.style.cssText = [
            "position:fixed",
            "inset:0",
            "z-index:2147483647",
            "background:rgba(0,0,0,.55)",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "padding:16px",
            "box-sizing:border-box"
        ].join(";");

        const panel = document.createElement("div");
        panel.style.cssText = [
            "width:min(420px,100%)",
            "max-height:90vh",
            "overflow:auto",
            "background:#fff",
            "color:#111",
            "border-radius:12px",
            "padding:16px",
            "box-sizing:border-box",
            "font:14px sans-serif",
            "box-shadow:0 8px 30px rgba(0,0,0,.35)"
        ].join(";");

        const title = document.createElement("div");
        title.textContent = "勝率画像エクスポート";
        title.style.cssText = "font-size:18px;font-weight:700;margin-bottom:12px";

        const label = document.createElement("label");
        label.textContent = "キャスト";
        label.style.cssText = "display:block;margin-bottom:6px;font-weight:600";

        const select = document.createElement("select");
        select.style.cssText = [
            "width:100%",
            "box-sizing:border-box",
            "padding:10px",
            "border:1px solid #aaa",
            "border-radius:6px",
            "background:#fff",
            "color:#111",
            "font:14px sans-serif"
        ].join(";");

        const currentId = new URL(location.href).searchParams.get("cast");
        for (const cast of casts) {
            const option = document.createElement("option");
            option.value = cast.id;
            option.textContent = cast.name;
            if (cast.id === currentId) option.selected = true;
            select.appendChild(option);
        }

        const preview = document.createElement("div");
        preview.style.cssText = "margin-top:14px;text-align:center";

        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:14px";

        const createButton = makeButton("画像を作成", true);
        const closeButton = makeButton("閉じる", false);
        const saveLink = document.createElement("a");
        saveLink.textContent = "PNGを保存";
        saveLink.style.cssText = buttonStyle(true) + ";display:none;text-decoration:none;text-align:center";
        saveLink.setAttribute("download", "wlw-winrate.png");

        const shareButton = makeButton("共有", false);
        shareButton.style.display = "none";

        let currentObjectUrl = null;
        let currentFile = null;

        createButton.addEventListener("click", async () => {
            const selected = casts.find(cast => cast.id === select.value);
            if (!selected) return;

            const blob = await createWinRateImage(selected);
            if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = URL.createObjectURL(blob);
            currentFile = new File([blob], fileName(selected) + ".png", { type: "image/png" });

            preview.replaceChildren();
            const img = document.createElement("img");
            img.src = currentObjectUrl;
            img.alt = selected.name + "の勝率画像";
            img.style.cssText = "display:block;width:100%;height:auto;border-radius:10px;border:1px solid #ddd";
            preview.appendChild(img);

            saveLink.href = currentObjectUrl;
            saveLink.download = fileName(selected) + ".png";
            saveLink.style.display = "inline-block";

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [currentFile] })) {
                shareButton.style.display = "inline-block";
            } else {
                shareButton.style.display = "none";
            }
        });

        shareButton.addEventListener("click", async () => {
            if (!currentFile) return;
            try {
                await navigator.share({
                    files: [currentFile],
                    title: "WLW勝率"
                });
            } catch (error) {
                if (error?.name !== "AbortError") alert("共有に失敗しました。");
            }
        });

        closeButton.addEventListener("click", close);
        overlay.addEventListener("click", event => {
            if (event.target === overlay) close();
        });

        function close() {
            if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
            overlay.remove();
        }

        buttons.append(createButton, saveLink, shareButton, closeButton);
        panel.append(title, label, select, preview, buttons);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    function makeButton(text, primary) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.style.cssText = buttonStyle(primary);
        return button;
    }

    function buttonStyle(primary) {
        return [
            "padding:10px 14px",
            "border:1px solid " + (primary ? "#111" : "#aaa"),
            "border-radius:6px",
            "background:" + (primary ? "#111" : "#fff"),
            "color:" + (primary ? "#fff" : "#111"),
            "font:600 14px sans-serif",
            "cursor:pointer",
            "box-sizing:border-box"
        ].join(";");
    }

    function fileName(cast) {
        return "wlw_" + cast.name.replace(/[\\/:*?\"<>|]/g, "_") + "_winrate";
    }

    function createWinRateImage(cast) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            canvas.width = 1200;
            canvas.height = 675;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Canvasを利用できません。"));
                return;
            }

            const data = cast.data;
            const wins = Number(data[2]) || 0;
            const losses = Number(data[3]) || 0;
            const total = wins + losses;
            const rate = total ? Math.round(wins / total * 1000) / 10 : 0;
            const updatedAt = Number(data[0]);

            ctx.fillStyle = "#111318";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = "#1d2129";
            roundRect(ctx, 54, 54, 1092, 567, 28);
            ctx.fill();

            ctx.fillStyle = "#ffffff";
            ctx.font = "700 54px sans-serif";
            ctx.textBaseline = "top";
            fitText(ctx, cast.name, 90, 92, 1020, 54, 34);

            ctx.fillStyle = "#b9c0ca";
            ctx.font = "500 26px sans-serif";
            ctx.fillText("WIN RATE", 92, 184);

            ctx.fillStyle = "#ffffff";
            ctx.font = "800 142px sans-serif";
            ctx.fillText(rate.toFixed(1) + "%", 86, 218);

            ctx.fillStyle = "#e9edf2";
            ctx.font = "700 44px sans-serif";
            ctx.fillText(wins + "勝  " + losses + "敗", 94, 422);

            ctx.fillStyle = "#aeb5c0";
            ctx.font = "500 28px sans-serif";
            ctx.fillText("対戦数 " + total, 94, 488);

            if (Number.isFinite(updatedAt) && updatedAt > 0) {
                const date = new Date(updatedAt);
                const dateText =
                    date.getFullYear() + "/" +
                    String(date.getMonth() + 1).padStart(2, "0") + "/" +
                    String(date.getDate()).padStart(2, "0") + " " +
                    String(date.getHours()).padStart(2, "0") + ":" +
                    String(date.getMinutes()).padStart(2, "0");
                ctx.fillStyle = "#777f8b";
                ctx.font = "400 22px sans-serif";
                ctx.textAlign = "right";
                ctx.fillText(dateText, 1106, 560);
                ctx.textAlign = "left";
            }

            ctx.fillStyle = "#777f8b";
            ctx.font = "500 22px sans-serif";
            ctx.fillText("Wonderland Wars / Wonder.NET", 94, 560);

            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error("PNG画像を生成できませんでした。"));
            }, "image/png");
        });
    }

    function fitText(ctx, text, x, y, maxWidth, startSize, minSize) {
        let size = startSize;
        while (size > minSize) {
            ctx.font = "700 " + size + "px sans-serif";
            if (ctx.measureText(text).width <= maxWidth) break;
            size -= 2;
        }
        ctx.fillText(text, x, y);
    }

    function roundRect(ctx, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }
})();
