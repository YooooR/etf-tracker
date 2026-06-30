import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const body = await request.json();
        const { etfCode, etfName, transactions = [], dividends = [], lendingIncomes = [] } = body;

        if (!etfCode || !etfName) {
            return NextResponse.json({ error: "ETF 代號與名稱不得為空" }, { status: 400 });
        }

        // Prepare operations for Prisma transaction
        const ops: unknown[] = [];

        // 1. Transactions
        for (const tx of transactions) {
            ops.push(
                prisma.transaction.create({
                    data: {
                        userId: user.userId,
                        date: new Date(tx.date),
                        etfCode,
                        etfName,
                        action: tx.action || "BUY",
                        shares: Number(tx.shares) || 0,
                        price: Number(tx.price) || 0,
                        amount: Number(tx.amount) || 0,
                        fee: Number(tx.fee) || 0,
                        tax: 0,
                        netAmount: Number(tx.netAmount) || 0,
                    }
                })
            );
        }

        // 2. Dividends
        for (const div of dividends) {
            ops.push(
                prisma.dividend.create({
                    data: {
                        userId: user.userId,
                        etfCode,
                        etfName,
                        exDate: new Date(div.date),
                        paymentDate: new Date(div.date), // Same for simplistic import
                        cashDividend: Number(div.cashDividend) || 0,
                        stockDividend: Number(div.stockDividend) || 0,
                        shares: Number(div.shares) || 0,
                        totalAmount: Number(div.cashDividend) || 0,
                    }
                })
            );
        }

        // 3. Lending Incomes
        for (const lend of lendingIncomes) {
            // Group by yearMonth or use exact Date? The schema requires yearMonth.
            const d = new Date(lend.date);
            const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            ops.push(
                prisma.lendingIncome.create({
                    data: {
                        userId: user.userId,
                        yearMonth,
                        etfCode,
                        etfName,
                        totalIncome: Number(lend.totalIncome) || 0,
                        fee: Number(lend.fee) || 0,
                        tax: Number(lend.tax) || 0,
                        netIncome: Number(lend.netIncome) || 0,
                    }
                })
            );
        }

        if (ops.length === 0) {
            return NextResponse.json({ error: "沒有可匯入的資料" }, { status: 400 });
        }

        // Execute all inserts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await prisma.$transaction(ops as any);

        return NextResponse.json({
            message: "匯入成功",
            stats: {
                transactions: transactions.length,
                dividends: dividends.length,
                lendingIncomes: lendingIncomes.length,
            }
        });

    } catch (error) {
        console.error("Excel import error:", error);
        return NextResponse.json({ error: "匯入失敗，請檢查資料格式" }, { status: 500 });
    }
}
