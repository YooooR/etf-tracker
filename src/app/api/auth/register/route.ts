import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createToken, getAuthCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const { username, password, displayName } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { error: "帳號和密碼為必填" },
                { status: 400 }
            );
        }

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return NextResponse.json({ error: "帳號已存在" }, { status: 409 });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                passwordHash,
                displayName: displayName || username,
            },
        });

        const token = await createToken({
            userId: user.id,
            username: user.username,
        });

        const cookieOptions = getAuthCookieOptions();
        const response = NextResponse.json({
            user: { id: user.id, username: user.username, displayName: user.displayName },
        });
        response.cookies.set(cookieOptions.name, token, cookieOptions);

        return response;
    } catch (error) {
        console.error("Register error:", error);
        return NextResponse.json({ error: "註冊失敗" }, { status: 500 });
    }
}
