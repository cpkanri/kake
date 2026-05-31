# 報告: kake 「戻す」ボタンが日常水質以外のタブで機能しないバグ修正

**実施日**: 2026-05-31
**対象**: cpkanri/kake `index.html`（UI/JS）+ `sw.js`（v45→v46）
**GAS/SS**: 無変更 / **clasp**: 不要（push のみ）
**前提 HEAD**: コード `b1405f0`（sw `kake-v45`）

---

## 1. 事前調査結果

### 「戻す」(Undo) の機構
- ボタン: `#btnUndo`（`<button class="btn-undo" id="btnUndo" disabled>↩ 戻す</button>`）。初期 disabled。
- `undoStack`（最大 `UNDO_MAX=50`）に1編集ごとの差分エントリを push。エントリ形式:
  `{ sheet:"water|equip|elec|mech", week, day, field/equipKey, oldValue, newValue }`。
- **記録**: input の `focus` で旧値を捕捉、`change` で旧≠新なら `pushUndo()`。
  - `attachUndoToWaterInputs()` … `[data-field]`（日常水質、**静的HTML**）。
  - `attachUndoToTableInputs()` … `[data-equip]` / `#elecTable input[data-elec]` / `#mechTable input[data-mech]`（**動的生成テーブル**）。
- **復元**: `#btnUndo` click → `undoStack.pop()` → `weeklyData[...]=oldValue` → 現在タブ一致時に該当 `load*DataToForm()` で再描画。**この復元ハンドラは4シート全対応で正しい**。

### 状態管理
- 現在タブ `currentSheet`、週 `currentWeek`、電気/機械サブタブ `currentElecPage`/`currentMechPage`。
- 動的テーブル生成: `buildElecTable()` / `buildMechTable()`（init＋サブタブ切替で `tbody.innerHTML=""` 再生成）、`renderEquipTableRows()`（continueInit で1回、`dataset.rendered` ガード）。

### 他タブで効かなかった**真因**（最重要）
- `init()` は **async** で、冒頭 `await verifyStoredToken()` で制御を呼び出し元へ返す。
- トップレベルでは `init();` の直後に `attachUndoToWaterInputs(); attachUndoToTableInputs();` が**同期実行**される。しかしテーブル生成（`renderEquipTableRows`/`bindEvents→buildElecTable/buildMechTable`）は **await 解決後の `continueInit()` 内**で初めて走る。
- 結果、`attachUndoToTableInputs()` 実行時点で **equip/elec/mech の input はまだ DOM に存在せず**、`querySelectorAll` が空 → **undo 記録リスナーが一切付与されない**。
- 一方 **日常水質の input は静的HTML**で実行時点で存在 → 付与済 → **水質だけ機能**。
- 追加要因: サブタブ分割(前フェーズ)で `buildElecTable/buildMechTable` が再生成すると input が差し替わり、（仮に付いていても）リスナーが失われる。

→ 「水質は効くが、機器運転時間・電気・機械では効かない」症状と完全一致。

---

## 2. 修正内容（最小・追加のみ 8行）

各テーブル生成関数の**末尾**で `attachUndoToTableInputs()` を呼び、**生成のたびに新規 input へ undo リスナーを再付与**（`el._undoAttached` ガードで冪等）:

- `renderEquipTableRows()` 末尾 … 機器運転時間（continueInit 生成時に付与）。
- `buildElecTable()` 末尾 … 電気（init＋サブタブ 1/2↔2/2 切替の再生成ごとに付与）。
- `buildMechTable()` 末尾 … 機械（同上）。

```js
if (typeof attachUndoToTableInputs === "function") attachUndoToTableInputs();
```

- これにより async 認証 await 後に生成されるテーブルにも確実に付与され、サブタブ再生成でも新 input に再付与される。
- **undo 復元ハンドラ・データ束縛・save/load・Excel出力は無変更**。復元後は現在タブの `load*DataToForm()` が走り、`currentElecPage`/`currentMechPage`/`currentWeek` を保持したまま現ページのみ再注入（サブタブ・週が保持される）。
- 直近変更との整合: 電気サブタブ分割・積算読み3キー削除後も、undo は実在 input のみ対象（削除キーは DOM に無く参照されない）。save/load は DOM 走査・非破壊のまま。

---

## 3. 検証（jsdom 機能テスト ＋ node --check）

index.html から `pushUndo`/`updateUndoBtn`/`attachUndoToTableInputs`/`attachUndoToWaterInputs` と **戻す click ハンドラ本体**をブレースマッチ抽出し、jsdom で動的テーブル(elec)を再現:

- ✓ `attachUndoToTableInputs()` 後、動的 input に `_undoAttached` 付与。
- ✓ focus→値変更→change で `undoStack` に1件 push、`#btnUndo` 有効化。
- ✓ 「戻す」click で `weeklyData` が旧値に復元、`loadElecDataToForm` で input が旧値へ再描画、stack 空、ボタン再 disabled、トースト表示。
- ✓ **サブタブ再生成の再現**: `tbody.innerHTML` 差替で新 input は未付与（=バグ再現）→ `attachUndoToTableInputs()` 再呼び出し（＝本修正）で付与され、再生成 input でも undo 記録される。
- 全 12 アサーション **ALL PASS**。

その他:
- [x] `node --check`（主 `<script>` 抽出）**PASS**。
- [x] 復元ハンドラは4シート対応（既存・無変更）→ 全タブで pop→restore→再描画。
- [x] 復元後にサブタブ/週保持（current* を変更しない）。
- [x] 日常水質の従来挙動は無変更（静的 input の付与経路はそのまま）。
- [x] 差分は index.html 3ハンク（各 build 関数末尾の1行）＋ sw.js のみ。データ/出力/保存ロジック不変。

### 各タブ期待動作（実機確認は次フェーズ）
| タブ | 記録経路 | 修正後 |
|---|---|---|
| 日常水質 | 静的 `[data-field]`（従来から付与） | 維持 |
| 機器運転時間 | `renderEquipTableRows` 末尾で付与 | 機能 |
| 電気設備 | `buildElecTable` 末尾で付与（1/2・2/2 再生成ごと） | 機能 |
| 機械設備 | `buildMechTable` 末尾で付与（1/2・2/2 再生成ごと） | 機能 |

---

## 4. 規約遵守
- 横展開の鉄則(#15-④): 水質の前提（記録リスナー付与）が他タブでも成立するよう、動的生成タイミングに合わせて付与点を是正。
- 電気・機械は復元後に `currentElecPage`/`currentMechPage`・`currentWeek` を保持。
- save/load は DOM 走査・非破壊を維持。ExcelJS 出力ロジックは無変更。

## 5. 最終 HEAD
- 実装コミット: **`8eadcf08f15d4c1d1fdee7fd7405ae3f3950b01c`**（短縮 `8eadcf0`）。`index.html`（build 3関数末尾に undo 再付与）+ `sw.js`（v45→v46）。
- 本報告のハッシュ追記は後続コミットで push（repo 先頭はその追記コミット）。

## 6. 次フェーズ
- Yamane 実機確認（Clear site data → ハードリロード sw v46 → 全4タブで「戻す」動作、電気/機械はサブタブ 1/2・2/2 両方・全5週、タブ往復でのデータ非巻込みを目視）。
- OK 後: 報告系2タブ撤去、MLDO 5月分、または測定者UI横展開 shiwagi（テンプレ `cd653ff`）。
</content>
