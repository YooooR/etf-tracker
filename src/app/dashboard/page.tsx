"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatTWD, formatPercent } from "@/lib/calculations";

interface Holding {
    etfCode: string;
    etfName: string;
    currentPrice: number;
    totalShares: number;
    totalCost: number;
    avgCost: number;
    marketValue: number;
    unrealizedPnl: number;
    realizedPnl: number;
    totalDividends: number;
    totalPnl: number;
    annualizedReturnWithDiv: number;
    annualizedReturnWithoutDiv: number;
}

export default function DashboardPage() {
    const [holdings, setHoldings] = useState<Holding[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHoldings = useCallback(async () => {
        try {
            const res = await fetch("/api/holdings");
            const data = await res.json();
            setHoldings(data.holdings || []);
        } catch (e) {
            console.error("Failed to fetch holdings:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHoldings();
    }, [fetchHoldings]);

    // Totals
    const totals = holdings.reduce(
        (acc, h) => ({
            totalCost: acc.totalCost + h.totalCost,
            marketValue: acc.marketValue + h.marketValue,
            unrealizedPnl: acc.unrealizedPnl + h.unrealizedPnl,
            realizedPnl: acc.realizedPnl + h.realizedPnl,
            totalDividends: acc.totalDividends + h.totalDividends,
            totalPnl: acc.totalPnl + h.totalPnl,
        }),
        {
            totalCost: 0,
            marketValue: 0,
            unrealizedPnl: 0,
            realizedPnl: 0,
            totalDividends: 0,
            totalPnl: 0,
        }
    );

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                    投資總覽
                </h1>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    所有 ETF 持倉彙總
                </p>
            </div>

            {/* Stats Cards */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 16,
                    marginBottom: 28,
                }}
            >
                <StatsCard
                    label="總市值"
                    value={formatTWD(totals.marketValue)}
                    icon="💼"
                    gradient="var(--gradient-primary)"
                />
                <StatsCard
                    label="總成本"
                    value={formatTWD(totals.totalCost)}
                    icon="📦"
                />
                <StatsCard
                    label="未實現損益"
                    value={formatTWD(totals.unrealizedPnl)}
                    icon="📈"
                    valueColor={totals.unrealizedPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
                />
                <StatsCard
                    label="股利收入"
                    value={formatTWD(totals.totalDividends)}
                    icon="💰"
                    valueColor="var(--accent-yellow)"
                />
            </div>

            {/* Holdings Table */}
            <div className="card-static" style={{ overflow: "hidden" }}>
                <div
                    style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border-color)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>持倉明細</h2>
                    <Link href="/dashboard/transactions" className="btn btn-primary btn-sm">
                        ＋ 新增交易
                    </Link>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: "center" }}>
                        <div className="loading-shimmer" style={{ height: 200, borderRadius: 8 }} />
                    </div>
                ) : holdings.length === 0 ? (
                    <div
                        style={{
                            padding: 60,
                            textAlign: "center",
                            color: "var(--text-muted)",
                        }}
                    >
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                        <p>尚無交易紀錄</p>
                        <Link
                            href="/dashboard/transactions"
                            className="btn btn-primary"
                            style={{ marginTop: 16 }}
                        >
                            新增第一筆交易
                        </Link>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>代號</th>
                                    <th>名稱</th>
                                    <th style={{ textAlign: "right" }}>持有股數</th>
                                    <th style={{ textAlign: "right" }}>平均成本</th>
                                    <th style={{ textAlign: "right" }}>目前股價</th>
                                    <th style={{ textAlign: "right" }}>總成本</th>
                                    <th style={{ textAlign: "right" }}>市值</th>
                                    <th style={{ textAlign: "right" }}>未實現損益</th>
                                    <th style={{ textAlign: "right" }}>已實現損益</th>
                                    <th style={{ textAlign: "right" }}>股利收入</th>
                                    <th style={{ textAlign: "right" }}>總損益</th>
                                    <th style={{ textAlign: "right" }}>年化(含息)</th>
                                    <th style={{ textAlign: "right" }}>年化(不含息)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {holdings.map((h) => (
                                    <tr key={h.etfCode}>
                                        <td>
                                            <Link
                                                href={`/dashboard/${h.etfCode}`}
                                                style={{
                                                    color: "var(--accent-blue)",
                                                    textDecoration: "none",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {h.etfCode}
                                            </Link>
                                        </td>
                                        <td style={{ color: "var(--text-secondary)" }}>
                                            {h.etfName}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {h.totalShares.toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {h.avgCost.toFixed(2)}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {h.currentPrice > 0 ? h.currentPrice.toFixed(2) : "—"}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {formatTWD(h.totalCost)}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {formatTWD(h.marketValue)}
                                        </td>
                                        <td
                                            style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                            className={h.unrealizedPnl >= 0 ? "text-profit" : "text-loss"}
                                        >
                                            {formatTWD(h.unrealizedPnl)}
                                        </td>
                                        <td
                                            style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                            className={h.realizedPnl >= 0 ? "text-profit" : "text-loss"}
                                        >
                                            {formatTWD(h.realizedPnl)}
                                        </td>
                                        <td
                                            style={{
                                                textAlign: "right",
                                                color: "var(--accent-yellow)",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {formatTWD(h.totalDividends)}
                                        </td>
                                        <td
                                            style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                            className={h.totalPnl >= 0 ? "text-profit" : "text-loss"}
                                        >
                                            {formatTWD(h.totalPnl)}
                                        </td>
                                        <td
                                            style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                            className={
                                                h.annualizedReturnWithDiv >= 0 ? "text-profit" : "text-loss"
                                            }
                                        >
                                            {formatPercent(h.annualizedReturnWithDiv)}
                                        </td>
                                        <td
                                            style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                            className={
                                                h.annualizedReturnWithoutDiv >= 0 ? "text-profit" : "text-loss"
                                            }
                                        >
                                            {formatPercent(h.annualizedReturnWithoutDiv)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Totals row */}
                            <tfoot>
                                <tr
                                    style={{
                                        background: "var(--bg-secondary)",
                                        fontWeight: 600,
                                    }}
                                >
                                    <td colSpan={5}>合計</td>
                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                        {formatTWD(totals.totalCost)}
                                    </td>
                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                        {formatTWD(totals.marketValue)}
                                    </td>
                                    <td
                                        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                        className={totals.unrealizedPnl >= 0 ? "text-profit" : "text-loss"}
                                    >
                                        {formatTWD(totals.unrealizedPnl)}
                                    </td>
                                    <td
                                        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                        className={totals.realizedPnl >= 0 ? "text-profit" : "text-loss"}
                                    >
                                        {formatTWD(totals.realizedPnl)}
                                    </td>
                                    <td
                                        style={{
                                            textAlign: "right",
                                            color: "var(--accent-yellow)",
                                            fontVariantNumeric: "tabular-nums",
                                        }}
                                    >
                                        {formatTWD(totals.totalDividends)}
                                    </td>
                                    <td
                                        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                        className={totals.totalPnl >= 0 ? "text-profit" : "text-loss"}
                                    >
                                        {formatTWD(totals.totalPnl)}
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatsCard({
    label,
    value,
    icon,
    gradient,
    valueColor,
}: {
    label: string;
    value: string;
    icon: string;
    gradient?: string;
    valueColor?: string;
}) {
    return (
        <div
            className="card-static"
            style={{
                padding: "20px",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {gradient && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: gradient,
                    }}
                />
            )}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                }}
            >
                <div>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginBottom: 8,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            fontWeight: 500,
                        }}
                    >
                        {label}
                    </p>
                    <p
                        style={{
                            fontSize: 22,
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            color: valueColor || "var(--text-primary)",
                        }}
                    >
                        {value}
                    </p>
                </div>
                <span style={{ fontSize: 28, opacity: 0.8 }}>{icon}</span>
            </div>
        </div>
    );
}
