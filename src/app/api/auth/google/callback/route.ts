import { NextRequest, NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/googleAuth";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
        return NextResponse.redirect(new URL("/dashboard/statements?error=oauth_rejected", request.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL("/dashboard/statements", request.url));
    }

    try {
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        
        // Store refresh_token and access_token in httpOnly cookie
        const cookieStore = await cookies();
        cookieStore.set({
            name: "google-tokens",
            value: JSON.stringify(tokens),
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return NextResponse.redirect(new URL("/dashboard/statements?gmail_auth=success", request.url));
    } catch (e) {
        console.error("OAuth callback error", e);
        return NextResponse.redirect(new URL("/dashboard/statements?error=oauth_failed", request.url));
    }
}
