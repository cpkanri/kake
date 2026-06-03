# Phase 25-d-② cleanup 関数追加 + clasp push 完了報告

実施日: 2026-05-29 / clasp 3.3.0 / login `cleanprokanri@gmail.com`
ベース commit: `046495e` (25-d-① ラッパー追加済)

## 結論

`日常水質` cleanup 関数 `cleanupWaterSheet_phase25d2` と本実行ラッパー `runRealCleanup_phase25d2` を追加し、
**clasp push (GAS deploy) + GitHub push まで完了**。Yamane は GAS editor でコード編集せず、関数を選んで ▶ で dry-run / 本実行できます。

## 追加関数の概要

| 関数 | 役割 |
|---|---|
| `cleanupWaterSheet_phase25d2(dryRun)` | 内容ベース判定で ①phantom空行(A/B/C全空) + ②test行(inspector=test / 月≥2026-06 / 全データ列=1) を削除、③月セル Date型 → 文字列 "yyyy-MM" に変換。dryRun 省略時 true。 |
| `runRealCleanup_phase25d2()` | 本実行ラッパー。`cleanupWaterSheet_phase25d2(false)` を呼ぶだけ。 |

設計方針: **行番号非依存・内容ベース判定**（25-d-① 移行 + 同期時 sortSheet で行が並び替わるため）。月セル型修正を削除より先に実施（行番号ずれ前に setValue）、削除は下から上へ。idempotent（再実行で phantom/test が無ければ何もしない、月型も変換不要）。

## 実施結果

| 項目 | 記録 |
|---|---|
| 追加位置 | `kake_gscode.txt` **L1307–1423**（25-d-① ラッパー L1305 `}` の後ろに純追記） |
| ・cleanup 関数 | L1311–1419 (`function cleanupWaterSheet_phase25d2` 〜 閉じ `}`) |
| ・本実行ラッパー | L1421–1423 (`function runRealCleanup_phase25d2`) |
| 全体行数 | 1188 → **1306** 行（git diff: 118 insertions） |
| 構文チェック | `node --check` **OK** |
| commit hash | **`20ad737`** (`Phase 25-d-②: 日常水質 cleanup 関数 (test/phantom削除+月型統一) 追加`) |
| clasp push | **成功** `Pushed 2 files at 12:07:26.` (`appsscript.json` + `コード.js`) |
| GitHub push | **成功** `046495e..20ad737  main -> main` (cpkanri/kake) |
| 既存関数 | 変更ゼロ（純追記のみ） |

## GAS の現状 (deploy 確認方法 / Yamane 向け)

Apps Script editor (加計GAS) をリロードし、関数ドロップダウンに以下があれば deploy 成功:
- `cleanupWaterSheet_phase25d2`（dry-run / 本実行 両対応）
- `runRealCleanup_phase25d2`（本実行ラッパー）
- （+ 25-d-① の `migrateWaterAddReactiveDemand_phase25d` / `runRealMigration_phase25d`）

---

# Yamane 実行手順 (clasp push 完了済み、以降は Yamane)

## Step 0: SS バックアップ (★必須)
加計 SS → ファイル → コピーを作成 → 例 `加計_週報_backup_25d2_20260529`

## Step 1: dry-run (editor、貼付なし)
1. Apps Script editor リロード → 関数選択 `cleanupWaterSheet_phase25d2` → ▶ 実行
2. ログ確認:
   ```
   delete (phantom + test): 154 前後   (phantom 151 + test 3)
   month-type fix: 6 rows
   keep: 43 前後
   === DRY RUN: no changes made ===
   ```
3. **delete が 150-160、month-type fix が 6、keep が 40-46 の範囲**なら想定通り
   - 大きく違ったら**停止して報告**

## Step 2: 本実行 (editor)
1. 関数選択 `runRealCleanup_phase25d2` → ▶ 実行
2. ログ確認:
   ```
   month-type fixed: 6
   After: lastRow=44 前後
   (status=done)
   ```

## Step 3: SS 目視確認
`日常水質` シートで:
- 実データ行のみ残る (43 行前後 + ヘッダー = lastRow 44 前後)
- A列(月) が全て文字列 "2026-04"/"2026-05" (左寄せ表示、Date型の右寄せでない)
- test 行 (inspector=test, 全1.0) が消えている
- phantom 空行が消えている
- **実データ (2026-04/05 の通常行) は残っている**

## Step 4: PWA 動作確認
1. 強制リロード (Ctrl+Shift+R) → 同期
2. 日常水質 2026-04 / 2026-05 の各週が正常表示
3. 完了率が変わっていない (実データ保持)

## 注記
- 本実行 (`runRealCleanup_phase25d2`) は SS 構造を変更するため、**Claude Code は実行していません**。Yamane が editor で判断して実行してください。
- Step 0 のバックアップを必ず先に取得してください（`deleteRow` は UI から戻せません）。
- 範囲外（別 Phase）: 個別行データ異常 (tempDitch=98 等) は 25-d-③、D列 ISO 文字列日付は別途。
