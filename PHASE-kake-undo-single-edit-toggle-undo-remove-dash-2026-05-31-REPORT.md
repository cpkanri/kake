# 報告: kake 「戻す」を1編集のみに修正 ＋ トグルをundo対応 ＋ トグルの「-」選択肢削除

**実施日**: 2026-05-31
**対象**: cpkanri/kake `index.html`（UI/JS）+ `sw.js`（v46→v47）
**GAS/SS**: 無変更 / **clasp**: 不要（push のみ）
**前提 HEAD**: コード `8eadcf0`（sw `kake-v46`）

---

## Part 1 — 「戻す」が日付列のデータを全消し → 1編集のみ取消に修正

### 全消しの真因
- 設備タブ(equip/elec/mech)の `<input>` は **change で weeklyData にコミットしない**（保存/タブ・週切替時の `save*FormToData()` でまとめてコミット）。undo 記録(`pushUndo`)は行うが weeklyData は未更新。
- 「戻す」復元ハンドラは `weeklyData[..][field]=oldValue`（フィールド単位＝正しい）後に `load*DataToForm()` で**フォーム全体を weeklyData から再描画**する。
- このとき**未コミットの他フィールド編集**が、古い/空の weeklyData で**上書き＝全消し**されていた（＝真因）。日常水質は別経路で機能していたが、設備タブで顕在化。

### 修正（戻す新フロー）
戻す押下ハンドラ冒頭に「現フォーム非破壊コミット」を追加し、手順を統一:
1. **現在アクティブタブの `save*FormToData()` を呼び全DOM値（テキスト＋トグル）を weeklyData へ非破壊コミット**（`saveFormToData`/`saveEquipFormToData`/`saveElecFormToData`/`saveMechFormToData`、いずれも DOM 走査・クリアなし）。
2. `undoStack.pop()` の**当該1フィールドのみ** `weeklyData[sheet][week][day][field]=oldValue`。
3. `load*DataToForm()` 再描画 → ①で全値コミット済のため**他フィールドは保持**、当該1フィールドのみ oldValue 表示。
- 結果「1回押下＝直前の1編集のみ取消」、同日の他フィールドは残る。連続押下で1件ずつ遡る。
- `currentSheet`/`currentElecPage`/`currentMechPage`/`currentWeek` は変更せず保持。

---

## Part 2 — トグルボタンを undo 対象に

### 事前調査
- トグルは `buildElecTable`/`buildMechTable` の click ハンドラで `cur→newVal` をサイクルし **weeklyData へ即時コミット**。従来 undo 記録は `<input>` の focus/change のみで **button トグルは未記録**。
- `attachUndoToTableInputs()` は `input` のみ対象（トグル button は非対象）。

### 修正
- elec/mech のトグル click ハンドラ内（値確定直後）で `pushUndo({sheet, week, day:btn.dataset.eday|mday, field:btn.dataset.elec|mech, oldValue:cur, newValue})` を記録（テキスト入力と**同形式・1タップ1エントリ**）。
- 復元は Part 1 の手順でトグルにも適用。`load*DataToForm()` は非INPUT(トグル)について `dataset.val`/`textContent` を同期するため、**戻すとトグル表示も元状態へ**戻る。
- トグル click ハンドラはテーブル生成のたびに**新規 element へ1つだけ**付与されるため二重 push は発生しない（input 側は `_undoAttached` で冪等、前フェーズ実装）。

---

## Part 3 — トグルの「-」選択肢を削除（空欄→出力「-」で代替）

### 事前調査
- 「-」を含むトグルは **機械設備のみ 41 個**（すべて `options:["○","△","×","-"]`）。**電気トグルに「-」は無し**（外観/指示状況は○△×のみ）。
- 現状 `MECH_AUTO_DASH_KEYS` は `f.options.indexOf("-")>=0` で「-」含有トグルを dash 集合へ追加していた。「-」を除去するとこの判定が不発になる。

### 修正方針と判断（重要・要確認）
- 全「-」含有トグル(41)の options から「-」を除去（`["○","△","×"]`）し、**`dash: true` を明示付与**。
- `MECH_AUTO_DASH_KEYS` の判定を `f.options.indexOf("-")` → **`f.dash === true`** に置換（番号型・`/Mode$/`・label「モード確認」の条件は不変）。
- これにより **dash 集合は完全同一（100 キー、増減ゼロ）** ＝ **空欄→出力「-」が従来通り**・**Excel 出力回帰ゼロ**。

> ⚠ **指示書内の矛盾と本実装の判断**: 指示の「修正」本文は「**空欄時に「-」出力が従来通り効くようにする**」（＝出力保持）と明記する一方、検証欄に「常用機選択/**異音振動は対象外維持**」とある。現行コードでは異音振動(`*Vibration`)は options に「-」を含むため**既に dash 集合に含まれ空欄→「-」出力**している（旧コメントの『対象外』は実コードと不一致）。
> 本実装は最重要制約「**Excel 出力回帰すべて不変**」と「従来通り効くように」を優先し、**現行の dash 集合を完全保持**（異音振動も従来通り空欄→「-」）。`*Select`（常用機選択, 「-」非含有）は従来通り**対象外**のまま。
> もし異音振動の空欄を「-」ではなく**空欄**にしたい場合は、該当 31 キーの `dash: true` を外すだけの軽微フォロー対応で可能。Yamane 実機確認で要判断。

---

## 検証

### Part 1 + Part 2（jsdom・実関数）
index.html から **実**の `pushUndo`/`saveElecFormToData`/`loadElecDataToForm`/**戻す click ハンドラ本体**を抽出し、elec フォーム（数値2＋トグル1）で再現:
- ✓ バグ条件再現: 入力2件編集してもトグル即時コミットのみで、入力は weeklyData 未コミット。
- ✓ Undo#1 → **トグルのみ空へ復元（表示同期）**、入力A=123・B=5.5 は**保持（全消しなし）**。
- ✓ Undo#2 → **Bのみ空へ**、A=123 保持。
- ✓ Undo#3 → Aのみ空へ。stack 空・ボタン disabled・トースト各回表示。
- 全12アサーション **ALL PASS**。

### Part 3（出力回帰ゼロ・git HEAD 比較）
- `MECH_AUTO_DASH_KEYS` を旧ロジック(HEAD, options「-」判定)と新ロジック(working, `dash:true`)で算出し比較: **集合完全一致（100 キー、drop/add ゼロ）**。
- トグルで「-」を残すもの **0 個**、`dash:true` 付与 **41 個**（＝旧「-」含有トグル数と一致）。
- → 空欄→「-」出力は従来通り、Excel 出力回帰なし。

### その他
- [x] `node --check`（主 `<script>` 抽出）**PASS**。
- [x] 復元後にサブタブ/週保持（current* 不変・`load*DataToForm` が現ページのみ再注入）。
- [x] Excel 出力関数（fillMechSheet/fillElecSheet）・save/load ロジック無変更（diff は MECH_SECTIONS options・build トグルハンドラ・MECH_AUTO_DASH 判定・undo ハンドラのみ）。
- [x] モード「-」/「自動」、異音振動○×（選択値）、祝日空欄、点検者、積算読み自動入力 すべて不変。

---

## 規約遵守
- undo 記録は実在 input/トグルのみ、再生成時に冪等（input=`_undoAttached`、トグル=生成時1付与）。
- 「無データ/空欄」と「実測値」を区別、空欄トグル→出力「-」(U+002D) は dash 明示キーで維持、祝日は空欄。
- 復元後 `currentElecPage`/`currentMechPage`/`currentWeek` 保持。save/load は DOM 走査・非破壊。ExcelJS 出力ロジック無変更。

## 最終 HEAD
- 実装コミット: **`c78810b5c72a44068c07dc53fdf2d3bcb323e352`**（短縮 `c78810b`）。`index.html`（Part1 undoハンドラ／Part2 トグルpushUndo×2／Part3 options「-」除去41＋dash判定）+ `sw.js`（v46→v47）。
- 本報告のハッシュ追記は後続コミットで push（repo 先頭はその追記コミット）。

## 次フェーズ
- Yamane 実機確認（Clear site data → ハードリロード sw v47 → 各タブで 戻す1編集・トグル戻し・トグル「-」無し・出力「-」を目視）。**特に異音振動の空欄を「-」のまま維持で良いか確認**（Part3 の判断）。
- OK 後: 報告系2タブ撤去、MLDO 5月分、または測定者UI横展開 shiwagi（テンプレ `cd653ff`）。
</content>
