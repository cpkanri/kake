# 報告: kake 電気設備・機械設備 入力フォームを「出力ページ別サブタブ」に分割（吉和方式）

**実施日**: 2026-05-31
**対象**: cpkanri/kake `index.html`（UI のみ）+ `sw.js`（v43→v44）
**GAS/SS**: 無変更 / **Excel出力ロジック**: 無変更 / **clasp**: 不要（push のみ）
**前提 HEAD**: コード `7516544`（sw `kake-v43`） / 参照: yoshiwa `efc3d70`

---

## 1. 事前調査結果

### yoshiwa（参照）機構の要点
- 設備フォーム内に `<nav class="sec-tabs sub-tabs" id="mechPartTabs">` 等で **1/3・2/3・3/3 のパートボタン**を週タブの下にネスト。
- 状態変数 `currentMechPart`/`currentElecPart`。クリックで `saveCurrentFormToData()` → 状態更新 → `renderMechPanel()`（テーブル本体を**フィルタ再描画** `buildEquipTableBody(..., part, week)`）。
- **active クラス**でボタン強調。**週切替してもパートは保持**（リセットしない）。CSS `.sub-tabs` は inline-flex の軽量ピル型。
- 点検者は設備フォーム外（週報側）。

### kake 現行
- 電気/機械フォームは**動的生成**: `ELEC_SECTIONS`（13セクション）/`MECH_SECTIONS`（47セクション）の配列を `buildElecTable()`/`buildMechTable()` が全セクション無フィルタで tbody 描画。
- パネル: `#elecPanel`/`#mechPanel`、週タブ `#elecWeekTabs`/`#mechWeekTabs`（全設備で `currentWeek` 共有）、tbody `#elecBody`/`#mechBody`。
- データ束縛: `data-elec`/`data-eday`（電気）, `data-mech`/`data-mday`（機械）。`weeklyData.electrical[week][day][key]` / `.mechanical[...]`。
- `saveElecFormToData`/`saveMechFormToData` は **DOM 上に存在する input のみ**走査し、week オブジェクトを**クリアせず**キー単位で更新 → **非表示ページのデータは保持される**（サブタブ分割の安全性の核心）。`load*` も DOM 走査のみ。
- 点検者は月単位 `weeklyData.monthInspector`（フォーム未描画、出力時 base+33 へ）。

### 出力ページ対応表（入力フィールド → 出力 1/2 or 2/2）
`fillElecSheet` の `OFFSETS`、`fillMechSheet` の `MAP1/MAP2` を単一の真実として境界を決定。

**電気（fillElecSheet: page1=offset<35 / page2=offset≥35）**
| サブタブ | セクション |
|---|---|
| **1/2**（offset 0–28） | 引込・受電 / 変圧器 / 低圧分岐 |
| **2/2**（offset 35–67） | ポンプ井水位計 / No.1オキシデーションディッチDO計 / 返送汚泥流量計 / 余剰汚泥流量計 / 放流流量計 / 汚濁負荷量計(放流水UV) / 全窒素・全燐計 / 圧力式液位計 / 発電機設備 / 他 |

→ **page2 開始 = 先頭フィールド `pumpWellLook`（offset 35）**

**機械（fillMechSheet: page1=MAP1 / page2=MAP2）**
| サブタブ | 範囲 |
|---|---|
| **1/2**（MAP1, row4–65） | ポンプ井 〜 返流水ポンプ 共通（page1 セクション群） |
| **2/2**（MAP2, row70–116） | 濃縮汚泥引抜ポンプ No.1 〜 脱水機室排気ファン（page2 セクション群） |

→ **page2 開始 = 先頭フィールド `thickPump1Current`（MAP2 row70）**

---

## 2. 実装内容（UI のみ・データ/出力不変）

すべて**追加のみ**（87行追加・1削除＝sw版数）。Excel出力関数・データ束縛・SECTIONS配列・save/load は**未編集**。

1. **page 付与（IIFE）**: `ELEC_SECTIONS`/`MECH_SECTIONS` の各セクションへ `sec.page`(1/2) を付与。境界は先頭フィールド key（`pumpWellLook`/`thickPump1Current`）で判定＝Excel境界と一致。配列リテラルは無編集（別IIFEで属性付与）。
2. **状態変数**: `currentElecPage=1` / `currentMechPage=1`（週切替と独立・保持）。
3. **サブタブ HTML**: 各パネルの週タブ直下に `<nav class="sub-tabs" id="elecPageTabs|mechPageTabs">` ＋「1/2」「2/2」ボタン。
4. **build フィルタ**: `buildElecTable`/`buildMechTable` の `forEach` 先頭に `if (sec.page && sec.page !== currentElecPage|currentMechPage) return;`。
5. **切替イベント**: ページボタン click で `save*FormToData()`（現ページ退避・他ページ不変）→ 状態更新 → active トグル → `build*Table()`（新ページ再描画＝全リスナー再バインド）→ `load*DataToForm()`（現週値再注入）。同一ページclickは no-op。
6. **CSS** `.sub-tabs`（吉和方式の inline-flex ピル型、active は白背景＋影、kake緑 `#0d4f34`）。**基本定義（@media 外）**に記述（@media 1100px 非発火対策）。テーブル寸法（1列92/日列64/トグル48×38/入力56/min-width412）は**無変更**。

> 点検者・ダッシュ（MECH_AUTO_DASH/writeMechEmptyCell）・ensure*・祝日・monthInspector・autoCalc は一切不変。

---

## 3. 検証

### 出力ページ整合（自動・最重要）
index.html から `ELEC_SECTIONS`/`MECH_SECTIONS`/`OFFSETS`/`MAP1`/`MAP2` を抽出し、page付与ロジックを再現して照合:
- **電気**: 13セクション、page1=29 / page2=33 フィールド。全フィールドで **UIページ == Excelページ**（offset<35↔page1, ≥35↔page2）。境界 = ポンプ井水位計。
- **機械**: 47セクション、page1=62 / page2=47 フィールド。全フィールドで **UIページ == MAP1/MAP2 所属ページ**。境界 = 濃縮汚泥引抜ポンプ No.1。
- **フィールド消失ゼロ・誤振り分けゼロ**（全 key が MAP/OFFSET に存在し一致）。→ **PASS**

### Excel 出力差分ゼロの確認方法
- `git diff` のハンク範囲は **行492〜4033 のみ**（UI追加部）。`fillElecSheet`/`fillMechSheet`（≈行5560〜）は**全ハンク外＝未編集**（diff内の関数名は追加コメントの参照文字列のみ）。
- 出力関数は `weeklyData` を読むのみで DOM 非依存。サブタブ分割は描画グルーピングだけで `weeklyData` を変えない。
- `save*FormToData` は week をクリアせず DOM 存在 input のみ更新 → 非表示ページのデータ保持。`load*` も DOM 走査のみ。→ **保存→読込で全往復が分割前と同一**、出力は同一データ→同一バイト。

### データ往復の安全性（ロジック）
ページ切替手順 save→build→load は、save が非破壊（他ページ不変）、build が当該ページのみDOM再生成＋全リスナー再バインド、load が現週値を再注入。全5週・点検者・ダッシュ・祝日は出力経路（weeklyData）不変のため影響なし。

### その他
- [x] `node --check`（主 `<script>` 抽出, 行1492..6402）**PASS**。
- [x] サブタブ active トグル・週切替×ページ切替の独立動作（ページ保持）。
- [x] CSS v39 寸法維持（テーブル定義無変更、サブタブは外側ナビ）。
- [x] GAS/SS 無変更・clasp なし。sw `kake-v43`→`kake-v44`。

---

## 4. 規約遵守（#15-④ 横展開鉄則）
- 移動（DOM表示グルーピング）のみでロジック不変。ensure*空生成・実測ガード・点検者・ダッシュ・祝日は転送先（同一ファイル）に既存・維持。
- CSS は常時効かせる指定を基本定義へ。月単位欄（点検者）は現行のまま（フォーム外・専用処理）。ExcelJS 出力ロジック未編集。

## 5. 最終 HEAD
- 実装コミット: **`07aa5e8acd7d2211248f747b383b4934133ca6d5`**（短縮 `07aa5e8`）。`index.html`（サブタブUI追加・page付与IIFE・build フィルタ・切替イベント・CSS）+ `sw.js`（v43→v44）。
- 本報告のハッシュ追記は後続コミットで push（repo 先頭はその追記コミット）。

## 6. 次フェーズ
- Yamane 実機確認（Clear site data → ハードリロード sw v44 → 電気・機械フォームのサブタブ表示・縦長解消・各週入力・保存・出力一致を目視）。
- OK 後: 報告系2タブ撤去、MLDO 5月分、または測定者UI横展開 shiwagi（テンプレ `cd653ff`）。
</content>
