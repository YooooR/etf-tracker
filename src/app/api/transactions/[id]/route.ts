import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/transactions/[id] — update transaction
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const { id } = await params;
        const txId = Number(id);
        const body = await request.json();

        // Verify ownership
        const existing = await prisma.transaction.findFirst({
            where: { id: txId, userId: user.userId },
        });
        if (!existing) {
            return NextResponse.json({ error: "找不到交易紀錄" }, { status: 404 });
        }

        const transaction = await prisma.transaction.update({
            where: { id: txId },
            data: {
                date: body.date ? new Date(body.date) : undefined,
                etfCode: body.etfCode,
                etfName: body.etfName,
                action: body.action,
                shares: body.shares ? Number(body.shares) : undefined,
                price: body.price ? Number(body.price) : undefined,
                amount: body.amount ? Number(body.amount) : undefined,
                fee: body.fee !== undefined ? Number(body.fee) : undefined,
                tax: body.tax !== undefined ? Number(body.tax) : undefined,
                netAmount: body.netAmount !== undefined ? Number(body.netAmount) : undefined,
            },
        });

        return NextResponse.json({ transaction });
    } catch (error) {
        console.error("PUT transaction error:", error);
        return NextResponse.json({ error: "更新失敗" }, { status: 500 });
    }
}

// DELETE /api/transactions/[id] — delete transaction
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const { id } = await params;
        const txId = Number(id);

        const existing = await prisma.transaction.findFirst({
            where: { id: txId, userId: user.userId },
        });
        if (!existing) {
            return NextResponse.json({ error: "找不到交易紀錄" }, { status: 404 });
        }

        await prisma.transaction.delete({ where: { id: txId } });
        return NextResponse.json({ message: "已刪除" });
    } catch (error) {
        console.error("DELETE transaction error:", error);
        return NextResponse.json({ error: "刪除失敗" }, { status: 500 });
    }
}
