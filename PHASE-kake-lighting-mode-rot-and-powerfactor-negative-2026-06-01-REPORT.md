# 報告: kake ①照明モードのトグルを RST→ROT ＋ ②力率でマイナス値入力を可能に

**実施日**: 2026-06-01
**対象**: cpkanri/kake `index.html`（UI/JS）+ `sw.js`（v50→v51）
**GAS/SS**: 無変更 / **clasp**: 不要（push のみ）
**前提 HEAD**: コード `110bf16`（sw `kake-v50`）

---

## Part 1 — 照明モードのトグル選択肢を RST → ROT

### 事前調査
- `ELEC_SECTIONS`「低圧分岐」の **照明モード** = `lightMode`、現状 `options: ["R","S","T"]`。
- 取り違え注意の他モード（**変更しない**）:
  - `voltageMode`（電圧モード）`["RS","ST","TR"]`
  - `currentMode`（電流モード）`["R","S","T"]`
  - `voltage210Mode`（動力210V電圧モード）`["RS","ST","TR"]`
  - `current210Mode`（動力210V電流モード）`["R","S","T"]`
  - ※ `currentMode`/`current210Mode` も `["R","S","T"]` のため、**一括置換は不可**。`lightMode` 行のみピンポイント変更。

### 修正
- `lightMode` の options を **`["R","S","T"]` → `["R","O","T"]`**（中央 S→O）。トグルのサイクル/初期/空欄挙動は不変。
- Excel 出力: トグル選択値は `setCell` がそのまま書込（`"O"` → 文字列 `"O"`）。**出力ロジック無改修で反映**。空欄は前フェーズの電気「-」ルール（非祝日=「-」/祝日=空欄）。
- 既存保存データに `"S"` が残っても新選択は R/O/T（移行不要・orphan 無害）。

---

## Part 2 — 力率(ψ) でマイナス値（例 -0.78）を入力可能に

### 事前調査（なぜ負数が入力不可か）
- 力率 `powerFactor`（type:number, step 0.01, **dashSupport:true**）は `<input type="text" inputmode="decimal" data-elec-mech-numeric="1">` で描画。
- **バリデーションは元から負数を受理**: `isValidElecMechValue` の正規表現 `/^-?\d*\.?\d*$/`（先頭 `-?` を許容）。`normalizeElecMechValue` は全角マイナス `−`/`ー` を `-` に正規化。実測テスト: `"-0.78"`/`"-0"`/`"-"`/`"−0.78"`/`"ー"` すべて valid=true。
- **真因 = ソフトキーボード**: `inputmode="decimal"` の数値キーパッド（タブレット）には**マイナスキーが無く負号を物理的に打てない**ため「入力不可」になっていた（バリデーション/min ではない。dashSupport text input に min 制約も無し）。

### 修正
- `powerFactor` に **`allowNegative: true`** を付与。
- `buildElecTable` の dashSupport 入力描画で、`allowNegative` のときのみ **`inputmode="decimal"` → `inputmode="text"`** に切替（フルキーボードで `-` を入力可能に）。他の dashSupport は `decimal` のまま。
- **"-" 単独 と "-0.78" の区別**: バリデーションは `"-"` 単独を許容（ダッシュ）、`"-"`+数字を負数として許容（両方有効）。`setCell` は `"-0.78"`→`-0.78`（number）、`"-"`→`"-"`（文字列＝ダッシュ）、`"-0"`→`0`。
- **文字列保持（前フェーズ）と整合**: `-0.78` は入力通り保持・表示（符号・末尾0も保持）。同期は preserve-guard で数値的同一なら文字列維持。
- **影響は力率のみ**: `allowNegative` は powerFactor だけに付与（他 dashSupport/数値フィールドの非負前提・キーボードは不変）。

---

## 検証

### Part 1
- `lightMode.options === ["R","O","T"]`。`currentMode`/`current210Mode` は `["R","S","T"]` のまま、`voltageMode`/`voltage210Mode` は `["RS","ST","TR"]` のまま。✓

### Part 2
- `powerFactor.allowNegative === true`、`dashSupport` 維持。**allowNegative を持つのは powerFactor のみ**。✓
- `isValidElecMechValue("-0.78") === true`。✓
- `setCell("-0.78")` → **-0.78（number）**、`setCell("-")` → **"-"（文字列・ダッシュ）**、`setCell("-0")` → **0**。✓ → Excel に負数が number で書込（numFmt 表示）。
- `buildElecTable` 描画ロジック: `f.allowNegative ? "text" : "decimal"` → powerFactor のみ `inputmode="text"`（負号入力可）、他は `decimal` のまま。

### その他
- [x] `node --check`（主 `<script>` 抽出）**PASS**。
- [x] 変更は照明モード/力率に限定（diff: lightMode options・powerFactor フラグ・buildElecTable の inputmode 三項のみ）。他項目・Excel他出力・K/M按分・点検者・末尾0保持・電気「-」・積算按分 は不変。
- [x] GAS/SS 無変更。sw `kake-v50`→`kake-v51`。

---

## 規約遵守
- 変更は照明モード/力率に限定、他フィールド・Excel他出力・K/M按分・点検者・末尾0保持は不変。
- 文字列保持（入力通り・符号/末尾0保持）と整合。`"-"` 単独はダッシュ。
- ExcelJS 出力は number＋numFmt（`setCell` の Number 化が負数を正しく扱う）、テンプレ base64 無編集。

## 最終 HEAD
- 実装コミット: **`da94dbf4daccf7c56bb26e3d13be21411e8b3e00`**（短縮 `da94dbf`）。`index.html`（lightMode ROT・powerFactor allowNegative・buildElecTable inputmode）+ `sw.js`（v50→v51）。
- 本報告のハッシュ追記は後続コミットで push（repo 先頭はその追記コミット）。

## 次フェーズ
- Yamane 実機確認（sw v51）: 前バッチ（積算平均=平均日量・電気空欄「-」・前日コピー遡り）＋本2点（照明 R/O/T・力率マイナス入力＝タブレットで `-0.78` が打てる）をまとめて目視。
- OK 後: 報告系2タブ撤去、MLDO 5月分、または測定者UI横展開 shiwagi（テンプレ `cd653ff`）。
</content>
