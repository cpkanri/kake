# 加計浄化センター週報アプリ 実装サマリ

実装基準: `加計アプリ実装チェックリスト.md` (上殿ベース)
ベースリポジトリ: `C:\dev\kamitono-dev\` のソース一式
出力先: `C:\dev\kake-dev\`
テンプレート: `加計浄化センター_template.xlsx`

## 完了した変更

### Phase 1: 基盤
- `index.html`, `manifest.json`, `sw.js`, `template.js`, `icon-192/512.png` を上殿からコピー
- `kamitono_gscode.txt` → `kake_gscode.txt` にリネームコピー
- 上殿/uedono/kamitono の文字列を加計/kake に一括置換
  - title, h1, h2, manifest 各種, sw.js コメント, CACHE_NAME (`kamitono-v33` → `kake-v1`)
  - localStorage キー prefix: `uedono_*`/`kamitono_*` → `kake_*`
  - ログインフォーム属性 (`uid-kamitono-app` → `uid-kake-app`)
  - Excel ダウンロードファイル名 (`上殿浄化センター記録表_` → `加計浄化センター記録表_`)
  - manifest.json: start_url/scope `/kamitono/` → `/kake/`
- `template.js` を `加計浄化センター_template.xlsx` から base64 で再生成

### Phase 2: 日常水質タブ — 終沈データ書き込み
- `fillReportFinalData(wb, yyyy, mm)` を新規追加 (index.html)
- 各日付の `tempFinal`/`phFinal`/`transFinal` を 水質管理報告 1/2 ページの
  E列(終沈水温) / I列(終沈PH) / L列(終沈透視度) Row8-Row38 (Day1-31) に直接書き込み
- Excel 出力フローに統合 (fillEquipSheet 直前に呼び出し)

### Phase 3: 機器運転時間タブ
- `EQUIP_KEYS` 14項目 → 21項目 (加計仕様)
- `EQUIP_LABELS` 21項目を新規追加
- HTML テーブルを `<tbody id="equipTableBody">` で空にし、
  `renderEquipTableRows()` で動的生成（continueInit() から呼び出し）
- `fillEquipSheet`: WEEK_START / DATE_HEADER_ROW を加計用に変更
  - WEEK_START: `{1:7,2:36,3:65,4:94,5:123}` (1ブロック=29行間隔)
  - DATE_HEADER_ROW: `{1:3,2:32,3:61,4:90,5:119}`
- 日付ヘッダクリア用の行リスト `[3,32,61,90,119]` に更新

### Phase 4: 電気設備タブ
- `ELEC_SECTIONS` を加計の62フィールドに完全再定義
  - 引込・受電 / 変圧器 / 低圧分岐 (page 1, 29項目)
  - ポンプ井水位計 / DO計 / 返送・余剰・放流流量計 / UV / 全窒素全燐 / 圧力式液位計 / 発電機 / 通報装置 (page 2, 33項目)
- `fillElecSheet` の WEEK_START / DATE_HEADER_ROW / OFFSETS を加計用に置換
  - WEEK_START: `{1:3,2:74,3:145,4:216,5:287}` (1ブロック=71行間隔)
  - DATE_HEADER_ROW: `{1:2,2:73,3:144,4:215,5:286}`
- 日付ヘッダクリア用の行リスト `[2,73,144,215,286]` に更新

### Phase 5: 機械設備タブ
- `MECH_SECTIONS` を加計の **109フィールド (約47機器グループ)** に完全再定義
  - page 1: ポンプ井, 汚水ポンプ1/2/共通, スクリーンユニット, エアレーション装置1-1/1-2,
    曝気ブロワNo.1/2, 消泡装置, ディッチ堰/ゲート, 終沈汚泥掻寄機, スカムスキマー,
    返送汚泥ポンプ1-1/1-2/共通, 余剰汚泥ポンプ, 床排水ポンプ1/2/共通, 返流水ポンプ1/2/共通
  - page 2: 濃縮汚泥引抜ポンプ1/2/共通, 濃縮汚泥掻寄機, 濃縮スカムスキマー, 攪拌機,
    濃縮曝気ブロワ, 自動給水装置1/2/共通, 混和池BG, 塩素接触装置, 脱臭ファン,
    水処理用/汚泥処理用ダンパ, 吸着脱装置, 自家発室給排気ファン, 汚泥ポンプ室給排気ファン,
    脱水機室給排気ファン
- `fillMechSheet` を加計用に完全再定義
  - MECH_WEEK: `{1:{p1:0,p2:66}, 2:{p1:132,p2:198}, ...}` (1ブロック=132行)
  - MAP1 (62項目, page1 R4-R65 絶対行)
  - MAP2 (47項目, page2 R70-R116 絶対行 + `wk.p2 - 66` オフセット)
  - MECH_DATE_HEADER_ROWS: `{1:[3,69], 2:[135,201], 3:[267,333], 4:[399,465], 5:[531,597]}`
- 日付ヘッダクリア行リスト 加計用に更新

### Phase 6: GAS バックエンド (`kake_gscode.txt`)
- `EQUIP_NAMES` / `EQUIP_LABELS` 加計21項目に置換
- `EQUIP_WEEK_START` `{1:7,2:36,3:65,4:94,5:123}` に変更
- `ELEC_WEEK_START` `{1:3,2:74,3:145,4:216,5:287}` に変更
- `ELEC_OFFSETS` 加計62項目に再定義
- MLDO 書き込み位置を加計用に変更:
  - シート: 水質管理報告
  - 行: Row49 → **Row8** (Day1-31)
  - 列: G列 (7列目) → **N列 (14列目)**

## 整合性検証 (自動チェック完了)

- `EQUIP_KEYS` / `EQUIP_LABELS`: 各21項目 一致 ✓
- `ELEC_SECTIONS` (62 fields) ↔ `fillElecSheet OFFSETS` (62 keys): 完全一致 ✓
- `MECH_SECTIONS` (109 fields) ↔ `fillMechSheet MAP1+MAP2` (62+47=109 keys): 完全一致 ✓
- 重複キー: ELEC/MECH ともに無し ✓
- index.html インラインスクリプト構文チェック: PASS ✓

## 残タスク (ユーザー側で実施が必要)

### 1. 加計用 Google スプレッドシート / GAS のセットアップ
1. 加計用に新規スプレッドシート作成
2. `加計浄化センター_template.xlsx` の構造をシートとしてインポート
3. GAS プロジェクトを新規作成 (スプレッドシートにバインド)
4. `kake_gscode.txt` の内容をペースト
5. `setupHolidays()` を一度実行して祝日リストシートを生成
6. WebApp としてデプロイし、新しい GAS_URL を取得

### 2. GAS_URL の置換
`index.html` L1206 の `const GAS_URL = 'REPLACE_WITH_KAKE_GAS_URL';` を
取得した新 GAS URL に置換すること。

### 3. 動作確認チェックリスト (チェックリスト Section 8)
- アプリを GitHub Pages にデプロイ (`https://cpkanri.github.io/kake/`)
- ログイン画面表示
- 日常水質タブで全フィールド入力 → localStorage に kake_weekly_2026-XX のキーで保存
- 機器運転時間タブで21項目すべて表示・入力可能
- 電気設備タブで加計の項目構成（62フィールド、全窒素・全燐計あり）が表示
- 機械設備タブで加計の109フィールドが表示
- Excel出力 → 「加計浄化センター記録表_2026-XX.xlsx」
- ダウンロードしたExcelで以下を確認:
  - 日常水質シートに入力データが反映
  - 機器運転時間シート(1〜5週ブロック)にデータ反映
  - 日常電気設備シートにデータ反映
  - 日常機械設備シートにデータ反映
  - 運転管理月報シート: 数式自動計算 (#REF!/#N/A/#VALUE! 出ない)
  - 水質管理報告シート: E/I/L列 (終沈水温/PH/透視度) に直接書き込み確認
  - 水質管理報告シート: 数式自動計算
  - 12ヶ月どの月でも数式が正しく動作
- GAS の「MLDO計算ボタン」を押すと:
  - MLDOログシートに当月分が記録
  - 水質管理報告 N列 (Row8-Row38) に MLDO値が書き込み
  - 既存値があるセルは上書きされない (月1回ルール)

### 4. 追加実装 (オプショナル — チェックリスト 2-5/Phase 7)
- 外観・臭気の入力UI (水質管理報告 2/2 ページ)
- 運転管理月報の G/H/I 列 (固形塩素・脱水ケーキ等) の手動入力UI

## 留意点

- **EQUIP_KEYS の命名**: 加計は `*Hr` サフィックスで機器運転時間を区別
  (機械設備タブの `*Current`/`*Pressure` 等と名前空間が分離されている)
- **A6/A8 自動検出**: 加計テンプレートの A6/A8 セルには INDEX/MATCH の月初日自動検出式
  (6段階フォールバック)。GAS が Excel 出力時に 日常水質!P1 に対象月の1日を書き込む処理を上殿から流用。
- **「運転管理月報 新」 → 「運転管理月報」改名**: 上殿コードは既に「運転管理月報」を参照しているので問題なし。
