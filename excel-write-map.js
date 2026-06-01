/**
 * EXCEL_WRITE_MAP for kake (加計浄化センター)
 * Phase 38-b2 (yoshiwa Phase 38-b1 reference の横展開)
 *
 * kake 固有設計判断 (yoshiwa との差異):
 *  - section: null 一律 (kake は ALL_FIELDS フラット構造)
 *  - cumulative/average/allow_on_holiday/dashSupport 属性なし (kake 元データに対応概念なし)
 *  - MLDO 不含 (サーバー GAS 計算 + 直書き、クライアント責務外)
 *  - storage_unit='region' 不在 (kake には aeration/mlss_return 相当なし)
 *
 * entry 数: 30 (= ALL_FIELDS) ※ chlorineDose 追加 (塩素投入量 R37、_daily(33))
 *  - 25 daily (ITEM_OFFSETS と一致、日常水質シート書込)
 *  - 3 monthly (終沈 tempFinal/transFinal/phFinal、水質管理報告シート書込、null_skip=true)
 *  - 2 metadata (inspector/bikou、別経路書込、b2 では documentation only)
 *
 * 検証: ALL_FIELDS ↔ EXCEL_WRITE_MAP 双方向一致、NULL_SKIP_KEYS_DIRECT 期待値一致、
 *       終沈 3 キー monthly.col 存在
 * ITEM_OFFSETS との値一致検証は b2+ Step 3 (MAP 移行) 後に追加予定
 */
(function() {
  'use strict';

  // ========================================================================
  // SHEETS 定数 (kake は同 workbook に 7 シート、本 MAP では 4 シートを定義)
  // ========================================================================
  const SHEETS = {
    DAILY_WATER:        '日常水質',         // fillWaterSheet 対象
    MONTHLY_REPORT:     '水質管理報告',     // fillReportFinalData 対象 (yoshiwa は「、新」付き)
    MONTHLY_OPERATION:  '運転管理月報',     // fillKakeOperationReportSheet 対象 (b2 では entry なし、b2+ Step 5 候補)
    HOLIDAYS:           '祝日リスト'        // 読込のみ (書込なし)
    // 注: '日常機械設備'/'日常電気設備'/'機器運転時間' は Phase 38-c 候補 (機器/電気/機械フィールド統合)
  };

  // ========================================================================
  // shorthand helper (内部用、entry 定義の可読性向上)
  // ========================================================================
  function _daily(row_offset) {
    return { sheet: SHEETS.DAILY_WATER, row_offset: row_offset };
  }
  function _monthly(col) {
    return { sheet: SHEETS.MONTHLY_REPORT, col: col };
  }
  function _entry(daily, monthly, null_skip) {
    return {
      storage_unit: 'key',
      section: null,
      daily: daily,
      monthly: monthly,
      null_skip: !!null_skip
    };
  }

  // ========================================================================
  // EXCEL_WRITE_MAP 本体
  // ========================================================================
  const EXCEL_WRITE_MAP = {
    // ----- 電力 (4): row 0-3 -----
    power200v:      _entry(_daily(0),  null, false),
    power100v:      _entry(_daily(1),  null, false),
    reactivePower:  _entry(_daily(2),  null, false),
    demand:         _entry(_daily(3),  null, false),

    // ----- 水量 (2): row 4-5 -----
    water:          _entry(_daily(4),  null, false),
    diesel:         _entry(_daily(5),  null, false),

    // ----- 汚泥/流量 (3): row 6-8 -----
    returnSludge:   _entry(_daily(6),  null, false),
    excessSludge:   _entry(_daily(7),  null, false),
    discharge:      _entry(_daily(8),  null, false),

    // ----- 水温 (3): row 12-14 (row 9-11 はギャップ) -----
    tempIn:         _entry(_daily(12), null, false),
    tempDitch:      _entry(_daily(13), null, false),
    tempOut:        _entry(_daily(14), null, false),

    // ----- 透視度 (2): row 18-19 (row 15-17 はギャップ) -----
    transIn:        _entry(_daily(18), null, false),
    transOut:       _entry(_daily(19), null, false),

    // ----- PH (3): row 23-25 (row 20-22 はギャップ) -----
    phIn:           _entry(_daily(23), null, false),
    phDitch:        _entry(_daily(24), null, false),
    phOut:          _entry(_daily(25), null, false),

    // ----- SV (4): row 26-29 -----
    sv10:           _entry(_daily(26), null, false),
    sv20:           _entry(_daily(27), null, false),
    sv30:           _entry(_daily(28), null, false),
    sv24h:          _entry(_daily(29), null, false),

    // ----- MLSS/汚泥界面/塩素 (3): row 30-32 -----
    mlss:           _entry(_daily(30), null, false),
    sludgeLevel:    _entry(_daily(31), null, false),
    chlorine:       _entry(_daily(32), null, false),
    chlorineDose:   _entry(_daily(33), null, false),

    // ----- 終沈 (3): 月一書込、Phase 23-B-1 null skip 適用 -----
    // FINAL_COLS = { tempFinal:5(E), phFinal:9(I), transFinal:12(L) } (fillReportFinalData 由来)
    tempFinal:      _entry(null, _monthly(5),  true),   // E列
    phFinal:        _entry(null, _monthly(9),  true),   // I列
    transFinal:     _entry(null, _monthly(12), true),   // L列

    // ----- メタ (2): 別経路書込、b2 では documentation only -----
    // inspector: fillWaterSheet 内 L4828 で点検者名書込 (TODO: b2+ で MAP 化)
    // bikou: fillWaterSheet 内 L4838 で備考書込 (TODO: b2+ で MAP 化)
    inspector:      _entry(null, null, false),
    bikou:          _entry(null, null, false)
  };

  // ========================================================================
  // NULL_SKIP_KEYS_DIRECT 動的算出
  // ========================================================================
  const NULL_SKIP_KEYS_DIRECT = Object.keys(EXCEL_WRITE_MAP).filter(function(k) {
    const e = EXCEL_WRITE_MAP[k];
    return e.storage_unit === 'key' && e.daily === null && e.null_skip === true;
  });

  // ========================================================================
  // グローバル公開
  // ========================================================================
  window.EXCEL_WRITE_MAP = EXCEL_WRITE_MAP;
  window.EXCEL_WRITE_MAP_SHEETS = SHEETS;
  window.NULL_SKIP_KEYS_DIRECT = NULL_SKIP_KEYS_DIRECT;
  window.EXCEL_WRITE_MAP_NULL_SKIP_KEYS_DIRECT = NULL_SKIP_KEYS_DIRECT;  // yoshiwa 互換 alias

  // ========================================================================
  // 起動時整合性検証
  // ========================================================================
  function verifyAgainstKakeFields() {
    if (typeof ALL_FIELDS === 'undefined') {
      console.warn('[EXCEL_WRITE_MAP verify] ALL_FIELDS 未定義、検証スキップ');
      return;
    }

    const issues = [];

    // 1. ALL_FIELDS の各キーが EXCEL_WRITE_MAP に存在するか
    ALL_FIELDS.forEach(function(id) {
      if (!EXCEL_WRITE_MAP[id]) {
        issues.push('[EXCEL_WRITE_MAP] ' + id + ' は ALL_FIELDS にあるが MAP 未登録');
      }
    });

    // 2. EXCEL_WRITE_MAP の各キーが ALL_FIELDS に存在するか
    Object.keys(EXCEL_WRITE_MAP).forEach(function(id) {
      if (ALL_FIELDS.indexOf(id) < 0) {
        issues.push('[EXCEL_WRITE_MAP] ' + id + ' は MAP にあるが ALL_FIELDS に未登録');
      }
    });

    // 3. NULL_SKIP_KEYS_DIRECT 期待値 (Phase 23-B-1 適用 3 キー) と一致
    const expected = ['tempFinal', 'transFinal', 'phFinal'].sort().join(',');
    const actual = NULL_SKIP_KEYS_DIRECT.slice().sort().join(',');
    if (expected !== actual) {
      issues.push('[NULL_SKIP_KEYS_DIRECT] 期待[' + expected + '] / 実際[' + actual + ']');
    }

    // 4. 終沈 3 キーは monthly.col 数値必須
    ['tempFinal', 'transFinal', 'phFinal'].forEach(function(id) {
      const entry = EXCEL_WRITE_MAP[id];
      if (!entry || !entry.monthly || typeof entry.monthly.col !== 'number') {
        issues.push('[EXCEL_WRITE_MAP] ' + id + ' monthly.col 未定義 (期待: 数値)');
      }
      if (entry && entry.daily !== null) {
        issues.push('[EXCEL_WRITE_MAP] ' + id + ' daily !== null (期待: null、Phase 23-B-1 null skip 対象)');
      }
    });

    // 5. 完了レポート
    if (issues.length === 0) {
      console.log('[EXCEL_WRITE_MAP verify] OK: ALL_FIELDS と完全一致 (NULL_SKIP_KEYS_DIRECT=' + JSON.stringify(NULL_SKIP_KEYS_DIRECT) + ')');
    } else {
      console.warn('[EXCEL_WRITE_MAP verify] 整合性問題 ' + issues.length + ' 件:');
      issues.forEach(function(msg) { console.warn('  ' + msg); });
    }
  }

  // DOMContentLoaded 後に実行 (ALL_FIELDS が読み込まれていることを保証)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verifyAgainstKakeFields);
  } else {
    setTimeout(verifyAgainstKakeFields, 0);
  }
})();
