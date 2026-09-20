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
<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>WLWブックマークレット</title>
<style>body{font:16px/1.7 sans-serif;max-width:48rem;margin:3rem auto;padding:0 1rem}textarea{width:100%;height:12rem}a{overflow-wrap:anywhere}</style>
<h1>WLWブックマークレット</h1>
<p>下のリンクをブックマークバーへドラッグするか、コードをコピーしてブックマークのURL欄へ登録してください。</p>
<p><a href="${escape(bookmarklet.trim())}">WLW起動</a></p>
<textarea readonly aria-label="ブックマークレットのコード">${escape(bookmarklet.trim())}</textarea>
<p>登録後、Wonderland.NETにログインし、マイキャスト一覧またはキャスト詳細ページでブックマークを開いてください。</p>
</html>\n`);
