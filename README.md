# wlwBml

Wonderland.NET向けの非公式ブックマークレットです。

## ブックマークレット

ブックマークのURL欄に以下を登録してください。

```javascript
javascript:(function(d){var a=d.createElement('script');a.src='https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@main/wlw-bookmarklet.js';a.onload=function(){var b=d.createElement('script');b.src='https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@main/wlw-export.js';d.body.appendChild(b)};d.body.appendChild(a)})(document)
```

## 初回設定

1. Wonderland.NETへログインする。
2. マイキャスト一覧のファイタータブ1ページ目を開く。
3. ブックマークレットを実行し、獲得済みキャスト一覧をlocalStorageへ保存する。

## 戦績取得

1. 任意のキャスト詳細ページを開く。
2. ブックマークレットを実行する。
3. 非表示iframeで全キャストの戦績を取得し、勝率などを計算する。
4. 取得結果はWonderland.NETオリジンのlocalStorageへ保存する。

## 勝率画像の出力

全キャスト戦績の取得後、画面右下に「勝率画像」ボタンが表示されます。

1. 「勝率画像」を押す。
2. 出力するキャストを選択する。
3. 「画像を作成」を押す。
4. プレビューを確認し、「PNGを保存」を押す。
5. Web Share APIに対応したスマートフォンでは「共有」から画像を共有できます。

画像にはキャスト名、勝率、勝敗数、対戦数、戦績取得日時を出力します。

## ファイル構成

- `wlw-bookmarklet.js`: キャスト一覧・戦績取得、勝率計算、localStorage保存
- `wlw-export.js`: キャスト選択UI、勝率カード生成、PNG保存・共有
- `bookmarklet.txt`: ブックマークURL欄へ登録する短縮コード

## 注意

- SEGA公式ツールではありません。
- Wonderland.NET側のHTMLや挙動が変更された場合、動作しなくなる可能性があります。
- プライベートブラウズではlocalStorageが保持されない場合があります。
- jsDelivrのCDNキャッシュにより、`main`更新直後は古いJSが一時的に配信される場合があります。

## Credits

元実装: syara-temp / plz-monoeye-cast
