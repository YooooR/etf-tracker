import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const resolvedParams = await params;
        const id = Number(resolvedParams.id);
        if (isNaN(id)) {
            return NextResponse.json({ error: "無效的 ID" }, { status: 400 });
        }

        const income = await prisma.lendingIncome.findUnique({
            where: { id },
        });

        if (!income) {
            return NextResponse.json({ error: "找不到紀錄" }, { status: 404 });
        }

        if (income.userId !== user.userId) {
            return NextResponse.json({ error: "權限不足" }, { status: 403 });
        }

        await prisma.lendingIncome.delete({
            where: { id },
        });

        return NextResponse.json({ message: "刪除成功" });
    } catch (error) {
        console.error("Delete lending income error:", error);
        return NextResponse.json({ error: "刪除失敗" }, { status: 500 });
    }
}
