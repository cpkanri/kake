# Phase 25-d-③-a 完了報告: 日常水質 備考(bikou)自動クリーン

**日時:** 2026-05-29
**ステータス:** ✅ 完了（指示書通り一気に実行）

---

## 実施内容

`kake_gscode.txt` 末尾（既存 `runRealCleanup_phase25d2` の後、1423行目以降）に
指示書のとおり以下2関数を追記しました。

| 関数 | 役割 |
|------|------|
| `cleanupBikou_phase25d3a(dryRun)` | `日常水質` シートの bikou 列をスキャンし、数値 / ISO文字列 / Date 型のセルのみ空にする（dryRun デフォルト true） |
| `runRealCleanupBikou_phase25d3a()` | 本実行（dryRun=false）ラッパー |

### 設計ポイント（指示書仕様どおり）
- **ヘッダ行(row1)から `bikou` 列を特定** → 行番号/列移動に非依存。
- クリア対象は **数値 / ISOタイムスタンプ文字列 / Date 型のみ**。テキストの正規備考は保持。
- 一括 `setValues` + `setNumberFormat('@')` で文字列フォーマット固定。
- **idempotent**（再実行しても既に空なので無害）。

---

## commit & deploy（Phase 21-B フロー）

| 手順 | 結果 |
|------|------|
| `git add kake_gscode.txt` + commit | ✅ `f26d071` |
| `cp → C:\dev\clasp-kake\コード.js` | ✅ |
| `clasp push -f` | ✅ Pushed 2 files at 13:39:45（appsscript.json / コード.js） |
| `git push origin main` | ✅ `20ad737..f26d071  main -> main` |

### コミット情報
- **HEAD コミットハッシュ:** `f26d071de4cbed455a3e8628d78dc1166b2ca3b7`
- **メッセージ:** `Phase 25-d-3-a: 日常水質 bikou列 汚染(数値/ISO/Date)自動クリーン関数を追加`
- **差分:** 1 file changed, 50 insertions(+)
- **リモート:** https://github.com/cpkanri/kake.git

---

## Yamane 側 実行手順（指示書対象外・参考）
1. editor を開いて一度リロード（clasp push 反映待ち）
2. `cleanupBikou_phase25d3a` を ▶ → ログで「クリア対象 N セル」と中身を確認（dryRun、まだ書き換えない）
3. 問題なければ `runRealCleanupBikou_phase25d3a` を ▶ → ログ確認 → SS 目視
4. **PWA は触る前に Clear site data / ハードリロード**（localStorage の汚染を取り直すため。先に保存しない）
