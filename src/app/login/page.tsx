"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
            const body = isRegister
                ? { username, password, displayName }
                : { username, password };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "操作失敗");
                return;
            }

            router.push("/dashboard");
            router.refresh();
        } catch {
            setError("網路錯誤，請稍後再試");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                    "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%), var(--bg-primary)",
            }}
        >
            <div
                className="animate-fade-in"
                style={{
                    width: "100%",
                    maxWidth: 420,
                    padding: "0 20px",
                }}
            >
                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 56,
                            height: 56,
                            borderRadius: 16,
                            background: "var(--gradient-primary)",
                            marginBottom: 16,
                            fontSize: 24,
                        }}
                    >
                        📈
                    </div>
                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            background: "var(--gradient-primary)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            marginBottom: 4,
                        }}
                    >
                        ETF Tracker
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                        你的 ETF 交易紀錄管理平台
                    </p>
                </div>

                {/* Form */}
                <div className="card-static" style={{ padding: 28 }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: 20 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "var(--text-secondary)",
                                    marginBottom: 6,
                                }}
                            >
                                帳號
                            </label>
                            <input
                                className="input"
                                type="text"
                                placeholder="請輸入帳號"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "var(--text-secondary)",
                                    marginBottom: 6,
                                }}
                            >
                                密碼
                            </label>
                            <input
                                className="input"
                                type="password"
                                placeholder="請輸入密碼"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {isRegister && (
                            <div style={{ marginBottom: 20 }}>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        color: "var(--text-secondary)",
                                        marginBottom: 6,
                                    }}
                                >
                                    顯示名稱
                                </label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="請輸入顯示名稱"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>
                        )}

                        {error && (
                            <div
                                style={{
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    background: "rgba(239,68,68,0.1)",
                                    border: "1px solid rgba(239,68,68,0.2)",
                                    color: "var(--accent-red)",
                                    fontSize: 13,
                                    marginBottom: 20,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={loading}
                            style={{ width: "100%", padding: "12px", fontSize: 15 }}
                        >
                            {loading ? "處理中..." : isRegister ? "註冊" : "登入"}
                        </button>
                    </form>

                    <div
                        style={{
                            marginTop: 20,
                            textAlign: "center",
                            fontSize: 13,
                            color: "var(--text-muted)",
                        }}
                    >
                        {isRegister ? "已有帳號？" : "還沒有帳號？"}{" "}
                        <button
                            onClick={() => {
                                setIsRegister(!isRegister);
                                setError("");
                            }}
                            style={{
                                background: "none",
                                border: "none",
                                color: "var(--accent-blue)",
                                cursor: "pointer",
                                fontWeight: 500,
                                fontSize: 13,
                            }}
                        >
                            {isRegister ? "登入" : "註冊帳號"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
