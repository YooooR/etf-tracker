import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/dividends
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const etfCode = searchParams.get("etfCode");

        const where: Record<string, unknown> = { userId: user.userId };
        if (etfCode) where.etfCode = etfCode;

        const dividends = await prisma.dividend.findMany({
            where,
            orderBy: { exDate: "desc" },
        });

        return NextResponse.json({ dividends });
    } catch (error) {
        console.error("GET dividends error:", error);
        return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }
}

// POST /api/dividends
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const body = await request.json();
        const {
            etfCode,
            etfName,
            exDate,
            paymentDate,
            cashDividend,
            stockDividend,
            shares,
            totalAmount,
        } = body;

        if (!etfCode || !etfName || !exDate || !paymentDate) {
            return NextResponse.json({ error: "必填欄位不完整" }, { status: 400 });
        }

        const dividend = await prisma.dividend.create({
            data: {
                userId: user.userId,
                etfCode,
                etfName,
                exDate: new Date(exDate),
                paymentDate: new Date(paymentDate),
                cashDividend: Number(cashDividend || 0),
                stockDividend: Number(stockDividend || 0),
                shares: Number(shares || 0),
                totalAmount: Number(totalAmount || 0),
            },
        });

        return NextResponse.json({ dividend }, { status: 201 });
    } catch (error) {
        console.error("POST dividend error:", error);
        return NextResponse.json({ error: "新增失敗" }, { status: 500 });
    }
}
