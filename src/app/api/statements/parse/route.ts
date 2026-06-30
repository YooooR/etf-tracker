import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI, Type } from "@google/genai";
import { readFile } from "fs/promises";
import path from "path";
import { parseWithTesseract } from "@/lib/tesseract-parser";

const PARSE_PROMPT = `你是台灣證券對帳單解析器。從「元大證券 電子綜合月對帳單」圖片中提取數據。

# 重要規則
- 逗號「,」是千分位。110,853 = 十一萬零八百五十三
- 股數、金額、市值 = 整數。單價 = 小數
- 買賣判斷與淨收付標準（極度重要）：若「淨收付」有括號 (如 (93,666))，請在 netAmount 輸出負數（如 -93666），且 action 絕對是「BUY」。若無括號 (如 132,962)，輸出正數，且 action 絕對是「SELL」。

# 解析步驟

## 步驟1：交易明細（「上市、上櫃、興櫃交易明細」表格）

表格欄位從左到右：成交日期/交割日期 | 市場 | 幣別 | 買賣 | 證券代號/名稱 | 股數 | 單價 | 成交金額 | 手續費 | ... | 淨收付(括號=負)

⚠️ 極重要的「視覺兩行」讀取規則：
對帳單上的每一筆交易，在視覺上會佔用「上下兩行」的空間！
- 上半行：有「成交日期」（如 2026/02/06）、「買賣」、「證券代號」（只有數字，如 0056）、「股數」、「單價」、「金額」等數字。
- 下半行：有「交割日期」（如 2026/02/10）、「證券名稱」（如 元大高股息）。
👉 也就是說，請把「每上下兩行」合併視為「同一筆交易」！
👉 因此，如果有 4 筆交易，就會有 4 個不同的證券代號與名稱（例如：0056、006208、00713、00878），請逐一往下讀取「新的代號」，**絕對不可以**把上一筆的代號（如 0056或006208）重複超過一次。請確保有幾筆股數/單價，就對應幾個不同的正確代號。

## 步驟2：定期定額（「台股定期定額交易明細」表格）

與步驟1相同日期+代號+股數+單價的交易只保留一筆。

## 步驟3：庫存明細（「庫存明細(集保、信用)」表格）

欄位：證券代號+名稱 | 集保庫存(股,整數) | ... | 參考價 | ... | 市價(整數)
請仔細讀取每一列的代號與千分位數字。

## 步驟4：借券收入（「有價證券借貸庫存及沖銷明細」表格）

按證券代號分組合計，每個代號輸出一筆 lendingIncome：
- totalIncome = 該代號所有列的「合計淨收付」加總
- fee = 手續費合計、tax = 代扣稅合計、netIncome = 淨收付合計。如找不到此表格回傳空陣列。

# 代號校正表
0056=元大高股息, 006208=富邦台50, 00713=元大台灣高息低波, 00878=國泰永續高股息, 00929=復華台灣科技優息, 2884=玉山金, 6669=緯穎

# 忽略：帳戶總覽、資產配置、財富管理信託、訊息通知
只輸出 JSON。`;

const RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        transactions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING },
                    etfCode: { type: Type.STRING },
                    etfName: { type: Type.STRING },
                    action: { type: Type.STRING },
                    shares: { type: Type.INTEGER },
                    price: { type: Type.NUMBER },
                    amount: { type: Type.INTEGER },
                    fee: { type: Type.INTEGER },
                    tax: { type: Type.INTEGER },
                    netAmount: { type: Type.INTEGER },
                },
                required: [
                    "date", "etfCode", "etfName", "action",
                    "shares", "price", "amount",
                ],
            },
        },
        holdings: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    etfCode: { type: Type.STRING },
                    etfName: { type: Type.STRING },
                    shares: { type: Type.INTEGER },
                    marketPrice: { type: Type.NUMBER },
                    marketValue: { type: Type.INTEGER },
                },
                required: ["etfCode", "etfName", "shares"],
            },
        },
        lendingIncome: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    etfCode: { type: Type.STRING },
                    etfName: { type: Type.STRING },
                    totalIncome: { type: Type.NUMBER },
                    fee: { type: Type.NUMBER },
                    tax: { type: Type.NUMBER },
                    netIncome: { type: Type.NUMBER },
                },
                required: ["etfCode", "totalIncome", "netIncome"],
            },
        },
    },
    required: ["transactions", "holdings"],
};

// Available Gemini models (only those with actual free-tier quota)
// Dashboard shows: gemini-2.5-flash (20 RPD), gemini-2.5-flash-lite (20 RPD)
// gemini-2.5-pro / 2.0-flash / 2.0-flash-lite all show 0/0 quota
const ALL_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
];

const DEFAULT_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
];

// POST /api/statements/parse
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const body = await request.json();
        const { statementId, selectedImages, method = "gemini", geminiModel } = body;

        if (!statementId) {
            return NextResponse.json({ error: "缺少 statementId" }, { status: 400 });
        }

        const statement = await prisma.statement.findFirst({
            where: { id: Number(statementId), userId: user.userId },
        });

        if (!statement) {
            return NextResponse.json({ error: "找不到對帳單" }, { status: 404 });
        }

        const allImageUrls = JSON.parse(statement.imageUrls || "[]") as string[];
        if (allImageUrls.length === 0) {
            return NextResponse.json({ error: "沒有圖片可解析" }, { status: 400 });
        }

        // If selectedImages provided, only use those indices
        const imageUrls =
            selectedImages && Array.isArray(selectedImages) && selectedImages.length > 0
                ? selectedImages
                    .map((idx: number) => allImageUrls[idx])
                    .filter(Boolean)
                : allImageUrls;

        // ===== Tesseract.js (local OCR) =====
        if (method === "tesseract") {
            console.log(`[Parse] Using Tesseract.js for ${imageUrls.length} images`);
            const result = await parseWithTesseract(imageUrls);

            console.log(
                `✅ Tesseract: ${result.transactions.length} tx, ${result.holdings.length} holdings`
            );

            return NextResponse.json({
                transactions: result.transactions,
                holdings: result.holdings,
                statementId: statement.id,
                model: "Tesseract.js (本地 OCR)",
            });
        }

        // ===== Gemini Vision API =====
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "未設定 GEMINI_API_KEY" },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        // Build image parts
        const imageParts: Array<{
            inlineData: { mimeType: string; data: string };
        }> = [];

        for (const imageUrl of imageUrls) {
            const filePath = path.join(process.cwd(), "public", imageUrl);
            const imageBuffer = await readFile(filePath);
            const base64 = imageBuffer.toString("base64");
            const ext = imageUrl.split(".").pop()?.toLowerCase() || "png";
            const mimeType =
                ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";

            imageParts.push({ inlineData: { mimeType, data: base64 } });
        }

        const parts = [...imageParts, { text: PARSE_PROMPT }];

        // Try multiple models with fallback
        // If user selected a specific model, start with it + add other models as fallback
        const models = geminiModel && ALL_MODELS.includes(geminiModel)
            ? [geminiModel, ...ALL_MODELS.filter(m => m !== geminiModel)]
            : DEFAULT_MODELS;
        let lastError: unknown = null;

        for (const model of models) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    if (attempt > 0) {
                        const retryMatch = String(lastError).match(/retryDelay.*?(\d+)s/);
                        const waitSec = retryMatch ? parseInt(retryMatch[1]) + 2 : 30;
                        console.log(`Retry ${model} attempt ${attempt + 1}, waiting ${waitSec}s...`);
                        await new Promise((r) => setTimeout(r, waitSec * 1000));
                    }

                    console.log(`Trying model: ${model} (attempt ${attempt + 1})`);

                    const response = await ai.models.generateContent({
                        model,
                        contents: [{ role: "user", parts }],
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: RESPONSE_SCHEMA,
                        },
                    });

                    const text = response.text || "";
                    const jsonStr = text
                        .replace(/```json\n?/g, "")
                        .replace(/```\n?/g, "")
                        .trim();

                    const parsed = JSON.parse(jsonStr);

                    // Dedup transactions by date+code+shares+price
                    const seen = new Set<string>();
                    const uniqueTx = (parsed.transactions || []).filter(
                        (tx: ParsedTransaction) => {
                            const key = `${tx.date}|${tx.etfCode}|${tx.shares}|${tx.price}`;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        }
                    );

                    // Post-process: normalize dates, actions, defaults
                    const ETF_NAMES: Record<string, string> = {
                        "0050": "元大台灣50", "0056": "元大高股息", "006208": "富邦台50",
                        "00713": "元大台灣高息低波", "00878": "國泰永續高股息",
                        "00929": "復華台灣科技優息", "00919": "群益台灣精選高息",
                        "00940": "元大台灣價值高息", "2884": "玉山金", "2886": "兆豐金",
                        "2891": "中信金", "6669": "緯穎",
                    };

                    for (const tx of uniqueTx) {
                        // Date: YYYY/MM/DD → YYYY-MM-DD
                        if (tx.date) tx.date = tx.date.replace(/\//g, "-");
                        // Action normalize
                        if (tx.action === "買" || tx.action === "買進") tx.action = "BUY";
                        if (tx.action === "賣" || tx.action === "賣出") tx.action = "SELL";

                        // Absolute override based on netAmount sign
                        if (typeof tx.netAmount === "number") {
                            if (tx.netAmount < 0) {
                                tx.action = "BUY";
                            } else if (tx.netAmount > 0) {
                                tx.action = "SELL";
                            }
                        }

                        // Correct etfName if code is known
                        if (ETF_NAMES[tx.etfCode]) tx.etfName = ETF_NAMES[tx.etfCode];
                        // Defaults
                        tx.fee = tx.fee ?? 0;
                        tx.tax = tx.tax ?? 0;
                        tx.netAmount = tx.netAmount ?? (tx.action === "BUY" ? -(tx.amount + tx.fee) : tx.amount - tx.fee - tx.tax);
                    }

                    // Post-process holdings: correct names
                    for (const h of (parsed.holdings || [])) {
                        if (ETF_NAMES[h.etfCode]) h.etfName = ETF_NAMES[h.etfCode];
                        // Recalc marketValue if missing
                        if (!h.marketValue && h.shares && h.marketPrice) {
                            h.marketValue = Math.round(h.shares * h.marketPrice);
                        }
                    }

                    // Validate: check shares * price ≈ amount
                    for (const tx of uniqueTx) {
                        const expected = Math.round(tx.shares * tx.price);
                        if (Math.abs(expected - tx.amount) > tx.amount * 0.02) {
                            console.warn(
                                `⚠️ Validation warning: ${tx.etfCode} ${tx.shares}×${tx.price}=${expected} ≠ ${tx.amount}`
                            );
                        }
                    }

                    console.log(
                        `✅ ${model}: ${uniqueTx.length} tx, ${(parsed.holdings || []).length} holdings`
                    );

                    const resultToSave = {
                        transactions: uniqueTx,
                        holdings: parsed.holdings || [],
                        lendingIncome: parsed.lendingIncome || [],
                        statementId: statement.id,
                        model,
                    };

                    // Save the raw AI result so user can retrieve it later
                    await prisma.statement.update({
                        where: { id: statement.id },
                        data: { aiResult: JSON.stringify(resultToSave) },
                    });

                    return NextResponse.json(resultToSave);
                } catch (err: unknown) {
                    lastError = err;
                    const errMsg = err instanceof Error ? err.message : String(err);
                    console.error(`${model} attempt ${attempt + 1} failed:`, errMsg.substring(0, 200));

                    if (!errMsg.includes("429") && !errMsg.includes("RESOURCE_EXHAUSTED")) {
                        break;
                    }
                }
            }
            console.log(`Model ${model} exhausted, trying next...`);
        }

        // All models failed
        const errMsg = lastError instanceof Error ? lastError.message : "";
        const retryMatch = errMsg.match(/retryDelay.*?(\d+)s/);
        const retrySec = retryMatch ? parseInt(retryMatch[1]) : 60;

        if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            return NextResponse.json(
                { error: `API 配額已用完，請等待 ${retrySec} 秒後再試`, retryAfterSeconds: retrySec },
                { status: 429 }
            );
        }
        return NextResponse.json(
            { error: `解析失敗：${errMsg.substring(0, 100)}` },
            { status: 500 }
        );
    } catch (error) {
        console.error("Parse statement error:", error);
        return NextResponse.json({ error: "解析失敗" }, { status: 500 });
    }
}

interface ParsedTransaction {
    date: string;
    etfCode: string;
    etfName: string;
    action: string;
    shares: number;
    price: number;
    amount: number;
    fee: number;
    tax: number;
    netAmount: number;
}
