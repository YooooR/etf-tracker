import Tesseract from "tesseract.js";
import { readFile } from "fs/promises";
import path from "path";

// Known ETF code-name mappings
const ETF_NAMES: Record<string, string> = {
    "0050": "元大台灣50",
    "0056": "元大高股息",
    "006208": "富邦台50",
    "00713": "元大台灣高息低波",
    "00878": "國泰永續高股息",
    "00929": "復華台灣科技優息",
    "00919": "群益台灣精選高息",
    "00940": "元大台灣價值高息",
    "2884": "玉山金",
    "2886": "兆豐金",
    "2891": "中信金",
    "6669": "緯穎",
};

// All known codes for fuzzy matching
const KNOWN_CODES = Object.keys(ETF_NAMES);

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

interface ParsedHolding {
    etfCode: string;
    etfName: string;
    shares: number;
    marketPrice: number;
    marketValue: number;
}

export interface TesseractParseResult {
    transactions: ParsedTransaction[];
    holdings: ParsedHolding[];
    rawText: string;
}

/**
 * Check if a string is a valid stock code (not a date)
 */
function isValidCode(s: string): boolean {
    if (ETF_NAMES[s]) return true;
    if (!/^\d{4,6}$/.test(s)) return false;
    const n = parseInt(s);
    if (n >= 2020 && n <= 2035) return false; // exclude year-like
    if (n >= 1000 && n <= 1231) return false; // exclude MMDD-like
    return /^[0236]/.test(s);
}

/**
 * Try to fuzzy-match a garbled OCR code to a known ETF code
 * e.g., "o071s" → "00713", "ro208" → "006208"
 */
function fuzzyMatchCode(text: string): string {
    // Clean common OCR substitutions: o→0, s→5, z→2, l→1, O→0
    const cleaned = text
        .replace(/[oO]/g, "0")
        .replace(/s/g, "5")
        .replace(/z/g, "2")
        .replace(/l/g, "1")
        .replace(/I/g, "1");

    // Extract digit sequences
    const digits = cleaned.replace(/[^0-9]/g, "");
    if (digits.length >= 4 && digits.length <= 6) {
        // Check if it matches a known code
        for (const code of KNOWN_CODES) {
            if (digits.includes(code) || code.includes(digits)) return code;
        }
        if (isValidCode(digits)) return digits;
    }
    return "";
}

/**
 * Find ETF code in text, with fuzzy matching
 */
function findCode(text: string): string {
    // First try exact match
    const exactMatch = text.match(/\b(\d{4,6})\b/g);
    if (exactMatch) {
        for (const m of exactMatch) {
            if (isValidCode(m)) return m;
        }
    }

    // Try fuzzy match on word-like tokens
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
        if (token.length >= 4 && token.length <= 8) {
            const code = fuzzyMatchCode(token);
            if (code) return code;
        }
    }

    return "";
}

/**
 * Parse statement images using Tesseract.js OCR + regex extraction
 */
export async function parseWithTesseract(
    imageUrls: string[]
): Promise<TesseractParseResult> {
    const startTime = Date.now();

    // Read all image buffers
    const buffers = await Promise.all(
        imageUrls.map(async (url) => {
            const filePath = path.join(process.cwd(), "public", url);
            return readFile(filePath);
        })
    );

    // Run OCR in parallel
    console.log(`[Tesseract] Processing ${buffers.length} images in parallel...`);

    const results = await Promise.all(
        buffers.map((buf) =>
            Tesseract.recognize(buf, "chi_tra+eng", { logger: () => { } })
        )
    );

    const allText = results.map((r) => r.data.text);
    const rawText = allText.join("\n===PAGE===\n");

    const elapsed = Date.now() - startTime;
    console.log(`[Tesseract] OCR done in ${(elapsed / 1000).toFixed(1)}s`);

    const transactions = extractTransactions(rawText);
    const holdings = extractHoldings(rawText);

    // Dedup transactions
    const seen = new Set<string>();
    const uniqueTx = transactions.filter((tx) => {
        const key = `${tx.date}|${tx.etfCode}|${tx.shares}|${tx.price}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    console.log(
        `[Tesseract] Extracted: ${uniqueTx.length} transactions, ${holdings.length} holdings in ${((Date.now() - startTime) / 1000).toFixed(1)}s`
    );

    return { transactions: uniqueTx, holdings, rawText };
}

/**
 * Extract transactions from OCR text
 */
function extractTransactions(text: string): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    const lines = text.split("\n");

    // First pass: build a map of line index → ETF code found on that line
    const lineCodesMap: Map<number, string> = new Map();
    for (let i = 0; i < lines.length; i++) {
        const lineNoDate = lines[i].replace(/\d{4}\/\d{2}\/\d{2}/g, "").trim();
        const code = findCode(lineNoDate);
        if (code) lineCodesMap.set(i, code);
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Match date: exact or fuzzy (OCR may garble 2026 → 2oe6, z026)
        const dateMatch = line.match(/(\d{4}\/\d{2}\/\d{2})/);
        // Also try fuzzy date: any pattern that looks date-like
        const fuzzyDate = line.match(
            /([2z]\d{2,3}\/\d{2}\/\d{2})/i
        );

        const rawDate = dateMatch?.[1] || fuzzyDate?.[1];
        if (!rawDate) continue;

        // Normalize date
        const dateParts = rawDate.replace(/[^0-9/]/g, "0").split("/");
        if (dateParts.length !== 3) continue;
        const year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
        const date = `${year}-${dateParts[1]}-${dateParts[2]}`;

        // Find number pattern: shares price amount
        const nums = line.match(
            /(\d{1,3}(?:,\d{3})*)\s+(\d+\.\d{2,4})\s+(\d{1,3}(?:,\d{3})*)/
        );
        if (!nums) continue;

        const shares = parseInt(nums[1].replace(/,/g, ""));
        const price = parseFloat(nums[2]);
        const amount = parseInt(nums[3].replace(/,/g, ""));

        // Validate: shares * price ≈ amount
        const calc = Math.round(shares * price);
        if (Math.abs(calc - amount) > amount * 0.05 && amount > 100) continue;

        // Find ETF code: search nearby lines
        let code = "";
        // Remove date and number portions from current line before searching
        const lineClean = line
            .replace(/\d{4}\/\d{2}\/\d{2}/g, "")
            .replace(/\d+\.\d{4}/g, "") // remove prices
            .trim();
        code = findCode(lineClean);

        // Check surrounding lines (codes often appear on separate lines)
        if (!code) {
            for (const offset of [-1, -2, 1]) {
                const li = i + offset;
                if (li >= 0 && li < lines.length && lineCodesMap.has(li)) {
                    // Make sure this code line hasn't been consumed by another transaction
                    code = lineCodesMap.get(li)!;
                    break;
                }
            }
        }

        if (!code) continue;

        // Fee
        const afterAmount = line.substring(
            line.indexOf(nums[3]) + nums[3].length
        );
        const feeMatch = afterAmount.match(/\s+(\d{1,3})\b/);
        const fee = feeMatch ? parseInt(feeMatch[1]) : 0;

        // NetAmount
        const netMatch = line.match(/\((\d[\d,]*)\)/);
        const netAmount = netMatch
            ? -parseInt(netMatch[1].replace(/,/g, ""))
            : -(amount + fee);

        transactions.push({
            date,
            etfCode: code,
            etfName: ETF_NAMES[code] || code,
            action: "BUY",
            shares,
            price,
            amount,
            fee,
            tax: 0,
            netAmount,
        });
    }

    return transactions;
}

/**
 * Extract holdings from OCR text
 */
function extractHoldings(text: string): ParsedHolding[] {
    const holdings: ParsedHolding[] = [];
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    let inHoldings = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (
            line.includes("庫存") &&
            (line.includes("集保") || line.includes("信用") || line.includes("明細"))
        ) {
            inHoldings = true;
            continue;
        }

        if (
            inHoldings &&
            (line.includes("訊息") ||
                line.includes("借貸") ||
                line.includes("===PAGE===") ||
                line.includes("合計") ||
                line.includes("合 計"))
        ) {
            // "合計" is the total row — stop processing
            if (line.includes("合計") || line.includes("合 計")) {
                inHoldings = false;
            }
            continue;
        }

        if (!inHoldings) continue;

        // Find code
        const code = findCode(line);
        if (!code) continue;

        // Find numbers: large integer (shares) + float (price) + large integer (value)
        const allNums = line.match(/(\d{1,3}(?:,\d{3})+|\d{4,})/g);
        const price = line.match(/(\d+\.\d{2,4})/);

        if (allNums && allNums.length >= 1) {
            const sharesStr = allNums[0];
            const shares = parseInt(sharesStr.replace(/,/g, ""));
            const marketPrice = price ? parseFloat(price[0]) : 0;
            const lastNumStr = allNums[allNums.length - 1];
            const lastNum = parseInt(lastNumStr.replace(/,/g, ""));

            if (shares > 0 && shares !== lastNum && lastNum > shares) {
                holdings.push({
                    etfCode: code,
                    etfName: ETF_NAMES[code] || code,
                    shares,
                    marketPrice,
                    marketValue: lastNum,
                });
            }
        }
    }

    return holdings;
}
