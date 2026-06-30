import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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

        const statement = await prisma.statement.findUnique({
            where: { id },
            select: { userId: true, aiResult: true },
        });

        if (!statement) {
            return NextResponse.json({ error: "找不到對帳單" }, { status: 404 });
        }

        if (statement.userId !== user.userId) {
            return NextResponse.json({ error: "權限不足" }, { status: 403 });
        }

        if (!statement.aiResult) {
            // No previous result found
            return NextResponse.json({
                transactions: [],
                holdings: [],
                lendingIncome: [],
                statementId: id,
                model: null,
            });
        }

        // Return the parsed JSON
        const resultJSON = JSON.parse(statement.aiResult);
        return NextResponse.json(resultJSON);
    } catch (error) {
        console.error("Fetch ai-result error:", error);
        return NextResponse.json({ error: "無法取得解析結果" }, { status: 500 });
    }
}
