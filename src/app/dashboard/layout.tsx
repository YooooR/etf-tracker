"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
    id: number;
    username: string;
    displayName: string;
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((d) => setUser(d.user))
            .catch(() => { });
    }, []);

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    };

    const navItems = [
        { href: "/dashboard", label: "總覽", icon: "📊" },
        { href: "/dashboard/transactions", label: "交易紀錄", icon: "📝" },
        { href: "/dashboard/lending", label: "借券收入", icon: "💰" },
        { href: "/dashboard/dividends", label: "股利紀錄", icon: "💸" },
        { href: "/dashboard/statements", label: "對帳單", icon: "📄" },
    ];

    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>
            {/* Sidebar */}
            <aside
                style={{
                    width: 240,
                    background: "var(--bg-secondary)",
                    borderRight: "1px solid var(--border-color)",
                    display: "flex",
                    flexDirection: "column",
                    position: "fixed",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    zIndex: 40,
                }}
            >
                {/* Logo */}
                <div
                    style={{
                        padding: "20px 20px",
                        borderBottom: "1px solid var(--border-color)",
                    }}
                >
                    <Link
                        href="/dashboard"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            textDecoration: "none",
                        }}
                    >
                        <span
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: "var(--gradient-primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                            }}
                        >
                            📈
                        </span>
                        <span
                            style={{
                                fontSize: 18,
                                fontWeight: 700,
                                background: "var(--gradient-primary)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            ETF Tracker
                        </span>
                    </Link>
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: "12px 10px" }}>
                    {navItems.map((item) => {
                        const active = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 14px",
                                    borderRadius: 8,
                                    marginBottom: 4,
                                    textDecoration: "none",
                                    fontSize: 14,
                                    fontWeight: active ? 600 : 400,
                                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                                    background: active ? "var(--bg-card)" : "transparent",
                                    transition: "all 0.15s ease",
                                }}
                            >
                                <span style={{ fontSize: 18 }}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* User */}
                <div
                    style={{
                        padding: "16px",
                        borderTop: "1px solid var(--border-color)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "var(--text-primary)",
                                }}
                            >
                                {user?.displayName || "載入中..."}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                @{user?.username || "..."}
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: "none",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                fontSize: 18,
                                padding: 4,
                            }}
                            title="登出"
                        >
                            🚪
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main
                style={{
                    flex: 1,
                    marginLeft: 240,
                    padding: "24px 32px",
                    minHeight: "100vh",
                }}
            >
                {children}
            </main>
        </div>
    );
}
