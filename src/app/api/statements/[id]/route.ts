import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import path from "path";

// DELETE /api/statements/[id]
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
        const statementId = Number(id);

        const statement = await prisma.statement.findFirst({
            where: { id: statementId, userId: user.userId },
        });

        if (!statement) {
            return NextResponse.json({ error: "找不到對帳單" }, { status: 404 });
        }

        // Delete associated transactions
        await prisma.transaction.deleteMany({
            where: { statementId: statement.id },
        });

        // Delete image files
        const imageUrls = JSON.parse(statement.imageUrls || "[]") as string[];
        for (const url of imageUrls) {
            try {
                const filePath = path.join(process.cwd(), "public", url);
                await unlink(filePath);
            } catch {
                // File may already be deleted
            }
        }

        // Delete statement record
        await prisma.statement.delete({
            where: { id: statement.id },
        });

        return NextResponse.json({ message: "已刪除" });
    } catch (error) {
        console.error("Delete statement error:", error);
        return NextResponse.json({ error: "刪除失敗" }, { status: 500 });
    }
}
