import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/transactions — list all transactions for current user
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const etfCode = searchParams.get("etfCode");
        const yearMonth = searchParams.get("yearMonth");

        const where: Record<string, unknown> = { userId: user.userId };
        if (etfCode) where.etfCode = etfCode;
        if (yearMonth) {
            const [year, month] = yearMonth.split("-").map(Number);
            where.date = {
                gte: new Date(year, month - 1, 1),
                lt: new Date(year, month, 1),
            };
        }

        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { date: "desc" },
        });

        return NextResponse.json({ transactions });
    } catch (error) {
        console.error("GET transactions error:", error);
        return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }
}

// POST /api/transactions — create new transaction
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const body = await request.json();
        const { date, etfCode, etfName, action, shares, price, amount, fee, tax, netAmount } = body;

        if (!date || !etfCode || !etfName || !action || !shares || !price) {
            return NextResponse.json({ error: "必填欄位不完整" }, { status: 400 });
        }

        const transaction = await prisma.transaction.create({
            data: {
                userId: user.userId,
                date: new Date(date),
                etfCode,
                etfName,
                action,
                shares: Number(shares),
                price: Number(price),
                amount: Number(amount || shares * price),
                fee: Number(fee || 0),
                tax: Number(tax || 0),
                netAmount: Number(netAmount || 0),
            },
        });

        return NextResponse.json({ transaction }, { status: 201 });
    } catch (error) {
        console.error("POST transaction error:", error);
        return NextResponse.json({ error: "新增失敗" }, { status: 500 });
    }
}
