# 報告: kake 数値入力の末尾0が保存・同期で消える（20.0→20）を修正（表示0埋め・丸めなし）

**実施日**: 2026-05-31
**対象**: cpkanri/kake `index.html`（UI/JS）+ `sw.js`（v47→v48）
**GAS/SS**: **無変更**（推奨A＝クライアント側のみで解決） / **clasp**: 不要（push のみ）
**前提 HEAD**: コード `c78810b`（sw `kake-v47`）

---

## 1. 事前調査結果（末尾0が落ちる真因）

末尾0は**複数箇所**で落ちうるが、本件は以下の連鎖:
1. **保存時（主因）**: `saveFormToData`/`saveElecFormToData`/`saveMechFormToData`/`saveEquipFormToData` が `Number(el.value)`/`parseFloat` 相当で weeklyData に格納 → **`20.0`→`20`**（数値型では末尾0は表現されない）。
2. **同期(GAS/Sheets)往復**: 仮に文字列で送っても Google Sheets が**数値型**で保持し `20` で戻る（Sheets は数値の末尾0を保持しない）。
3. **表示時**: `load*DataToForm` が素の数値 `20` を `el.value` に注入 → `"20"` 表示。

→ **保存で数値化された時点で末尾0は失われ**、同期/表示でも復元されない。

### フィールド毎の基準精度の所在
各数値 input の **`step` 属性**が基準精度を表す（＝そのまま採用可能）:
- 水温(tempIn/Ditch/Out/Final) `step="0.1"` → **1桁**
- PH(phIn/Ditch/Out/Final) `step="0.01"` → **2桁**
- MLSS/SV/放流(discharge)/軽油(diesel)/汚泥界面 `step="1"` → **整数**
- 上水(water) `step="0.001"` → 3桁、残留塩素(chlorine) `0.1` → 1桁
- 機器運転時間: 全 `step="0.1"` → 1桁
- 電気数値input: `field.step`（DOM step あり）。電気 dashSupport(力率 `0.01`) と **機械の数値text入力は DOM に step が無い** → `ELEC_SECTIONS`/`MECH_SECTIONS` の `field.step` から導出。

---

## 2. 採用案と実装（推奨A：表示時0埋め・保存型は数値のまま）

**理由**: 保存・同期・Excel・按分・集計は**従来通り数値**のまま（算術前提を一切壊さない＝回帰最小）。表示だけ末尾0を補えば症状解消でき、**GAS/SS 無変更**で実現できる。代替B（文字列保持＋全消費箇所 parseFloat）は配線が広く回帰リスク高のため不採用。

### 追加ヘルパー（index.html）
- `decimalsFromStep(step)`: step → 小数桁（`"0.1"`→1, `"0.01"`→2, `"1"`→0）。
- `FIELD_DECIMALS`: `ELEC_SECTIONS`/`MECH_SECTIONS` の `field.step` から `"elec:key"`/`"mech:key"` 名前空間で基準桁マップを生成（step を持たない入力用フォールバック）。
- `getInputDecimals(el)`: **DOM `step` 属性を優先**、無ければ `FIELD_DECIMALS` を参照、無ければ `null`。
- `padDecimals(value, minDecimals)`: **丸めずに**末尾0埋めして文字列化。
  - 基準未満 → 不足分のみ0埋め（`20`@1→`20.0`、`7.1`@2→`7.10`）。
  - **基準以上の実小数は全桁保持**（`20.55`@1→`20.55`、桁落ち・四捨五入なし）。
  - 整数基準（minDecimals=0）はそのまま、`null`/`""`/`"-"`/トグル値`"○"` 等の非数値はそのまま返す。

### 適用箇所（表示のみ）
`loadDataToForm`（水質）・`loadEquipDataToForm`・`loadElecDataToForm`・`loadMechDataToForm` の**値注入行のみ**を `el.value = padDecimals(v, getInputDecimals(el))` に変更。`save*`/`fill*`/同期/按分/集計は**未変更**。

> `<input type="number">` は値サニタイズ仕様上、有効な数値文字列 `"20.0"` を**そのまま保持**（末尾0は維持）。電気/機械の数値textは元から文字列保持。`isValidElecMechValue("20.0")`=true のため focus/復帰でも維持。

---

## 3. 検証

### 精度・丸めなし（実フィールド定義から抽出してユニットテスト）
- `decimalsFromStep`: 0.1→1 / 0.01→2 / 0.001→3 / 1→0 ✓
- `padDecimals`: `20`@1→`20.0` / `7.1`@2→`7.10` / 整数 `871310`@0→`871310` / 負 `-3`@1→`-3.0` ✓
- **丸めゼロ**: `20.55`@1→`20.55`、`7.109`@2→`7.109`（四捨五入・桁落ちなし） ✓
- 非数値: `null/""`→`""`、`"-"`→`"-"`、`"○"`→`"○"` 保持 ✓
- `FIELD_DECIMALS`: 機械 電流値(0.1)→1 / 吐出圧力(0.01)→2、電気 力率(dashSupport,0.01)→2 ✓
- `getInputDecimals`: 水温(step0.1)→1 / PH(step0.01)→2 / MLSS(step1)→0 / 機械text(step無→map)→2 ✓

### round-trip（jsdom・実 load/save 関数）
- `type=number` input は `"20.0"` をそのまま保持 ✓
- 保存 → `weeklyData.tempIn === 20`（**number 型**＝Excel/按分 不変） ✓
- 同期で素の `20` に戻っても reload で `"20.0"` に0埋め表示 ✓
- `20.55` → 保存 `20.55`(number) → reload `"20.55"`（**丸めて20.6にならない**） ✓

### Excel 出力回帰ゼロ
- `git diff`: 変更は**ヘルパー追加ブロック＋4つの `load*DataToForm` の値注入1行のみ**。`fillWaterSheet`/`fillElecSheet`/`fillMechSheet`/`fillProratedFlowDiff` および全 `save*FormToData` は **untouched**（diff 範囲外）。
- 保存型は数値のまま（round-trip で number を確認）→ Excel の number＋numFmt・集計（最大/平均/最小/合計）・運転管理月報 K/M 按分・水質管理報告 は**入力データ不変＝出力不変**。

### その他
- [x] `node --check`（主 `<script>` 抽出）**PASS**。
- [x] 全タブ（水質/機器/電気/機械）の load 経路に適用。サブタブ/戻す/トグルは値注入経路を共有するため整合（トグル値・"-"・空欄は padDecimals が素通し）。
- [x] **GAS/SS 無変更**（推奨Aで完結）。

---

## 4. 規約遵守
- **四捨五入・桁落ち厳禁**: 実小数を全桁保持し末尾0は補うのみ（`20.55`→`20.55` 確認済）。
- Excel 出力は number＋numFmt 維持、`fillProratedFlowDiff` 按分・集計の数値前提を不変。
- Google Sheets の数値型変換は問題化せず（保存型数値＋表示0埋めで吸収。列型 @ 化＝代替B は不要）。

## 5. 最終 HEAD
- 実装コミット: **`1adf4a749970ff6f4f64a14c67e8932ef4220e25`**（短縮 `1adf4a7`）。`index.html`（decimalsFromStep/getInputDecimals/padDecimals/FIELD_DECIMALS 追加・4 load 関数の0埋め）+ `sw.js`（v47→v48）。
- 本報告のハッシュ追記は後続コミットで push（repo 先頭はその追記コミット）。

## 6. 次フェーズ
- Yamane 実機確認（Clear site data → ハードリロード sw v48 → 数値 `20.0`/`7.10` 入力→保存→同期→`20.0`/`7.10` 表示、`20.55`→`20.55`、Excel 出力一致 を目視）。
- OK 後: 報告系2タブ撤去、MLDO 5月分、または測定者UI横展開 shiwagi（テンプレ `cd653ff`）。
</content>
