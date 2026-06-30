import { NextRequest, NextResponse } from "next/server";

// TWSE API for stock closing prices
// GET /api/prices?codes=0056,00713,2884
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const codesParam = searchParams.get("codes");

        if (!codesParam) {
            return NextResponse.json({ prices: {} });
        }

        const codes = codesParam.split(",").filter(Boolean);
        const prices: Record<string, number> = {};

        // Fetch from TWSE
        for (const code of codes) {
            try {
                const price = await fetchTWSEPrice(code);
                if (price) prices[code] = price;
            } catch (e) {
                console.error(`Failed to fetch price for ${code}:`, e);
            }
        }

        return NextResponse.json({ prices });
    } catch (error) {
        console.error("GET prices error:", error);
        return NextResponse.json({ error: "查詢股價失敗" }, { status: 500 });
    }
}

async function fetchTWSEPrice(code: string): Promise<number | null> {
    try {
        // Try TWSE listed stocks
        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

        // TWSE real-time quote API
        const res = await fetch(
            `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${code}.tw&json=1&delay=0&_=${Date.now()}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                },
                next: { revalidate: 300 }, // cache 5 min
            }
        );

        if (!res.ok) {
            // Fallback: try OTC
            return await fetchTPExPrice(code);
        }

        const data = await res.json();
        if (data.msgArray && data.msgArray.length > 0) {
            const stock = data.msgArray[0];
            // z = latest price, y = yesterday close
            const price = parseFloat(stock.z) || parseFloat(stock.y);
            if (price && !isNaN(price)) return price;
        }

        // If not found on TWSE, try OTC
        return await fetchTPExPrice(code);
    } catch {
        return await fetchTPExPrice(code);
    }
}

async function fetchTPExPrice(code: string): Promise<number | null> {
    try {
        const res = await fetch(
            `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${code}.tw&json=1&delay=0&_=${Date.now()}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                },
                next: { revalidate: 300 },
            }
        );

        if (!res.ok) return null;

        const data = await res.json();
        if (data.msgArray && data.msgArray.length > 0) {
            const stock = data.msgArray[0];
            const price = parseFloat(stock.z) || parseFloat(stock.y);
            if (price && !isNaN(price)) return price;
        }

        return null;
    } catch {
        return null;
    }
}
