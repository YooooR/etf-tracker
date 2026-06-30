import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const year = new Date().getFullYear().toString();
        
        // Get all unique holdings
        const transactions = await prisma.transaction.findMany({
            where: { userId: user.userId },
            select: { etfCode: true, etfName: true },
            distinct: ['etfCode']
        });

        // Fetch latest dividend for each holding
        const startDate = `${Number(year) - 1}-01-01`; // Get from last year to be safe
        const endDate = `${year}-12-31`;

        const summaryData = await Promise.all(transactions.map(async (t) => {
            try {
                const finMindUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividend&data_id=${t.etfCode}&start_date=${startDate}&end_date=${endDate}`;
                const res = await fetch(finMindUrl, {
                    headers: { "User-Agent": "Mozilla/5.0" },
                    next: { revalidate: 3600 }
                });
                const data = await res.json();
                
                if (data.status === 200 && data.data && data.data.length > 0) {
                    // Find the latest ex-date
                    const events = data.data.map((item: any) => ({
                        exDate: item.CashExDividendTradingDate || item.StockExDividendTradingDate || "",
                        paymentDate: item.CashDividendPaymentDate || "未定",
                        cashDividend: item.CashEarningsDistribution || 0,
                        stockDividend: item.StockEarningsDistribution || 0
                    })).filter((e: any) => e.exDate !== "");
                    
                    events.sort((a: any, b: any) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime());
                    
                    if (events.length > 0) {
                        return {
                            etfCode: t.etfCode,
                            etfName: t.etfName,
                            latestEvent: events[0]
                        };
                    }
                }
                
                return {
                    etfCode: t.etfCode,
                    etfName: t.etfName,
                    latestEvent: null
                };
            } catch (e) {
                return {
                    etfCode: t.etfCode,
                    etfName: t.etfName,
                    latestEvent: null
                };
            }
        }));

        return NextResponse.json({ summary: summaryData });

    } catch (error) {
        console.error("GET dividend summary error:", error);
        return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }
}
