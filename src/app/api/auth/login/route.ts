import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createToken, getAuthCookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { error: "帳號和密碼為必填" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
        }

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
        console.error("Login error:", error);
        return NextResponse.json({ error: "登入失敗" }, { status: 500 });
    }
}
