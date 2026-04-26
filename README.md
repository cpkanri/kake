# 加計浄化センター 週報入力アプリ

加計浄化センターの日常水質・機器運転時間・電気設備・機械設備を週単位で入力し、月次の Excel 記録表として出力するための PWA (Progressive Web App)。

公開 URL: <https://cpkanri.github.io/kake/>

## 概要

- スマートフォン (iOS / Android) のブラウザから利用、ホーム画面追加で PWA としてインストール可能
- 入力データは端末の localStorage (`kake_*` キー) と Google スプレッドシート (GAS バックエンド) の両方に保存
- 月末に「Excel 出力」ボタンで `加計浄化センター記録表_YYYY-MM.xlsx` を生成
- 水質管理報告・運転管理月報の数式が自動計算され、INDEX/MATCH で月毎の値が反映される

## タブ構成

| タブ | 内容 | 項目数 |
|---|---|---|
| 日常水質 | 水温・PH・透視度・SV・MLSS 等 (流入/ディッチ/終沈/放流) | 約25 |
| 機器運転時間 | 21機器の月〜金の運転時間 (hr) | 21 |
| 電気設備 | 引込・受電 / 変圧器 / 低圧分岐 / 計装 / 発電機 / 通報 | 62 |
| 機械設備 | ポンプ井 / 各種ポンプ・ブロワ・ファン・ダンパ等 | 109 |

## 利用方法

1. <https://cpkanri.github.io/kake/> にアクセス
2. 配布された ID / パスワードでログイン
3. ヘッダーで対象月を選択し、各週タブで日々のデータを入力
4. 月末に「Excel 出力」ボタンで月次記録表をダウンロード
5. GAS の MLDO 計算ボタン (スプレッドシート側) で MLDO 値を自動計算 → 水質管理報告 N 列に反映

## ファイル構成

```
.
├── index.html               # 本体 (HTML + CSS + JS)
├── manifest.json            # PWA マニフェスト
├── sw.js                    # Service Worker (ネットワークファースト・オフライン対応)
├── template.js              # Excel テンプレート (base64 化された xlsx)
├── icon-192.png             # PWA アイコン (192×192)
├── icon-512.png             # PWA アイコン (512×512)
├── kake_gscode.txt          # GAS バックエンド ソース (参考用、Apps Script へペースト)
├── 加計浄化センター_template.xlsx  # Excel テンプレート原本 (template.js 再生成用)
├── 加計アプリ実装チェックリスト.md  # 実装チェックリスト (上殿ベース)
└── 加計実装結果_summary.md   # 実装サマリ
```

## 開発

### Excel テンプレート更新時

```bash
python -c "
import base64
with open('加計浄化センター_template.xlsx','rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')
with open('template.js','w') as o:
    o.write('window.EXCEL_TEMPLATE_B64 = \"' + b64 + '\";\n')
"
```

### Service Worker のキャッシュ更新

`sw.js` の `CACHE_NAME` (例: `kake-v1` → `kake-v2`) をインクリメントすると、
PWA を開き直したときに新しい資産がフェッチされる。

### GAS バックエンド更新

`kake_gscode.txt` を編集 → Apps Script エディタにペースト → 新しいバージョンとして再デプロイ
→ `index.html` の `GAS_URL` を新 URL に置換 (デプロイ URL を変えない設定であれば不要)。

## 関連リポジトリ

ベース実装: 上殿浄化センター週報アプリ (`kamitono`)。本リポジトリは上殿の構造を加計のテンプレート (1ブロック行数・項目数・MLDO 書込位置) に合わせて再構成したもの。

## メンテナー

cpkanri
