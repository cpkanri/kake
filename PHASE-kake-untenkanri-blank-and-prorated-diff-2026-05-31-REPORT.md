# 報告: kake 運転管理月報 — ①無データ日0の空欄化 ＋ ②K/M列 按分差分の自動入力

**実施日**: 2026-05-31
**対象**: cpkanri/kake `index.html`（runtime ExcelJS 変換／値書込）+ `sw.js`（v42→v43）
**GAS/SS**: 無変更 / **clasp**: 不要（push のみ）
**前提 HEAD**: コード `95a35b3`（sw `kake-v42`）

---

## 1. 事前調査結果

- **シート**: `運転管理月報`（template.js base64 = sheet4.xml）。日付 A6-A36＝1〜31日（`row = day + 5`）。**集計行 37 MAX / 38 AVERAGE / 39 MIN / 40 SUM**。共有数式 0 個。
- **INDEX/MATCH 数式列**: **C/D/E/F/J/L（行7-36）**。行6（1日）は C/D/E/F/J/L に数式が無く **PWA が値書込**（`fillKakeOperationReportSheet`）。源泉(日常水質)の無データ日は真に空 → `ISBLANK` 有効。
- **G(固形塩素)/H・I(脱水ケーキ)/N(放流流量)**: テンプレ日次セルは**空セル（数式なし）**。0 を生まないため Part1 対象外（自動で空欄）。
- **K/M の現状**: テンプレ常駐の LOOKUP 数式
  `K7 = IF(J7="","",IFERROR((J7-LOOKUP(2,1/(J$6:J6<>""),J$6:J6))/(A7-LOOKUP(...,A$6:A6)),""))`。
  → **実測日のみ**に値が入り、間の土日・無データ日には按分が入らない。さらに無データ日 J=0（修正前）で LOOKUP が誤起点を拾い先頭が壊れる（7日 K にゴミ値）。
- **J/L 源泉**: PWA data model の `returnSludge`（返送汚泥 累積読み値）/`excessSludge`（余剰汚泥 累積読み値）。**按分はシート数式値ではなく data model から直接計算**。
- **前月/翌月データ**: `localStorage["kake_weekly_<YYYY-MM>"]`（年跨ぎ Dec↔Jan 対応）。前月末の最後の実測・翌月最初の実測を読む。

---

## 2. 実装内容

### Part 1（無データ日0の空欄化）— 水質方式の拡張
- `fixReportBlankZeros(wb)` を**両シート対応に汎用化**（`wrapIndexBlankInSheet(ws, skipCols)`）。
  - `水質管理報告`: 全 INDEX 数式セルを `IF(ISBLANK(INDEX),"",INDEX)` 化（従来通り）。
  - `運転管理月報`: 同方式で C/D/E/F/J/L を包む。**K(11)/M(13) 列は除外**（Part2 が値書込）。
- 既存 IFERROR 5週ネスト構造は温存し各 INDEX のみ包む。源泉空→""、実測0→0保持、土日→IFERRORフォールバックで空欄維持。
- 集計（MAX/AVG/MIN/SUM）は日次が "" を返すことで 0 混入が自動解消。

### Part 2（K/M 按分差分・PWA data model から値書込）
- 新関数 `fillProratedFlowDiff(wb, yyyy, mm)` を `writeBuffer` 直前（Part1 と同段階）に実行。
- ロジック（J→K col11, L→M col13 それぞれ）:
  1. ライブ `weeklyData` から当月の実測 (date, value) 点を昇順収集（`collectCurrentMonthFlowPoints`）。
  2. 前月 localStorage の**最後の実測**を先頭アンカー、翌月の**最初の実測**を末尾アンカーに追加（`collectStoredMonthFlowPoints`、当月所属日のみ）。無ければ追加せず＝そのギャップは空欄。
  3. 当月 K/M 日次セル(R6〜R末)を一旦 `null`（テンプレ LOOKUP 数式を除去）。
  4. 連続実測ペア (A,B) ごとに `daily=(Vb−Va)/(暦日差 b−a)` を**丸めず**算出し、a+1〜b の各暦日のうち**当月該当日**の K/M に値書込。numFmt はテンプレ既存スタイルを踏襲。
- 旧 `fillKakeOperationReportSheet` の K6/M6 生差分書込は**削除**（按分に一本化）。C/D/E/F/J/L の R6 値書込は維持。
- 土日・祝日・未点検日もギャップ内なら値が入る（読み値列 J/L は Part1 で空欄でも K/M は値あり）。負差分はそのまま（データ異常サイン）。

### K/M 現行 vs 新ロジックの差
| | 現行（LOOKUP 数式） | 新（PWA 按分値書込） |
|---|---|---|
| 値が入る日 | 実測日のみ | **全ギャップ日（土日/祝日/無データ含む）** |
| 計算源 | シート J/L セル（再計算依存・0混入で破綻） | data model 実測読み値（再計算非依存） |
| クロス月 | 不可 | 前月末→当月初 / 当月末→翌月初 を按分 |
| 合計 | 実測日合計（間欠） | **当月総差分に一致** |

---

## 3. 検証（ExcelJS 4.4 で実テンプレ round-trip ＋ 指示書例の再現）

index.html から該当関数を**ブレースマッチで原文抽出**し、weeklyData/localStorage をモックして実テンプレに適用。

### Scenario A（前月/翌月データ無し・指示書例 2026-05 返送汚泥）
実測: 1日=869358, 7日=871310, 8日=871658, 11日=872472
- K: **1日=空欄**（前月無し）、**2〜7日=各 325.33**（1952/6）、**8日=348**、**9〜11日=各 271.33**（814/3）、**12〜31日=空欄**（翌月無し）。指示書例と完全一致。
- **合計K = 3114 = 872472−869358（当月総差分）に一致**。
- write→reread で値永続（K8=325.33, K6=空欄）。

### Scenario B（クロス月按分）
当月実測 10日=100000, 20日=100200 / 前月末 4/28=99500 / 翌月初 6/3=100600
- 最初ギャップ 4/28→5/10（12日）: **1〜10日=各 41.667**（500/12）。
- 中間 5/10→5/20（10日）: **11〜20日=各 20**。
- 最後ギャップ 5/20→6/3（14日）: **21〜31日=各 28.571**（400/14）。
- 全て期待値一致（PASS）。

### Part 1 検証
- 運転管理月報 C7/J7/L7 = `IF(ISBLANK(INDEX...` 化、**K7/M7 は LOOKUP のまま（Part1 除外）**→Part2 で値上書き。
- 水質管理報告 C50 も従来通り ISBLANK 化（リグレッションなし）。
- `node --check`（主 `<script>` 抽出）: **PASS**。

### チェックリスト
- [x] Part1: 運転管理月報 INDEX 列(C/D/E/F/J/L)を ISBLANK 化、K/M 除外。土日空欄維持・実測0保持。
- [x] Part2: K/M を data model から按分→全ギャップ日へ値書込（丸めず numFmt 踏襲）。
- [x] 前月/翌月で最初/最後ギャップを按分（無ければ空欄）、土日もギャップ内は値。
- [x] 集計 自動正常化（合計K=当月総差分）。
- [x] `#REF!` 等の新規エラーなし（IFERROR 構造温存・括弧バランス検証済）。

> 実機(Excel)最終再計算の目視は Yamane 実機（次フェーズ、F9 でキャッシュ値確認）。本報告は ExcelJS round-trip と数式構造解析による検証。

---

## 4. 規約遵守
- 「無データ」と「実測0」を ISBLANK で区別（実測0保持）。土日空欄・実データを壊さない。
- 按分は PWA data model から直接計算して値書込（シート数式再計算に非依存）、丸めず格納。
- ExcelJS: 数式 `{formula:}`+`fullCalcOnLoad`、sanitize は `<v>`除去 `<f>`保持。テンプレ base64 無編集。
- GAS/SS 無変更・clasp なし。`sw.js` を `kake-v42`→`kake-v43` に bump。

## 5. 最終 HEAD
- 実装コミット: **`75165443f44c8b343355e1c83ff7af1e17dede54`**（短縮 `7516544`）。`index.html`（fixReportBlankZeros 汎用化 + wrapIndexBlankInSheet + fillProratedFlowDiff 系追加、fillKakeOperationReportSheet の K6/M6 削除）+ `sw.js`（v42→v43）。
- 本報告のハッシュ追記は後続コミットで push（repo 先頭はその追記コミット）。

## 6. 次フェーズ
- Yamane 実機確認（Clear site data → ハードリロード sw v43 → 2026-05 出力 → Part1/Part2 目視）。
- OK 後: 報告系2タブ撤去、MLDO 5月分、または測定者UI横展開 shiwagi（テンプレ `cd653ff`）。
</content>
