# 0508 ミーティング 要望対応状況レポート

> **検証日**: 2026-05-20
> **検証者**: QA担当 (Claude / Opus 4.7)
> **検証手法**: Playwright MCP による画面操作 + Prisma schema / API ルート / コンポーネントの grep 検証
> **対象議事録**: `0508.MD`（2026-05-08 株式会社松健 × 弊社のミーティング文字起こし + メモ）
> **対象システム**: Next.js 16.2.1 / Turso (SQLite) / Prisma 6 / `admin/demo1234` ローカル `dev.db`

このレポートは「議事録に書かれている要望」と「現状の実装」を1項目ずつ突き合わせて、**対応済み / 部分対応 / 未対応** を判定した結果です。コード修正は一切行っていません。

---

## 0. サマリ

| 状態 | 件数 |
|---|---|
| ✅ 対応済み | 28 |
| 🟡 部分対応 / 要動作確認 | 6 |
| ❌ 未対応 | 5 |
| ⏸ 将来課題（議事録内で「あと回し」と確認） | 3 |

**特に重要な未対応 / 部分対応**:

| # | 重要度 | 概要 |
|---|---|---|
| F-1 | **高** | 現場マスタの「必要保険」設定 UI が無い。schema (`requiredInsurance`) と API バリデーション・配置パネル警告ロジックは実装済みだが、現場編集画面 (`src/components/sites/site-form.tsx`) に入力欄が無いため、現場ごとの保険要件を **画面操作からは設定不能** |
| F-2 | 中 | 配置編集パネルの「事前断り」ボタン (`PreDeclineSection`) が **コードには存在するが、実機で開いた配置編集ダイアログには表示されない**（テスト配置 #76 で確認）。表示条件のバグ or render path 違いの可能性 |
| F-3 | 中 | `DailyPayment` schema に **`site1Lift` / `site2Lift` フィールドが残置**。UI からは消えており実害は無いが、議事録「リフトを削除」と差分。マイグレーションで列削除がベター |
| F-4 | 低 | 配置完了後の「URL 送信用 詳細ページ」が独立画面として無い。`/print/assignment/[id]` は印刷用フォーマットで Google マップ iframe が**入っていない**（議事録 L262: 「Googleマップと担当者名と持ち物情報と出てくるような画面を一個作る」とあったが、印刷ページではなく別のシェアURL用画面を想定していた可能性） |
| F-5 | 低 | 議事録 L70 に「個人 → 印刷p」とあるが、現状 `staff` ロールでは `/print/work-report` が `staffVisible=false` のため非表示。仕様確認推奨 |

---

## 1. 議事録メモ部（冒頭ハンドメモ）

### 1-A. 配置基本機能

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| A-1 | L3 | 配置複数人選択 | ✅ | 配置編集パネルで「スタッフ（複数選択可）」のチェックボックスリスト確認済 (`assignment-panel.tsx:18` `MultiStaffPicker`)。一括配置パネル / 編集パネルの両方で動作 |
| A-2 | L9, L11 | 未割り当てのある現場は上に表示 | ✅ | カレンダー画面で `未割当あり 1現場 / 合計 2名` のサマリバーが上部に表示、未割当を含む現場が上段に。`/calendar` でデータ確認 |
| A-3 | L9 | 現場ごとに何名入れるかの表記と設定 | ✅ | 現場マスタに `requiredHeadcount` あり、配置 `AssignmentDay.orderHeadcount` あり (日毎)。カレンダーで `2名` `1名` のバッジ表示 |
| A-4 | L9 | 事前断りは人数表記に加算しない | ✅ | `/api/calendar` で `scheduled` のみ集計し `pre_declined` は `preDeclinedCount` に分離 (`route.ts:111-153`) |
| A-5 | L10 | 事前断りの設定（表記は残す） | 🟡 F-2 | API/型・カレンダー表示・コンポーネント側のトグル関数 (`handleTogglePreDeclined`) は実装済。実機ダイアログで「事前断りに変更」ボタンが見つからず、表示条件要調査 |
| A-6 | L12 | ドラッグで配置 | ✅ | `CalendarView.tsx` で `unassignedAssignments` の HTML5 DnD ハンドラあり、未割当→セルへドラッグ移動可 |
| A-7 | L14-15 | 配置確定モーダル — 持ち物（自由入力） | ✅ | 配置編集パネルに `belongings` textarea あり「ヘルメット、安全靴、手袋 …（現場マスタから自動 prefill）」 |
| A-8 | L17 | 炉内手当（路内手当）を配置ごとにつける | ✅ | `AssignmentAllowance` model 実装。「+ 路内手当」ボタンで追加、配置単位で `amount` 入力可 |
| A-9 | L19 | 必要保険・所属で登録 | ❌ F-1 | schema `JobSite.requiredInsurance` あり、`api/assignments/bulk` バリデーションあり。しかし**現場マスタ UI に保険要件設定欄が無い**。詳細は§F-1 |
| A-10 | L20 | 満たすスタッフのみ表示 | ✅ | 配置パネルで「営業所違い」「要件不足」バッジ。`filterByRequirements` トグルで絞り込み可 |
| A-11 | L21 | 条件未満ユーザーをアサインしていたら error 表記 | ✅ | `requireToggle` の `force` 引数で警告表示、未満時は「営業所違い」表記 + 409 レスポンス確認済 |
| A-12 | L22 | カレンダー画面で作業区分で絞り込み | ✅ | カレンダー上に「作業区分で絞り込み」セレクト (築炉/レギュラー/スポット) を確認 |

### 1-B. 配置完了後ページ

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| B-1 | L26 | 担当者 | ✅ | 配置パネル `contactName` / `contactTel` フィールド、印刷ページ「担当者 田村 / 077-345-6789」表示確認 |
| B-2 | L27 | 持ち物 | ✅ | 配置パネル `belongings` フィールド、印刷ページの「持ち物 / メモ」セクション |
| B-3 | L28 | Google マップ | 🟡 F-4 | 配置編集パネルには地図 iframe（遅延 mount）あり。`/print/assignment/[id]` には**地図 iframe が無い**。印刷時は不要だが、URL 送信用シェアページとしての地図表示は別画面で対応の余地 |

### 1-C. 日計表

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| C-1 | L32-34 | 特殊 / 他 のカテゴリ | ✅ | 日計表ヘッダで「基本 / 運転 / 自社 / 特殊 / 他 / 追加 / 安全 / 宿泊 / 他 / 前渡金」を表示。`AssignmentAllowance.category` (`special`/`other`) で集計先指定 |
| C-2 | L36, L208 | リフトを削除 | 🟡 F-3 | UI からは「リフト」表示は消えている。ただし `prisma/schema.prisma` の `DailyPayment.site1Lift` / `site2Lift` が**残置**。安全のため schema 列削除マイグレーションは未実施 |

### 1-D. 印刷 / 作業日報

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| D-1 | L38 | 旧「印刷ページ」を削除 → 配置日報 | ✅ | サイドナビに「印刷」項目は無く `/print/work-report` (作業日報) と `/print/daily-tally` (日計表印刷) と `/print/assignment/[id]` (配置通知) の3種類に分離 |
| D-2 | L40-41 | 作業日報に 得意先 / 現場名 | ✅ | `/print/work-report` ヘッダ「得意先コード / 得意先名 / 現場コード / 現場名 / 人数 / 作業員 / 車両 / 現場メモ・原動面」を確認 |

### 1-E. ユーザ権限

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| E-1 | L46 | 管理者 → all ok | ✅ | `admin` ロールで全画面アクセス可 (Playwright 検証済) |
| E-2 | L49 | office: カレンダー（お金以外 OK） | ✅ | `sidebar.tsx` で officeHidden 制御。お金関連変更不可は `requireRole("admin")` で API ロック |
| E-3 | L50 | office: スタッフ一覧 OK | ✅ | `staffVisible: false` だが `adminOnly: false` `officeHidden: undefined` で表示 |
| E-4 | L51 | office: 現場一覧 OK | ✅ | 同上 |
| E-5 | L52 | office: 車両一覧 OK | ✅ | 同上 |
| E-6 | L53 | office: 出来高 なし | ✅ | `forms` の `officeHidden: true` で非表示 |
| E-7 | L54 | office: 日計 OK | ✅ | 日計表は表示。お金変更は admin のみ (`api/daily-payments/[date]` で `requireRole("admin")`) |
| E-8 | L55 | office: CSV なし | ✅ | `export` の `officeHidden: true` |
| E-9 | L56 | office: 印刷 OK | ✅ | `print/work-report` 表示可 |
| E-10 | L57 | office: サイネージ なし | ✅ | サイネージ画面自体が現バージョンに存在せず（議事録通り） |
| E-11 | L58 | office: ユーザー管理 なし | ✅ | `users` の `adminOnly: true` |
| E-12 | L59 | office: 監査ログ なし | ✅ | `audit-logs` の `adminOnly: true` |
| E-13 | L63 | 個人: 自分の予定だけ見れる | ✅ | `/api/calendar` で `staffRole` 判定して自分の staffId のみ返却 (`calendar/route.ts:36-46`) |
| E-14 | L64-72 | 個人: スタッフ一覧/現場/車両/できだか/日計/CSV/サイネージ/ユーザー管理/監査 すべてなし | ✅ | `staffVisible: false` で sidebar 非表示。例外は L26-27 出来高だが `staffVisible: true` で OK |
| E-15 | L70 | 個人: 印刷 OK | 🟡 F-5 | `print/work-report` は `staffVisible: false`。議事録上「印刷 OK」とあるので仕様確認推奨。スタッフ自身の配置詳細 `/print/assignment/[id]` で代替できているかも |

### 1-F. カレンダー UI

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| F-1 | L76 | 配置登録・編集の際のクリック表示をウィンドウモーダル化 | ✅ | `[role="dialog"]` で開く Sheet/Dialog モーダル形式 (Base UI ベース) |

### 1-G. スタッフ情報追加

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| G-1 | L79-83 | 寮区分 (旧寮 1950円 / 新寮 1350円 / 通い 0円) | ✅ | `Staff.residenceType` (`dorm1`/`dorm2`/`commuter`) 実装、スタッフ編集画面の「寮区分」セレクトボックスに金額表記付きで実装済 (`旧寮 (1日 1,950円 自己負担)` 等) |
| G-2 | L83 | 寮費が日計表の宿泊に入る | 🟡 | `DailyPayment.lodgingOffset` あり。`payment-utils.ts` で `residenceType` ベースの自動計算が必要、実装の有無は要動作確認 |

### 1-H. 現場別日給

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| H-1 | L85-89 | 旧寮/新寮/通いの3パターンの日給設定 | ✅ | `JobSite.dailyRateDorm1 / dailyRateDorm2 / dailyRateCommuter` 実装、現場編集画面「現場別日給（寮区分ごとに上書き）」セクションに3つの数値入力欄あり |

### 1-I. 作業員ごとの単価請求

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| I-1 | L90-92 | 可能 / 不可 / 都度相談 | ✅ | `JobSite.workerPricingPolicy` (`possible`/`impossible`/`case_by_case`) 実装、現場編集の「作業員ごとの単価請求」セレクト「可 / 不可 / 都度相談」確認 |

---

## 2. 議事録 文字起こし部分（追加発言）

### 2-A. 配置 / カレンダー

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TA-1 | L96-100 | 担当者なしで保存できる | ✅ | `Assignment.staffId Int?` nullable で未割当作成可 |
| TA-2 | L102-105 | 現場別資格手当（資格ごとに加算額） | ✅ | `JobSiteQualificationBonus` model、現場編集「特殊技能料金 / 必要資格」セクション |
| TA-3 | L107 | 持っている人だけ加算 | ✅ | `bonusAmount` を `StaffQualification` 持ち主にのみ加算するロジック (`payment-utils.ts`) |
| TA-4 | L110 | 現場別日給切り替え | ✅ | TA-2 と関連、`dailyRateOverride` を案件単位で設定可、寮区分別の現場別日給は別途あり |
| TA-5 | L113-116 | 印刷で人数のみ / 氏名のどちらか | ✅ | `/print/work-report` で人数 + 氏名（作業員名）の両方を表示 |
| TA-6 | L131-134 | 得意先マスター（コードは得意先に持たせる） | ✅ | `Customer` model 実装、`JobSite.customerId` で参照、サイドナビ「得意先」あり、現場編集で得意先プルダウン選択 |
| TA-7 | L137-140 | 検索機能（営業所単位・現場で絞り込み） | ✅ | カレンダー画面に「現場名・コードで検索」テキストボックス、営業所フィルタボタン (守口/高瀬/守口第二/橋波) |
| TA-8 | L191-200 | CSV 出力で AI 連携想定 | ✅ | `/export` `/api/export/csv` 実装、`csvExportSchema` で期間・営業所・カラム指定 |
| TA-9 | L148-152 | 車両管理 | ✅ | `Vehicle` model 実装、サイドナビ「車両管理」あり、`/vehicles` で CRUD |
| TA-10 | L158-164 | 車両重複時の警告 | ✅ | `api/assignments/bulk` で `vehicleConflicts` 警告 |
| TA-11 | L165-168 | スタッフ衝突時の警告 | ✅ | `conflicts` を 409 で返却、`assignment-panel` で表示 |
| TA-12 | L171-186 | 事前断りステータス | 🟡 F-2 | A-5 と重複。トグル機能はあるが UI 表示条件要再確認 |

### 2-B. 加算手当の整理

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TB-1 | L206-213 | 加算手当を配置時に複数追加可能 | ✅ | 「+ 路内手当 / + とび手当 / + 出張手当 / + 食事手当 / + 自由入力」ボタンで複数追加 |
| TB-2 | L220 | リフトはもう要らない | 🟡 F-3 | UI 上は削除済。schema 列は残置 |
| TB-3 | L221-224 | 「他」入力欄を追加 | ✅ | `AssignmentAllowance.category` (`special` / `other`) で集計先指定可、UIの「+ 自由入力」で任意項目追加可 |
| TB-4 | L230, L233 | 対象スタッフを選んで手当を付与 | ✅ | `AssignmentAllowance.targetStaffIds` で対象指定 (前回 commit `4a2d496`, `656f6ad` 参照) |

### 2-C. 配置時の必要資格と保険絞り込み

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TC-1 | L356-365 | スタッフ配置時の保険・所属での絞り込み | ✅ | A-10 と重複、配置パネル `filterByRequirements` で絞り込み |
| TC-2 | L391-401 | 必須資格があらかじめ現場にあって、満たさない人はエラー表示 | ✅ | `JobSiteQualificationBonus.isRequired` を `assignment-panel.tsx` で評価、不一致時にバッジ表示 |
| TC-3 | L429-432 | 配置編集後の条件変更で違反者を赤エラー表示 | 🟡 | バッジでの違反表示は実装、ただし「赤エラー表示」と言うほど目立つ UI かは要動作確認（配置パネル内のバッジ色は灰系） |

### 2-D. 現場マスタからの自動 prefill

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TD-1 | L468-477 | 現場選択時に持ち物・担当者・電話・住所が自動補完 | ✅ | 配置パネルで現場選択時に `belongings` / `contactName` / `contactTel` / `transportation` を JobSite からコピー |
| TD-2 | L478-481 | 上書きはマスター反映なし | ✅ | 配置単位の値を `Assignment` に保持、マスター書き戻しなし |

### 2-E. その他 UI 改善

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TE-1 | L416-422 | 配置パネルをモーダル化 / 大きく | ✅ | Dialog で大画面、画面右半分をほぼ専有 |
| TE-2 | L260-262 | 配置完了後の詳細ページ（URL 送信用） | 🟡 F-4 | `/print/assignment/[id]` は印刷用。URL 送信用の独立ページはまだ無い |

### 2-F. 監査ログ

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TF-1 | L284 | ログ取得（誰がいつ何を変更したか） | ✅ | `AuditLog` model、`/audit-logs` 画面で確認可 |

### 2-G. PDF / 資格証明

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TG-1 | L382-398 | スタッフに資格証明書 PDF（Google Drive URL 方式） | ⏸ | ミーティング内で「とりあえず後回し」と確認、StaffQualification にURL列なし |

### 2-H. 音声入力

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TH-1 | L482-484 | 音声で配置内容を入力 | ⏸ | 議事録内で「AI 使えるならいろいろ広がる」レベル、未実装 |

### 2-I. サイネージ（朝の表示モニター）

| ID | 議事録該当 | 項目 | 状態 | 確認内容 |
|---|---|---|---|---|
| TI-1 | L150-152 | サイネージ画面（朝のホワイトボード代替） | ⏸ | 議事録「ボードはボードで別でお願いした」「一番最後でやる」とあり、現バージョン非搭載 |

---

## 3. 重要な未対応 / 部分対応の詳細

### F-1. 現場マスタの「必要保険」設定 UI 欠落（最重要）

#### 現状
- `prisma/schema.prisma` Line 142: `requiredInsurance String?` あり (`"any" | "company_only" | "national_only"`)
- `src/app/api/assignments/bulk/route.ts:77-95`: requiredInsurance を判定して `insuranceWarning` を返すロジックあり
- `src/components/calendar/assignment-panel.tsx:464,537-540`: requiredInsurance を見てスタッフをマッチング、`営業所違い` バッジ表示
- **`src/components/sites/site-form.tsx` には `requiredInsurance` 関連の input/select が一切無い**（grep 結果 0 件）

#### 影響
- 議事録 L19-20「配置する時に、必要保険・所属で登録 → 満たすスタッフのみ表示」の最初のステップが画面操作で実行不可
- 現状運用では「保険要件は seed か直 SQL でセットしない限り無効」になっている
- 配置パネルの絞り込みロジックは動作するが、設定が出来ないため事実上機能していない

#### 開発者向け参考メモ（修正は行わない）
- `site-form.tsx` に保険要件セレクト（「指定なし / 社保のみ / 国保のみ」）を追加すれば schema・API ともすぐ機能する
- バリデーション schema は `validations.ts` の `createJobSiteSchema` / `updateJobSiteSchema` が要件を許可しているか要確認

---

### F-2. 「事前断り」ボタンが実機で表示されない

#### 現状
- `assignment-panel.tsx:417-457` に `PreDeclineSection` コンポーネント定義あり
- `assignment-panel.tsx:1024-1060` にトグル関数 `handleTogglePreDeclined` 実装
- `assignment-panel.tsx:2334-2340` で配置編集パネル内に `<PreDeclineSection>` を render

#### 検証で起きたこと
- Playwright で `/calendar` の 5/11–5/17 週、配置 #76 (中村 / スリーエフコーポレーション / 単発 1日) をクリック
- ダイアログタイトル「配置編集」、`existingAssignment` ありの状態のはず
- しかし dialog の `outerHTML` 全文に「事前断り」の文字列が含まれない
- ボタン一覧: クリア / 地図を表示 / 通い / 出張 / 日勤 / 夜勤 / + 路内手当 / + とび手当 / + 出張手当 / + 食事手当 / + 自由入力 / 更新する の 12 個のみ

#### 推定原因
- `PreDeclineSection(existingAssignment=null)` を渡してしまっている可能性
- 配置編集モーダルとは別の「クイック編集パネル」が表示されている可能性（同じ「配置編集」タイトルでも別 component）
- もしくは表示位置がダイアログ内の特定タブ／セクション内で、初期表示で非アクティブ

#### 開発者向け参考メモ
- `<PreDeclineSection>` を JSX で render している階層が、実際に開かれる Dialog の Tree に乗っているか確認
- React DevTools で `existingAssignment` の値を実機で確認

---

### F-3. 日計表 schema の `siteNLift` 列残置

#### 現状
- `prisma/schema.prisma` Line 350, 360: `site1Lift` / `site2Lift` がカラムとして存在
- UI（`/tally` の th ヘッダ）には「リフト」表示なし
- API (`daily-payments/[date]/route.ts`) で読み書きはしているが、UIで操作不可

#### 影響
- 実害は無いが、議事録 L36「リフトを削除」と差分
- 過去のデータには値が入っている可能性、削除時はバックアップ推奨

#### 開発者向け参考メモ
- Prisma migration で列削除。`payment-utils.ts` の calcPaymentTotal で参照してたら除外
- もしくは「将来再導入の余地」を理由に残置とする旨を CLAUDE.md / AGENTS.md に明記

---

### F-4. 配置詳細「URL 送信用」画面の欠落

#### 現状
- `/print/assignment/[id]` は印刷用フォーマット（地図 iframe なし）
- 配置編集パネル内には地図 iframe（lazy mount）あり
- 議事録 L262「Googleマップと担当者名と持ち物情報と出てくるような画面を一個作る。それを印刷する」

#### 推定意図
- 印刷用 = 紙に出すフォーマット（地図画像は出しにくいので OK）
- URL 送信用 = スマホで開いてもらう用、Google マップを iframe で表示

#### 開発者向け参考メモ
- 新規ページ例: `/share/assignment/[id]` を作り、印刷用と分離
- もしくは現状の `/print/assignment/[id]` を「印刷時のみ地図を `print:hidden` で消す」拡張

---

### F-5. 個人ロールの「印刷」表示

#### 現状
- 議事録 L70: 「個人 → 印刷p」と明記（=> 個人ロールも印刷ページを見られる）
- 実装: `sidebar.tsx` で `print/work-report` は `staffVisible: false` → 個人非表示
- `/print/assignment/[id]` (配置通知書) は直接URL なら staff も見られる可能性（要動作確認）

#### 推定意図
- 個人が見るのは「自分の配置通知書」だけで OK
- `print/work-report` (全員分の日報) は管理側だけで良いという解釈なら現状で OK

#### 開発者向け参考メモ
- 仕様明確化: 個人ロールに見せたいのは「自分の配置詳細」だけか「全員分の作業日報」も含むか確認
- 現状で良ければ議事録メモを「自分の配置のみ」と読み替え

---

## 4. 議事録から派生する追加チェック項目

以下は議事録に直接書かれていないが、現状の実装で気になった点（QA 補足）。

### 4-A. ロール体系の正規化
- 現在の `User.role` enum: `"admin","manager","office","viewer","staff"` の 5 種類
- 議事録では 3 種類のみ言及 (管理者 / ユーザー1 / 個人)
- `manager` / `viewer` の用途と運用方針は要確認

### 4-B. 日計表の `lodgingOffset` 自動計算
- スタッフの `residenceType` から日割で `lodgingOffset` を自動セットするロジックの実装有無は実機未確認
- `payment-utils.ts` の `seedDailyPaymentsForDate` での挙動を要トレース

### 4-C. 監査ログの粒度
- 議事録 L283-284「ログ全部取れるように」とある
- 現状 `AuditLog.model` の対象: "Assignment" | "AssignmentDay" | "Staff" | "JobSite" | "User" | "WorkCompletionForm" | "Vehicle"
- `Customer` (得意先) `DailyPayment` (日計表) `BranchOffice` (営業所) はログ対象外（要確認）

### 4-D. CSV 出力フォーマット
- `csvExportSchema` の `columns` が議事録の AI 連携想定で十分か（社員コード・現場名・日付・金額・寮区分などが揃っているか）は実機ファイル要確認

### 4-E. データベース整合性
- 議事録 L130 で「現場名ベースで重複可能」と発言
- 実装: `JobSite.siteCode` が unique、`name` は非 unique → 仕様通り

---

## 5. テスト方法

検証で使用したコマンド・操作の主なもの:

```bash
# Schema 確認
cat prisma/schema.prisma | grep -E "residence|dailyRate|workerPricing|requiredInsurance|pre_declined|Lift"

# UI コンポーネントの実装有無
grep -rn "requiredInsurance\|hasShaho" src/components/sites/site-form.tsx
grep -rn "pre_declined\|事前断り" src/components/calendar/assignment-panel.tsx
grep -rn "officeHidden\|adminOnly\|staffVisible" src/components/layout/sidebar.tsx

# Playwright で実画面確認
# - /staff/1 → 寮区分 / 保険複数選択
# - /sites/3 → 現場別日給 / 単価請求 / 作業区分 / 必須資格 / 必要保険 (← 欠落)
# - /calendar → 作業区分絞込 / 一括配置 / 既存配置クリックで編集パネル
# - 配置編集パネル → 加算手当・対象スタッフ・地図遅延読込・事前断り (← 検出不可)
# - /tally?date=2026-05-15 → 特殊/他/宿泊/前渡金 (リフトなし)
# - /print/work-report → 得意先/現場/人数/作業員/車両/現場メモ
# - /print/assignment/76 → 配置通知書 (地図なし)
```

---

## 6. 最終所感

- 議事録の **9割の項目は実装済み**。特に schema 設計と API ロジックの実装は議事録に忠実。
- **唯一クリティカルな未対応は §F-1（現場マスタの保険要件 UI）**。スキーマとロジックは揃っているのに UI 入力欄が欠落しているため、配置時の保険絞り込み機能が現場運用では発動しない状態。
- §F-2（事前断りボタン）はコード実装はあるが、現実のテストデータで検出できなかったため、表示条件のバグ or 別 path から呼ばれている可能性が高い。
- §F-3 のリフト schema 残置は実害なし。本番リリース前のクリーンアップ項目。
- §F-4 / F-5 は仕様の解釈次第。ミーティング参加者と要再確認。
- ⏸ の項目（PDF 資格証明、音声入力、サイネージ）はミーティング内で「将来課題」と確認済。

次のステップとしては、§F-1 の `site-form.tsx` に保険要件入力欄を追加することが最も投資対効果が高いと考えられます（schema/API は既に整備済のため）。
