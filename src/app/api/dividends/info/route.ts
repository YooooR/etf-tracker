import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const etfCode = searchParams.get("etfCode");
        const year = searchParams.get("year") || new Date().getFullYear().toString();

        if (!etfCode) {
            return NextResponse.json({ error: "請提供 ETF 代號" }, { status: 400 });
        }

        // Fetch Data from FinMind for the given year
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        const finMindUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividend&data_id=${etfCode}&start_date=${startDate}&end_date=${endDate}`;
        
        const finMindRes = await fetch(finMindUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        
        const finMindData = await finMindRes.json();
        
        if (finMindData.status !== 200 || !finMindData.data) {
            return NextResponse.json({ error: "無法獲取除權息資料" }, { status: 500 });
        }

        // Parse and calculate from FinMind response
        let totalCashDividend = 0;
        let totalStockDividend = 0;
        
        const events = finMindData.data.map((item: any) => {
            const cashDiv = item.CashEarningsDistribution || 0;
            const stockDiv = item.StockEarningsDistribution || 0;
            totalCashDividend += cashDiv;
            totalStockDividend += stockDiv;
            
            return {
                exDate: item.CashExDividendTradingDate || item.StockExDividendTradingDate || "未定",
                paymentDate: item.CashDividendPaymentDate || "未定",
                cashDividend: cashDiv,
                stockDividend: stockDiv
            };
        });

        // Current Price Fetch
        let currentPrice = 0;
        try {
            const priceUrl = `${request.nextUrl.origin}/api/prices?codes=${etfCode}`;
            const priceRes = await fetch(priceUrl, {
                 headers: { cookie: request.headers.get("cookie") || "" }
            });
            const priceData = await priceRes.json();
            currentPrice = priceData.prices?.[etfCode] || 0;
        } catch (e) {
            console.error("Failed to fetch price:", e);
        }

        const annualYield = currentPrice > 0 ? (totalCashDividend / currentPrice) : 0;

        return NextResponse.json({
            etfCode,
            year,
            totalCashDividend,
            totalStockDividend,
            currentPrice,
            annualYield,
            events: events.sort((a: any, b: any) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime())
        });
    } catch (error) {
        console.error("GET dividend info error:", error);
        return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }
}
