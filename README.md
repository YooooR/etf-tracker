# ETF Tracker

台灣 ETF 持股追蹤系統，具備自動除權息推播通知功能。

## 功能

- 📊 ETF 持股管理（新增 / 編輯 / 刪除交易紀錄）
- 📄 對帳單上傳與 AI 自動解析
- 💰 股利紀錄追蹤
- 📬 **LINE 除權息自動推播**（每天早上 10:00）

---

## 系統架構

```
本機 (Next.js 開發環境)
  └── 新增交易 / 對帳單 ──────────────────┐
                                           ▼
                               Render PostgreSQL（雲端資料庫）
                                           ▲
                                           │ 每天 10:00 自動讀取
                                GitHub Actions（免費排程）
                                           │
                                           ▼
                                 LINE Bot → 手機推播
```

### 各元件

| 元件 | 服務 | 費用 |
|---|---|---|
| 資料庫 | Render PostgreSQL | 免費（90 天內需有連線） |
| 自動推播排程 | GitHub Actions | 完全免費 |
| 除息資料來源 | FinMind API | 免費 |

---

## LINE 推播機制

- **排程**：每天台灣時間 **早上 10:00**（GitHub Actions cron `0 2 * * *` UTC）
- **觸發邏輯**：
  - 掃描所有持股，查詢未來 7 天的除息 / 發放日
  - 若今天或明天有除息 → 額外發送**緊急文字提醒**（含股利金額）
  - 發送 **Flex Message 輪播卡片**（本週完整清單）
- **視覺設計**：
  - 🔴 **除息**：紅色標籤
  - 🟢 **發放**：綠色標籤

---

## 本機開發

### 環境需求

- Node.js 20+
- npm

### 安裝

```bash
npm install
```

### 環境變數

建立 `.env.local`：

```env
DATABASE_URL=postgresql://...        # Render PostgreSQL External URL
LINE_CHANNEL_ACCESS_TOKEN=...        # LINE Channel Access Token
JWT_SECRET=...
GEMINI_API_KEY=...
```

### 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

### 手動執行推播

```bash
node --env-file=.env.local scripts/line-push.js
```

---

## 部署設定

### GitHub Secrets（必須設定）

前往 `Settings → Secrets and variables → Actions`，新增：

| Secret 名稱 | 說明 |
|---|---|
| `DATABASE_URL` | Render PostgreSQL **External** Database URL |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Channel Access Token |

### 手動觸發推播

前往 [Actions](../../actions) → **ETF LINE 除權息推播** → **Run workflow**

---

## 資料庫遷移（SQLite → PostgreSQL）

如需重新搬移本機資料：

```bash
# 設定環境變數後執行
$env:DATABASE_URL="postgresql://..."
npx prisma migrate deploy
node scripts/migrate-to-pg.js
```
