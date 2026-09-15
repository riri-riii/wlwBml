# 公開・復旧手順

## 初回切替

1. リポジトリのSettings → Pages → Build and deployment → Sourceを「GitHub Actions」にする。
2. Actionsの「Publish bookmarklet」をmainで実行する。release_shaは空欄。
3. deployの成功後、https://riri-riii.github.io/wlwBml/ の公開コミットを確認する。
4. bookmarklet-v2.txtをブックマークのURL欄に一度だけ登録する。

公開が成功するまでは従来のbookmarklet.txtを使用できる。既存の3つのJSとbookmarklet.txtは切替作業では変更していない。

## 通常更新

mainへコードを反映すると公開テスト・Pagesへの配置が自動実行される。
deployが成功した後の次回起動から新しい公開コミットを参照する。既に起動中の処理は切り替えない。
利用者によるキャッシュ削除やブックマークの再登録は不要。

ブックマークは毎回異なるクエリ付きでPagesのrelease.jsを読み込む。
release.js内の完全なコミットSHAでjsDelivrのwlw-bookmarklet.jsとwlw-export.jsを読み込む。
wlw-current.jsも既存ローダーの相対パス解決により同じSHAになる。
全キャスト取得の旧コアは従来から固定されているa9a8ee750f0f0c55a82866976a353ed77019cb4eを引き続き使用する。
コード側の@mainをキャッシュ削除で更新する方式には依存しない。
通信失敗時はエラーを表示し、古い公開情報への自動フォールバックはしない。

## 新経路の公開バージョンを戻す

Actions → Publish bookmarklet → Run workflowでブランチはmainのまま、
release_shaに戻したい完全な40桁のコミットSHAを入力する。
切替前のコードに戻す場合:
`0ee9b249d8ecf1dd1ea070a4590166f7c8397824`

deployの成功後、新ブックマークの次回起動から指定版になる。
これは公開先の差し替えだけで、mainのコードや保存済み戦績は変更しない。
次にmainへpushするとそのコミットが再び公開されるため、復旧中は通常更新を止めるか先に不具合を修正する。

## 従来経路を使う

従来のbookmarklet.txtとjsDelivrの@main公開経路は維持している。
Pages障害時はbookmarklet.txtを登録して実行できる。ただし旧方式のCDNキャッシュ特性は残る。

切替前の全ファイルはブランチ
`backup/pre-pages-20260915-01`
（コミット`0ee9b249d8ecf1dd1ea070a4590166f7c8397824`）にも保存している。
mainを強制的に巻き戻す必要はない。将来既存JSを変更した後に旧経路の実体も戻す場合は、
次で対象ファイルだけを復元し、通常のコミット・pushを行う:

```sh
git restore --source backup/pre-pages-20260915-01 -- bookmarklet.txt wlw-bookmarklet.js wlw-current.js wlw-export.js
git add bookmarklet.txt wlw-bookmarklet.js wlw-current.js wlw-export.js
git commit -m "Restore pre-Pages bookmarklet code"
git push origin main
```

## 検証

`node --test publish/publication.test.mjs`

公開先の変更は読み込み処理だけ。戦績取得・保存・表示の既存実装は変更しない。
