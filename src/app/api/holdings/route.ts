import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateHoldingStats } from "@/lib/calculations";

// GET /api/holdings — computed summary of all ETF holdings
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const etfCode = searchParams.get("etfCode");

        // Get all transactions grouped by ETF
        const where: Record<string, unknown> = { userId: user.userId };
        if (etfCode) where.etfCode = etfCode;

        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { date: "asc" },
        });

        const dividends = await prisma.dividend.findMany({
            where: { userId: user.userId, ...(etfCode ? { etfCode } : {}) },
        });

        // Get current prices (we'll fetch from API later, use placeholder for now)
        const pricesRes = await fetch(
            `${request.nextUrl.origin}/api/prices?codes=${[...new Set(transactions.map((t) => t.etfCode))].join(",")}`,
            { headers: { cookie: request.headers.get("cookie") || "" } }
        ).catch(() => null);
        const pricesData = pricesRes ? await pricesRes.json().catch(() => ({})) : {};
        const prices: Record<string, number> = pricesData.prices || {};

        // Group by ETF
        const etfGroups = new Map<
            string,
            { code: string; name: string; transactions: typeof transactions; dividends: typeof dividends }
        >();

        for (const tx of transactions) {
            if (!etfGroups.has(tx.etfCode)) {
                etfGroups.set(tx.etfCode, {
                    code: tx.etfCode,
                    name: tx.etfName,
                    transactions: [],
                    dividends: [],
                });
            }
            etfGroups.get(tx.etfCode)!.transactions.push(tx);
        }

        for (const div of dividends) {
            if (!etfGroups.has(div.etfCode)) {
                etfGroups.set(div.etfCode, {
                    code: div.etfCode,
                    name: div.etfName,
                    transactions: [],
                    dividends: [],
                });
            }
            etfGroups.get(div.etfCode)!.dividends.push(div);
        }

        const holdings = Array.from(etfGroups.values()).map((group) => {
            const currentPrice = prices[group.code] || 0;
            const stats = calculateHoldingStats({
                transactions: group.transactions.map((t) => ({
                    date: new Date(t.date),
                    action: t.action as "BUY" | "SELL",
                    shares: t.shares,
                    price: t.price,
                    fee: t.fee,
                    tax: t.tax,
                    netAmount: t.netAmount,
                })),
                dividends: group.dividends.map((d) => ({
                    totalAmount: d.totalAmount,
                })),
                currentPrice,
            });

            return {
                etfCode: group.code,
                etfName: group.name,
                currentPrice,
                ...stats,
            };
        });

        // Filter out holdings with 0 shares if not specifically queried
        const filtered = etfCode
            ? holdings
            : holdings.filter((h) => h.totalShares > 0 || h.realizedPnl !== 0);

        return NextResponse.json({ holdings: filtered });
    } catch (error) {
        console.error("GET holdings error:", error);
        return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }
}
