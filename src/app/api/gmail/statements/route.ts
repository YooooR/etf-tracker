import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/googleAuth";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const tokenStr = cookieStore.get("google-tokens")?.value;
    if (!tokenStr) {
        return NextResponse.json({ error: "未授權 Gmail 存取", needsAuth: true }, { status: 401 });
    }

    const tokens = JSON.parse(tokenStr);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        
        // Search for statements
        const res = await gmail.users.messages.list({
            userId: "me",
            q: 'subject:"元大證券電子綜合月對帳單" has:attachment',
            maxResults: 10
        });

        const messages = res.data.messages;
        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: "找不到符合的元大證券對帳單信件" }, { status: 404 });
        }

        const emailList = await Promise.all(messages.map(async (m) => {
            const msg = await gmail.users.messages.get({
                userId: "me",
                id: m.id!,
                format: "metadata",
                metadataHeaders: ["Date"]
            });
            const dateHeader = msg.data.payload?.headers?.find(h => h.name === "Date")?.value;
            return {
                id: m.id,
                snippet: msg.data.snippet,
                date: dateHeader || ""
            };
        }));

        return NextResponse.json({
            emails: emailList
        });
        
    } catch (e: any) {
        console.error("Gmail fetch error:", e);
        if (e.message?.includes("invalid_grant") || e.code === 401 || e.code === 403) {
            return NextResponse.json({ error: "Token 失效，請重新授權", needsAuth: true }, { status: 401 });
        }
        return NextResponse.json({ error: "讀取 Gmail 失敗" }, { status: 500 });
    }
}
