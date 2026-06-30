import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/statements — list all statements for current user
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const statements = await prisma.statement.findMany({
            where: { userId: user.userId },
            orderBy: { yearMonth: "desc" },
        });

        return NextResponse.json({ statements });
    } catch (error) {
        console.error("GET statements error:", error);
        return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }
}
