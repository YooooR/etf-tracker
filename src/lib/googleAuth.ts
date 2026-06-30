import { google } from "googleapis";

export function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    const redirectUri = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") + "/api/auth/google/callback";

    return new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );
}

export const GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly"
];
