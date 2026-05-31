# 報告: kake ①日常水質 積算値・流量の平均を按分化 ＋ ②電気設備 空欄→「-」 ＋ ③前日コピーをデータのある日まで遡る

**実施日**: 2026-05-31
**対象**: cpkanri/kake `index.html`（UI/JS＋Excel出力）+ `sw.js`（v49→v50）
**GAS/SS**: 無変更 / **clasp**: 不要（push のみ）
**前提 HEAD**: コード `626953e`（sw `kake-v49`）

---

## Part 1 — 日常水質 積算値・流量の「平均」を按分（平均日量）に

### 事前調査
- `fillWaterSheet` の積算テーブル: `DATA_ROW_BASE=4`, `DATE_ROW_BASE=3`, 各週 +46 オフセット。データ列 I:N（col9-14, 積算は I 列起点）、平均 O=col15（O:R 結合マスター）。
- **現状の平均(O)**: PWA が `IFERROR(AVERAGE(I:N),"")`（積算）/`AVERAGE(J:N)`（測定）を**数式で付与**（テンプレには無し）。
- **対象行**: 積算テーブル R4-R12（`RUISAN_KEYS`＝電力量 power200v/100v・無効電力・デマンド・上水・軽油・返送/余剰汚泥流量・放流流量、offset 0-8）。測定テーブル R16-R36 は対象外。
- I/N の**日付**は dateRow(R3+offset) の I:N 列（I=月…M=金, N=次週初平日）。按分分母＝N列日付−I列日付の**暦日数**（祝日・月跨ぎ含む実日数）。

### 修正
- 積算/流量行の O を **「平均日量 = (最後の読み − 最初の読み) / (最後の日付 − 最初の日付の暦日数)」** に変更。
- **I/N が空でも内側の実測点で按分**するため、範囲 I:N の**実在する最初/最後の読み値・日付**を取得:
  - 最後の値/日付: `LOOKUP(2,1/(I{r}:N{r}<>""),I{r}:N{r})` / 同 `I{dateRow}:N{dateRow}`。
  - 最初の位置: `MATCH(TRUE,INDEX((I{r}:N{r}<>""),0),0)` → `INDEX(...,pos)` で値/日付。
  - 全体を `IFERROR(...,"")`（読み値1点以下＝0除算/エラー → 空欄）。
- **四捨五入なし**（数式で除算、表示は既存 numFmt）。`fullCalcOnLoad` で開封時再計算。
- **測定値行は AVERAGE(J:N) のまま**（水温/PH/透視度/SV/MLSS 等は無変更）。
- 運転管理月報 K/M（`fillProratedFlowDiff`）と同じ「累積差÷日数」の考え方。`fillProratedFlowDiff` 本体は無変更。

### 適用例（returnSludge 第1週 R10, dateRow R3）
```
O10 = IFERROR(
  (LOOKUP(2,1/(I10:N10<>""),I10:N10) - INDEX(I10:N10,MATCH(TRUE,INDEX((I10:N10<>""),0),0)))
  / (LOOKUP(2,1/(I10:N10<>""),I3:N3) - INDEX(I3:N3,MATCH(TRUE,INDEX((I10:N10<>""),0),0))), "")
```

---

## Part 2 — 電気設備 出力の空欄に「-」（機械と同パターン）

### 事前調査
- 機械: `writeMechEmptyCell(ws,row,col,key,val,date)`＝**祝日(holidaySet)→空欄 / 非祝日の空欄→`getMechEmptyValue`**（`MECH_AUTO_DASH_KEYS` のキーは「-」、numFmt="@"）。日基準は**対象月の平日列（mon-fri）でその day オブジェクトが存在する列**＝実測の有無に依らず非祝日平日列に「-」。
- 電気 `fillElecSheet`: 従来は空セルを `setCell`(空値スキップ)で**空欄のまま**。

### 修正（基準を報告明記）
- **`writeElecEmptyCell(ws,row,col,date)` を新設**: 祝日→空欄 / 非祝日の空欄→「-」(U+002D, numFmt="@")。機械と同一の日基準。
- **対象＝点検グリッド全セル（OFFSETS 全キー＋積算読み44/48/52）**。電気には機械の**常用機選択(*Select)のような対象外キーが無い**ため、機械の「全フィールド(常用機選択除く)」に対応して**電気は全グリッドが対象**（外観/指示状況/各読み/モード/切入 等）。ヘッダ・点検者氏名(base+33)・点検内容(base+34 日付) は OFFSETS 外のため**対象外**（不変）。
- **積算読み(返送=44/余剰=48/放流=52)**: 日常水質 `returnSludge`/`excessSludge`/`discharge`（運転管理月報 J/L/N と同一源泉）に値があればその値、無ければ本ルール（非祝日=「-」／祝日=空欄）。点検者氏名/点検内容/実測日判定(`hasElecData`)は不変。

---

## Part 3 — 前日コピーを「データのある日まで遡る」

### 事前調査・結論（既に実装済・変更不要）
- 全タブの前日コピーは `findPrevDayWithData(sheetType, week, dayIdx, daysArr)` を使用（水質コピー/テーブル一括/列←ボタン とも）。
- 同関数は**現在日より前を1日ずつ遡り、週を跨いで（i<0→週−1, w≥1）データのある最も近い日を返す**実装で、**初期コミット(v1)から存在**。無ければ `null`（空コピーしない）。
- 「データ有無」判定は `getWaterDayPercent`/`getElecDayPercent` 等＝`ALL_FIELDS`/`ALL_*_KEYS`（**積算/流量を含む**）の非空カウント。よって**積算/流量のみの日も検出**。
- 遡り範囲＝**現在月内（週1まで）**。指示の「週内→必要なら前週/月内」に合致。
- → 機能要件は既存で満たされており**コード変更不要**。検証で動作確認した（下記）。

> Part2 直前フェーズで `COPY_FIELDS` に積算/流量追加済・inspector/bikou 除外。コピー値は文字列保持（末尾0）整合。全タブ統一挙動。

---

## 検証（ExcelJS / 関数抽出テスト）

### Part 1（fillWaterSheet を実テンプレに適用）
- 積算 O10(returnSludge)＝**按分式**（LOOKUP+INDEX-MATCH、AVERisEMPTYでない）。値域 `I10:N10`・日付域 `I3:N3` を正しく参照。round-trip 永続。
- 測定 O16(tempIn)＝`IFERROR(AVERAGE(J16:N16),"")`（**AVERAGE 維持**）。
- 按分の数値検証: I=100@5/4, 最後=130@5/8 → (130−100)/(8−4=4日)=**7.5**（平均日量、丸めなし）。✓

### Part 2（fillElecSheet を実テンプレに適用、祝日=5/4-6, 実測=木金）
- 値あり: voltage 木/金=6.6。空欄(非祝日): currentMode 木=「-」。祝日: voltage/currentMode 水=空欄。
- 積算: returnSludge 木=871310・金=871658（日常水質値）、水(祝日)=空欄、excess 木(水質値無・非祝日)=「-」。✓

### Part 3（findPrevDayWithData）
- 週2金→週2水(データ)を発見、週2火→週跨ぎで週1月(積算のみデータ)を発見、`getWaterDayPercent(週1月)>0`、週1月で先行データ無→`null`（空コピーなし）。✓

### Excel 回帰
- `git diff`: 変更は `writeElecEmptyCell` 追加・`fillWaterSheet` の O 数式・`fillElecSheet` 空セル処理のみ。**`fillMechSheet`/`fillProratedFlowDiff`(K/M按分)/`fillKakeOperationReportSheet`/水質管理報告/`findPrevDayWithData` は untouched**。
- 機械モード「-」・点検者・末尾0保持・運転管理月報 K/M按分 すべて不変。O列(平均)は水質シート内の表示で他シート非参照のため Part1 変更の波及なし。
- `node --check`（主 `<script>` 抽出）**PASS**。GAS/SS 無変更。

---

## 規約遵守
- 按分は読み値ベース・**四捨五入禁止**（K/M と整合）。
- 空欄「-」は U+002D・numFmt="@"、祝日は空欄（機械と同基準）。電気は常用機選択相当が無いため全グリッド対象。
- 前日コピーは inspector/bikou 除外・文字列保持（末尾0）整合、全タブ統一（既存）。
- ExcelJS: 数式 `{formula:}`+`fullCalcOnLoad`、テンプレ base64 無編集、既存ロジック（K/M按分・点検者・モード「-」）不変。

## 最終 HEAD
- 実装コミット: **`110bf16e58a524762c98de5d0d8e4f4285354fa1`**（短縮 `110bf16`）。`index.html`（Part1 積算按分O式／Part2 writeElecEmptyCell＋電気空セル「-」／Part3 変更なし）+ `sw.js`（v49→v50）。
- 本報告のハッシュ追記は後続コミットで push（repo 先頭はその追記コミット）。

## 次フェーズ
- Yamane 実機確認（Clear site data → ハードリロード sw v50 → 積算平均=平均日量・電気空欄「-」/祝日空欄・前日コピー遡り・Excel 一致 を目視）。
- OK 後: 報告系2タブ撤去、MLDO 5月分、または測定者UI横展開 shiwagi（テンプレ `cd653ff`）。
</content>
