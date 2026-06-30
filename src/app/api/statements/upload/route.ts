import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: "未登入" }, { status: 401 });
        }

        const formData = await request.formData();
        const yearMonth = formData.get("yearMonth") as string;
        const files = formData.getAll("files") as File[];

        if (!yearMonth || files.length === 0) {
            return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
        }

        // Create upload directory
        const uploadDir = path.join(process.cwd(), "public", "uploads", String(user.userId));
        await mkdir(uploadDir, { recursive: true });

        const imageUrls: string[] = [];

        for (const file of files) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const ext = file.name.split(".").pop() || "png";
            const filename = `${yearMonth}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
            const filepath = path.join(uploadDir, filename);

            await writeFile(filepath, buffer);
            imageUrls.push(`/uploads/${user.userId}/${filename}`);
        }

        const statement = await prisma.statement.create({
            data: {
                userId: user.userId,
                yearMonth,
                imageUrls: JSON.stringify(imageUrls),
                parsed: false,
            },
        });

        return NextResponse.json({ statement }, { status: 201 });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "上傳失敗" }, { status: 500 });
    }
}
