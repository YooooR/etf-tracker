import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const incomes = await prisma.lendingIncome.findMany({
            where: { userId: user.userId },
            orderBy: { createdAt: "desc" },
            include: {
                statement: { select: { yearMonth: true } }
            }
        });

        // Calculate totals
        const totalNetIncome = incomes.reduce((acc, curr) => acc + curr.netIncome, 0);

        return NextResponse.json({
            incomes,
            totalNetIncome,
        });
    } catch (error) {
        console.error("Fetch lending incomes error:", error);
        return NextResponse.json({ error: "無法取得借券收入紀錄" }, { status: 500 });
    }
}
