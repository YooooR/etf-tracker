import { NextResponse } from "next/server";
import { getOAuth2Client, GMAIL_SCOPES } from "@/lib/googleAuth";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const oauth2Client = getOAuth2Client();
    const authorizeUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: GMAIL_SCOPES,
        prompt: "consent",
    });

    return NextResponse.redirect(authorizeUrl);
}
