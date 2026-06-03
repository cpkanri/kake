# kake clasp 再開レポート (scriptId 訂正版)

実施日: 2026-05-29 / clasp 3.3.0 / login `cleanprokanri@gmail.com`

## 結論

**★ 段階 1 (`clasp push`) = 達成。** 正しい scriptId で接続・pull・push すべて成功。
これで `kake_gscode.txt` の全文ペーストは不要になり、`clasp push` で deploy 可能。

段階 2 (`clasp run`) は想定どおり未達 (API executable 未デプロイ)。Yamane への依頼事項を末尾に記載。

## scriptId 訂正

- 旧 (誤): `...QUkSlldOXbkV...` (小文字 l 2 連)
- 新 (正): `...QUkSlIdOXbkV...` (小文字 l + 大文字 I、34 文字目)
- `C:\dev\clasp-kake\.clasp.json` を正しい値に差し替え済み。

## 各 Step 結果

| 項目 | 記録 |
|---|---|
| Step 2 (pull) | **成功**。`Pulled 2 files.` (`appsscript.json` + `コード.js`)。= scriptId 解決確認。 |
| Step 3 (diff) | 差分 **66 行**、すべて想定内。下記参照。想定外差分 **なし**。 |
| Step 4 (push) | **成功**。`Pushed 2 files at 11:43:56.` (`appsscript.json` + `コード.js`)。`clasp push -f` 使用。 |
| Step 5 (run) | **失敗** (想定内)。エラー: `Script function not found. Please make sure script is deployed as API executable.` |
| 段階 1 (push) 達成可否 | **★ 達成** |
| 段階 2 (run) | 未達。下記 Yamane 依頼事項参照。 |

## Step 3 差分の内訳 (Compare-Object, SyncWindow 5)

**repo にのみ存在 (64 行) — push で GAS に追加された分:**
- `migrateWaterAddReactiveDemand_phase25d` 関数 + コメントヘッダ (Phase 25-d-①)。
- 想定どおり「migrate 関数の追加」。

**GAS にのみ存在 (2 行) — push で消えた分:**
```js
function runRealCleanup_phase25c_zeta() {
  return cleanupOrphanWeeks_phase25c_zeta(false);
```
- 指示書が予告していた ζ ラッパー (`runRealCleanup_phase25c_zeta`)。
- ζ は完了済みのため削除して問題なし → push で除去済み。無害。

→ 想定外の手動編集は検出されず。安全に push 完了。

## Step 5 (clasp run) の詳細

- 実行コマンド: `clasp run "migrateWaterAddReactiveDemand_phase25d"` (引数省略 = default dryRun=true)
- エラー全文: `Script function not found. Please make sure script is deployed as API executable.`
- SS は一切変更していない (dry-run 試行のみ、実行自体が API executable 未デプロイで届いていない)。

## 段階 2 (clasp run) への Yamane 依頼事項

`clasp run` を使うには、以下が GAS 側 / GCP 側で必要 (push とは別系統):

1. **GCP 標準プロジェクトの紐付け**: Apps Script エディタ → プロジェクト設定 → GCP プロジェクトをデフォルトから標準プロジェクトへ変更。
2. **API 実行可能ファイルとしてデプロイ**: エディタ → デプロイ → 新しいデプロイ → 種類「API 実行可能ファイル」。これが無いと今回の "Script function not found / deployed as API executable" が出る。
3. 上記後に `clasp run` を再試行。

ただし **run が無理でも実用上は十分**:
- `clasp push` で deploy 済み → GAS エディタで `migrateWaterAddReactiveDemand_phase25d` を選び ▶ 実行 (1 クリック、dryRun=true)。
- 本番移行時は引数 `false` で実行 (SS 変更を伴うため Yamane 判断で)。

## 必須事項の遵守確認

- SS を変更する操作 (run の false 実行) は **未実施**。dry-run のみ試行 (かつ届かず)。
- Step 3 で想定外差分なし → 停止せず続行は妥当。
- PWA / 既存 GAS 関数のロジックは変更なし (push 内容は repo `07088ac` そのまま)。
