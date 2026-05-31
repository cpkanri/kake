# 報告: kake 水質管理報告 — 入力データ無し日の「0 表示」を空欄化（外観・臭気・終沈含む）

**実施日**: 2026-05-31
**対象**: cpkanri/kake `index.html`（runtime 数式変換）+ `sw.js`（v41→v42）
**GAS/SS**: 無変更 / **clasp**: 不要（push のみ）
**前提 HEAD**: `5db5754`（sw `kake-v41`）

---

## 1. 事前調査結果（数式の所在・源泉の空/0）

- **報告シートの数式はテンプレ常駐**（`template.js` の `EXCEL_TEMPLATE_B64` 内、`水質管理報告` = sheet5.xml）。PWA は書いていない。**共有数式(shared formula)は 0 個** → ExcelJS は各セルの完全数式を読み込む。
- **INDEX/MATCH フロー列の配置**:
  - **(1/2) 数値ページ（行8-38）**: C/D/F/G/H/J/K/M/O/P/Q（水温/PH/透視度/MLDO/MLSS/SV30/残留塩素 等）。
  - **(2/2) 外観・臭気ページ（行49-79）**: C/D/F（外観 流入/ディッチ/放流）, G/H/J（臭気 流入/ディッチ/放流）。
  - 各セルは `IFERROR×5週ネスト` 構造（週ごとに INDEX を 1 つ、最終 `IFERROR(...,"")`）。
- **終沈列**:
  - 数値ページ E/I/L（終沈水温/PH/透視度）= **テンプレに数式なし（空セル）**。PWA の `fillReportFinalData` が `setCell` で直書き。`setCell` は `null/undefined/""` を**スキップ**するため**無データ日は空欄のまま**（項目C＝維持）。
  - 外観・臭気ページ E/I（終沈）= PWA が派生数式 `IF(C="","","透明")` / `IF(G="","","無")` を runtime 付与。
- **源泉（日常水質）の無データ日**: 数値は `if(!day) continue`、外観/臭気は `dayHasMeasurement()` フィルタにより**何も書き込まれない＝真に空（blank）**。よって `ISBLANK` 判定が有効（土日が既に空欄なのと同じ）。

---

## 2. 修正内容（A〜D）

`index.html` に runtime 変換関数を追加し、他の PWA 書込が全て終わった後（`writeBuffer` 直前）に実行：

```js
try { fixReportBlankZeros(wb); } catch (e) { console.error("fixReportBlankZeros:", e); }
```

`fixReportBlankZeros(wb)` は `水質管理報告` シートの全数式セルを走査し、`INDEX(` を含むものについて、トップレベルの各 `INDEX(...)` を以下で包む（`guardIndexBlank()`、括弧対応・文字列リテラル考慮・内部再走査なしで二重包み防止）：

### A. INDEX/MATCH フロー列 — 適用前後（C50 1セル分）

**前**:
```
IFERROR(IFERROR(IFERROR(IFERROR(IFERROR(
  INDEX(日常水質!$J$19:$N$19,MATCH($A50,日常水質!$J$14:$N$14,0)),
  INDEX(日常水質!$J$65:$N$65,MATCH($A50,日常水質!$J$60:$N$60,0))),
  …week3,4,5…),"")
```

**後**（各 INDEX を IF(ISBLANK(INDEX),"",INDEX) 化、5週・全列に一律適用）:
```
IFERROR(IFERROR(IFERROR(IFERROR(IFERROR(
  IF(ISBLANK(INDEX(日常水質!$J$19:$N$19,MATCH($A50,日常水質!$J$14:$N$14,0))),"",INDEX(日常水質!$J$19:$N$19,MATCH($A50,日常水質!$J$14:$N$14,0))),
  IF(ISBLANK(INDEX(…week2…)),"",INDEX(…week2…))),
  …week3,4,5…),"")
```

挙動:
- 源泉が真に空（無データ日）→ `ISBLANK=TRUE` → **""（空欄化）**
- 源泉が実測 0 → `ISBLANK=FALSE` → **0 を保持**（実測0と無データを区別）
- MATCH 失敗（土日）→ INDEX エラー → 既存 `IFERROR` 5週ネストが次週/最終 `""` へフォールバック（**土日空欄維持**）

### B. 終沈派生数式（外観E / 臭気I）— 連鎖空欄化

`IF(C49="","","透明")` / `IF(G49="","","無")` は、A により C49/G49 が無データ日に `""` を返すため、**連鎖的に `""` を返し終沈も空欄化**。追加対応不要（派生式は同行 C/G を参照しており連鎖成立を確認）。

### C. 数値終沈（E/I/L 直接書込）— 維持

`setCell` が空値スキップのため無データ日は空欄のまま。**本修正は数式セルのみ対象**で E/I/L（テンプレ空・数式なし）には触れず、維持。

### D. 集計行（39 MAX / 40 AVERAGE / 41 MIN）— 自動正常化

A により日次セルが `""`（文字）を返すため、`MAX/MIN/AVERAGE` は数値以外を無視。**0 混入が解消され最小値が実値になる**。集計行自体は無変更。

---

## 3. 検証（ExcelJS 4.4 で実テンプレを round-trip）

- テンプレ `水質管理報告` を ExcelJS で読み込み → `fixReportBlankZeros` 適用 → 書き出し → 再読込で永続性確認。
- **書換セル数 = 527** = 数値ページ 11列×31行(341) + 外観臭気ページ 6列×31行(186)。**意図した列・行数と完全一致**。
- C50: 適用後 `ISBLANK` 5 個、write→reread 後も 5 個（**round-trip 永続**）。
- K8（数値列）: `ISBLANK` 5 個。
- C39（集計 MAX）: `IFERROR(MAX(C8:C38),"")` のまま**無変更**（INDEX 無しのため対象外）。
- E49/I49（外観・臭気 終沈）: テンプレでは null（PWA 直書き）→ 本関数は数式なしのため**未変更**（正しい）。
- ユニットテスト: 括弧バランスOK / 二重包みなし / 各 `ISBLANK` が直接 `INDEX(` を包む / `O1`・INDEX無し式は不変。
- `node --check`（主 `<script>` 抽出）: **PASS**。

### チェックリスト
- [x] (1/2) 4/5/6日 数値列空欄化（無データ→ISBLANK→""）。終沈 E/I/L は元から空欄を維持。
- [x] (2/2) 4/5/6日 外観・臭気 空欄化。**外観終沈(E)・臭気終沈(I)** も派生式連鎖で空欄。祝日同様。
- [x] 土日は IFERROR フォールバックで従来通り空欄維持。
- [x] 実データ日は不変・実測0保持（ISBLANK=FALSE）。
- [x] 集計行 0 混入解消（自動）。
- [x] `#REF!` 等の新規エラーなし（既存 IFERROR 構造温存・括弧バランス検証済）。

> 注: 実機(Excel)での最終再計算確認は Yamane 実機（次フェーズ）。本報告の検証は ExcelJS round-trip と数式構造解析による。

---

## 4. 規約遵守
- GAS/SS 無変更・clasp なし（push のみ）。
- 「無データ」と「実測0」を `ISBLANK` で区別（実測0は保持）。
- 既存の `IFERROR` 5週ネスト構造は維持し、各週 INDEX のみ包む。
- テンプレ base64 は無編集（openpyxl 全保存・ZIP編集は不使用。runtime ExcelJS 変換で対応）。
- `index.html` 変更につき `sw.js` を `kake-v41`→`kake-v42` に bump。

## 5. 最終 HEAD
- commit: 後述（本コミットのハッシュ）。`index.html`（fixReportBlankZeros/guardIndexBlank 追加）+ `sw.js`（v42）+ 本報告。

## 6. 次フェーズ
- Yamane 実機確認（Clear site data → ハードリロード sw v42 → 2026-05 出力 → 4/5/6日 空欄・集計正常を確認）。
</content>
</invoke>
