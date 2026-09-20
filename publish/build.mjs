import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const sha = process.env.RELEASE_SHA;
if (!/^[a-f0-9]{40}$/.test(sha || "")) throw new Error("RELEASE_SHA must be a full lowercase commit SHA.");
// Check that the selected version has all files before deploying its pointer.
for (const file of ["wlw-bookmarklet.js", "wlw-current.js", "wlw-export.js"]) {
    execFileSync("git", ["cat-file", "-e", sha + ":" + file]);
}
const bookmarklet = "javascript:" + readFileSync("publish/bookmarklet.js", "utf8")
    .split("\n").filter(line => !line.trim().startsWith("//")).map(line => line.trim()).join("") + "\n";
if (bookmarklet !== readFileSync("bookmarklet-v2.txt", "utf8")) throw new Error("Regenerate bookmarklet-v2.txt from publish/bookmarklet.js.");
mkdirSync("_site", { recursive: true });
writeFileSync("_site/release.js", readFileSync("publish/release-template.js", "utf8").replace("__RELEASE_SHA__", sha));
writeFileSync("_site/version.json", JSON.stringify({ sha }, null, 2) + "\n");
writeFileSync("_site/.nojekyll", "");
writeFileSync("_site/bookmarklet-v2.txt", bookmarklet);
writeFileSync("_site/bookmarklet-legacy.txt", readFileSync("bookmarklet.txt"));
const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
writeFileSync("_site/index.html", `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WLWブックマークレット</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--accent:#5c6bc0;--accent-dark:#3f51b5;--bg:#f0f2f5;--text:#333;--muted:#666;--border:#e0e0e0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:"Noto Sans JP",sans-serif;font-size:15px;line-height:1.6}
main{max-width:900px;margin:0 auto;padding:20px 18px 48px}
h1{margin:0 0 20px;padding-bottom:8px;border-bottom:3px solid var(--accent);color:var(--accent-dark);font-size:28px;line-height:1.5;font-weight:700;overflow-wrap:anywhere}
.card{background:#fff;border-radius:10px;box-shadow:0 2px 8px #00000014;padding:14px;margin-bottom:14px}
h2{font-size:18px;line-height:1.5;font-weight:700;color:var(--accent-dark);margin:0 0 16px;padding-left:10px;border-left:4px solid var(--accent)}
textarea{display:block;width:100%;height:96px;resize:vertical;border:1.5px solid var(--border);border-radius:8px;padding:10px 12px;background:#fff;color:var(--text);font:14px/1.6 monospace;overflow-wrap:anywhere}
button{width:100%;min-height:44px;margin-top:14px;padding:10px 16px;border:0;border-radius:8px;background:var(--accent);color:#fff;font:700 16px/1.5 "Noto Sans JP",sans-serif;cursor:pointer}
button:hover{background:var(--accent-dark)}
button:disabled{opacity:.7;cursor:wait}
button:focus-visible,textarea:focus-visible,a:focus-visible{outline:3px solid var(--accent-dark);outline-offset:3px}
.copy-status{margin:6px 0 0;font-size:13px;color:var(--muted)}
.copy-status:empty{display:none}
.desktop-register{display:none;margin:10px 0 0;font-size:13px;color:var(--muted)}
a{color:var(--accent-dark)}
ol{list-style:none;counter-reset:step;padding:0;margin:0}
li{counter-increment:step;display:flex;align-items:center;gap:12px;background:#f5f6f8;border-radius:8px;padding:9px 10px;margin-bottom:10px;min-height:50px}
li::before{content:counter(step);display:grid;place-items:center;flex:0 0 36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-size:18px;font-weight:700}
li:last-child{margin-bottom:0}
.note{margin:18px 0 0;color:var(--muted);font-size:13px;line-height:1.7}
@media(max-width:500px){h1{font-size:22px}h2{font-size:18px}}
@media(min-width:700px){.card{padding:20px}.desktop-register{display:block}}
</style>
</head>
<body>
<main>
<h1>WLWブックマークレット</h1>
<section class="card" aria-labelledby="register-title">
<h2 id="register-title">ブックマーク登録</h2>
<textarea id="bookmarklet-code" readonly spellcheck="false" aria-label="登録コード">${escape(bookmarklet.trim())}</textarea>
<button id="copy-code" type="button">登録コードをコピー</button>
<p id="copy-status" class="copy-status" role="status" aria-live="polite"></p>
<p class="desktop-register">PCでは<a href="${escape(bookmarklet.trim())}" draggable="true">WLW勝率BML</a>をブックマークバーへドラッグして登録できます。</p>
</section>
<section class="card" aria-labelledby="usage-title">
<h2 id="usage-title">使い方</h2>
<ol>
<li>コードをコピー</li>
<li>ブックマークのURL欄に貼り付け</li>
<li>Wonderland.NETのキャスト一覧画面で実行</li>
<li>Wonderland.NETの任意のキャスト詳細画面でもう一度実行</li>
<li>ページ下部にキャストの勝率情報が表示されます。<br>右下のボタンからキャストの絞り込みが可能です。</li>
</ol>
<p class="note">マイキャスト一覧・詳細ページで利用できます。</p>
</section>
</main>
<script>
const code = document.getElementById("bookmarklet-code");
const button = document.getElementById("copy-code");
const status = document.getElementById("copy-status");
button.addEventListener("click", async () => {
    button.disabled = true;
    try {
        await navigator.clipboard.writeText(code.value);
        status.textContent = "コピーしました。ブックマークのURL欄に貼り付けてください。";
    } catch {
        code.focus();
        code.select();
        code.setSelectionRange(0, code.value.length);
        status.textContent = "コードを選択しました。メニューからコピーしてください。";
    } finally {
        button.disabled = false;
    }
});
</script>
</body>
</html>\n`);
