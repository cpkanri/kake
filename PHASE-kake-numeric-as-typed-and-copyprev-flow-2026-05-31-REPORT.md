# 報告: kake ①数値末尾0を「入力した分だけ」保持（step 0埋め廃止・入力文字列保持） ＋ ②前日コピーを積算値・流量にも適用

**実施日**: 2026-05-31
**対象**: cpkanri/kake `index.html`（UI/JS）+ `sw.js`（v48→v49）
**GAS/SS**: **無変更**（同期保持はクライアント側 preserve-guard で実現） / **clasp**: 不要（push のみ）
**前提 HEAD**: コード `1adf4a7`（sw `kake-v48`）

---

## Part 1 — 数値末尾0を「入力した分だけ」保持（過剰0埋めの是正）

### 症状
前回 `1adf4a7` の step 基準0埋め `padDecimals` が**過剰**。`step="0.01"` のフィールド（返送汚泥流量等）で `869118`→`869118.00`、`23454.6`→`23454.60` と入力していない桁まで0が付いた。

### 採用案: step 0埋めを撤去し、**入力文字列を厳密保持**
- **`padDecimals`（step基準0埋め）を撤去**。helper `decimalsFromStep`/`FIELD_DECIMALS`/`getInputDecimals`/`padDecimals` を**削除**。
- **保存で数値化しない**: `saveFormToData`/`saveEquipFormToData`/`saveElecFormToData`/`saveMechFormToData` の数値分岐で `Number()`/`parseFloat` をやめ、**`el.value` の文字列をそのまま weeklyData に格納**（空は `null`、`"-"`・トグルは従来通り）。
- **表示**: `load*DataToForm` は保持文字列を `el.value` に**素のまま注入**（0埋め・丸めなし・過剰0埋めなし）。
- **戻す(Undo)復元**: oldValue を `Number()` 化せず**文字列のまま**戻す（末尾0/入力通りを維持）。

### 同期往復の保持（GAS/SS 無変更で実現）
- **真因の確認**: 同期は init で自動実行（`syncFromServer`→`mergeServerData`）し、サーバ値を weeklyData へ直接代入する。列ベース保存（日常水質/電気/機器運転＝camelCase 列）では Google Sheets が**数値型化**し `20.0`→`20` で戻るため、放置するとローカル文字列が桁落ち数値で上書きされる。
- **保持策（クライアント側 preserve-guard・GAS不要）**: `mergeServerData` の各代入を `mergeFieldPreserveTypedZero(target, key, srcVal)` 経由に変更。
  - ローカルが**非空の数値文字列**で、サーバ値と**数値的に等しい**（`Number(cur)===Number(src)`）なら、**ローカル文字列（末尾0）を維持**。
  - 値が実際に異なる（他端末で更新）場合のみサーバ値を採用。
  - 根拠: 同期往復は精度（末尾0）を落とすだけで**値自体は変えない**ため、「数値的に同一ならローカル維持」で末尾0を安全に保持できる。**列型@化や GAS 変更は不要**（▶本実行も不要）。
- 適用4箇所: water / equipment / electrical / mechanical の各マージ代入。

### 数値消費箇所は既に Number() 化済（回帰なし・新規 parseFloat 不要）
事前監査の結果、数値が必要な経路はすべて文字列を Number 化する実装になっており、**新たな parseFloat 追加は不要**:
- **Excel 出力**: `setCell` が数値文字列を `Number()` 化して number セル書込（"20.0"→20, "869118"→869118, "23454.6"→23454.6）。`fillWaterSheet`/`fillElecSheet`/`fillMechSheet`/`fillKakeOperationReportSheet` は **untouched**。
- **按分**: `fillProratedFlowDiff` → `flowNumOrNull(v)`＝`Number(v)`（`returnSludge`/`excessSludge`/`discharge`）。**untouched**。
- **電気使用量(自動計算)**: `computeElectricalUsage`/`findPreviousElecReading` が `Number()` 化。
- **バリデーション**: `isValidElecMechValue` は元から文字列ベース。
- 集計（最大/平均/最小/合計）は **Excel テンプレ数式**側で number セルを集計（JS 側 percent は非空カウントのみ）。
- 監査: `toFixed`/値の直接算術は無し（`parseInt` は全て日付/月パース）。空/`"-"`/トグルは数値化対象外で素通し。

> ⚠ 四捨五入・桁落ち厳禁を満たす（文字列保持で丸め発生せず、`setCell`/按分の Number 化も値を変えない）。Excel の numFmt 表示は従来通り＝出力回帰なし。

---

## Part 2 — 前日コピーに「積算値・流量」を追加

### 真因
「前日コピー」は水質タブで `COPY_FIELDS`（部分集合）を使用しており、**積算値・流量（電力量 power200v/100v/reactivePower/demand、上水 water、軽油 diesel、返送/余剰汚泥流量 returnSludge/excessSludge、放流流量 discharge）が除外**されていた（機器/電気/機械タブは ALL_*_KEYS で全フィールドコピー済）。

### 修正
- `COPY_FIELDS` に上記**積算/流量9キーを追加**。除外は `inspector`（月単位で別管理）・`bikou`（備考メモ）のみ。
- コピーは `dst[k]=src[k]`（forEach）で値（文字列保持と整合＝コピー値の末尾0も入力通り）。トグル/空欄/`"-"` の扱いは不変。

---

## 検証

### Part 1（jsdom・実 save/load 関数）
- as-typed round-trip（保存→表示）: `869118`→`869118`（**.00 付かず**）、`23454.6`→`23454.6`（**.60 付かず**）、`20.0`→`20.0`、`7.10`→`7.10`、`20.55`→`20.55`（**丸めなし**）。保存型は**文字列**。✓
- **Excel setCell 回帰**: `"20.0"`(文字列)→セル値 `20`(number)＝`20`(number入力)と**同一**、`"869118"`→`869118`、`"23454.6"`→`23454.6`、`"-"`→`"-"`、`""`→skip。✓（出力バイト不変）
- **按分** `flowNumOrNull`: `"871310"`→871310、`"23454.6"`→23454.6、`"-"`→null。✓
- **merge preserve-guard**: ローカル`"20.0"`×サーバ`20`→`"20.0"`維持、×`25`→`25`採用、`"23454.6"`×`23454.6`→維持、ローカル`null`→サーバ採用、サーバ空→ローカル維持。✓

### Part 2
- `COPY_FIELDS` に積算/流量9キーを含み、`inspector`/`bikou` を除外。✓

### その他
- [x] `node --check`（主 `<script>` 抽出）**PASS**。
- [x] 出力関数（fillWaterSheet/fillElecSheet/fillMechSheet/fillProratedFlowDiff）・setCell・flowNumOrNull は **untouched**（diff 範囲外）→ Excel 数値/numFmt/集計/K-M按分/水質管理報告 回帰なし。
- [x] **GAS/SS 無変更**（preserve-guard で同期保持を完結。列型@化・▶本実行 不要）。

---

## 規約遵守
- 四捨五入・桁落ち厳禁、末尾0は入力通り（過剰0埋めもしない）。
- Excel 出力は number＋numFmt 維持、`fillProratedFlowDiff` 按分・集計は Number 化で数値前提を維持。
- 文字列保持に伴う数値消費箇所は全経路が既存で Number() 化済（按分・集計・Excel・バリデーション）を監査で確認。
- Google Sheets 数値型変換は **クライアント側 preserve-guard** で吸収（列型@化＝GAS変更は不要）。

## 最終 HEAD
- 実装コミット: **`626953e88b3c7cf7de63ca3281adb29849ad94db`**（短縮 `626953e`）。`index.html`（padDecimals撤去・save文字列保持・load素表示・undo文字列・merge preserve-guard・COPY_FIELDS拡張）+ `sw.js`（v48→v49）。
- 本報告のハッシュ追記は後続コミットで push（repo 先頭はその追記コミット）。

## 次フェーズ
- Yamane 実機確認（Clear site data → ハードリロード sw v49 → 数値入力通りの末尾0・保存→同期→再表示維持・前日コピーで積算/流量も反映・Excel 出力一致 を目視）。**GAS/SS 変更なし＝▶本実行 不要**。
- OK 後: 報告系2タブ撤去、MLDO 5月分、または測定者UI横展開 shiwagi（テンプレ `cd653ff`）。
</content>
