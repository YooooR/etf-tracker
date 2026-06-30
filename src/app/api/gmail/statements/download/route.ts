import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/googleAuth";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { google } from "googleapis";

export async function POST(request: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const cookieStore = await cookies();
    const tokenStr = cookieStore.get("google-tokens")?.value;
    if (!tokenStr) {
        return NextResponse.json({ error: "未授權 Gmail 存取", needsAuth: true }, { status: 401 });
    }

    const { messageId } = await request.json();
    if (!messageId) {
        return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
    }

    const tokens = JSON.parse(tokenStr);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    try {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        
        const msg = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
        });

        // Search recursively for the PDF attachment
        let attachmentId = null;
        let filename = "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const findPdf = (part: any) => {
            if (part.filename && part.filename.toLowerCase().endsWith(".pdf")) {
                attachmentId = part.body?.attachmentId;
                filename = part.filename;
                return true;
            }
            if (part.parts) {
                for (const p of part.parts) {
                    if (findPdf(p)) return true;
                }
            }
            return false;
        };

        if (msg.data.payload) {
            findPdf(msg.data.payload);
        }

        if (!attachmentId) {
            return NextResponse.json({ error: "此信件中找不到 PDF 附件 (可能非多媒體附件或格式不符)" }, { status: 404 });
        }

        // Fetch attachment data
        const attachment = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: messageId,
            id: attachmentId
        });

        // Attachment data is Base64URL encoded
        const base64Url = attachment.data.data;
        if (!base64Url) {
            return NextResponse.json({ error: "無法下載附件內容" }, { status: 500 });
        }

        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

        return NextResponse.json({
            filename,
            pdfBase64: base64
        });
        
    } catch (e: any) {
        console.error("Gmail fetch error:", e);
        if (e.message?.includes("invalid_grant") || e.code === 401 || e.code === 403) {
            return NextResponse.json({ error: "Token 失效，請重新授權", needsAuth: true }, { status: 401 });
        }
        return NextResponse.json({ error: "讀取 Gmail 失敗" }, { status: 500 });
    }
}
