import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface TxInput {
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

interface LendingInput {
    etfCode: string;
    etfName: string;
    totalIncome: number;
    fee: number;
    tax: number;
    netIncome: number;
}

// POST /api/statements/confirm — save parsed transactions + lending income to DB
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const { statementId, transactions, lendingIncome } = await request.json();

        if (!statementId) {
            return NextResponse.json({ error: "缺少 statementId" }, { status: 400 });
        }

        // Verify ownership
        const statement = await prisma.statement.findFirst({
            where: { id: Number(statementId), userId: user.userId },
        });

        if (!statement) {
            return NextResponse.json({ error: "找不到對帳單" }, { status: 404 });
        }

        // Build all operations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ops: any[] = [];

        // Create transactions
        if (transactions && Array.isArray(transactions)) {
            for (const tx of transactions as TxInput[]) {
                ops.push(
                    prisma.transaction.create({
                        data: {
                            userId: user.userId,
                            statementId: statement.id,
                            date: new Date(tx.date),
                            etfCode: tx.etfCode,
                            etfName: tx.etfName,
                            action: tx.action,
                            shares: Number(tx.shares),
                            price: Number(tx.price),
                            amount: Number(tx.amount),
                            fee: Number(tx.fee || 0),
                            tax: Number(tx.tax || 0),
                            netAmount: Number(tx.netAmount || 0),
                        },
                    })
                );
            }
        }

        // Create lending income records
        if (lendingIncome && Array.isArray(lendingIncome)) {
            for (const li of lendingIncome as LendingInput[]) {
                ops.push(
                    prisma.lendingIncome.create({
                        data: {
                            userId: user.userId,
                            statementId: statement.id,
                            yearMonth: statement.yearMonth,
                            etfCode: li.etfCode,
                            etfName: li.etfName || "",
                            totalIncome: Number(li.totalIncome || 0),
                            fee: Number(li.fee || 0),
                            tax: Number(li.tax || 0),
                            netIncome: Number(li.netIncome || 0),
                        },
                    })
                );
            }
        }

        const created = await prisma.$transaction(ops);

        // Mark statement as parsed
        await prisma.statement.update({
            where: { id: statement.id },
            data: { parsed: true },
        });

        const txCount = (transactions as TxInput[] | undefined)?.length || 0;
        const liCount = (lendingIncome as LendingInput[] | undefined)?.length || 0;

        return NextResponse.json({
            message: `成功匯入 ${txCount} 筆交易${liCount > 0 ? `、${liCount} 筆借券收入` : ""}`,
            count: created.length,
        });
    } catch (error) {
        console.error("Confirm parse error:", error);
        return NextResponse.json({ error: "匯入失敗" }, { status: 500 });
    }
}
