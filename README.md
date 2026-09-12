# wlwBml

Wonderland.NET向けの非公式ブックマークレットです。

## ブックマークレット

ブックマークのURL欄に以下を登録してください。

```javascript
javascript:(function(d,s){s=d.createElement('script');s.src='https://cdn.jsdelivr.net/gh/riri-riii/wlwBml@main/wlw-bookmarklet.js';d.body.appendChild(s);})(document)
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

## 注意

- SEGA公式ツールではありません。
- Wonderland.NET側のHTMLや挙動が変更された場合、動作しなくなる可能性があります。
- プライベートブラウズではlocalStorageが保持されない場合があります。
- jsDelivrのCDNキャッシュにより、`main`更新直後は古いJSが一時的に配信される場合があります。

## Credits

元実装: syara-temp / plz-monoeye-cast
