"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import { formatTWD, formatPercent, generateGoogleCalendarUrl } from "@/lib/calculations";

interface Transaction {
    id: number;
    date: string;
    etfCode: string;
    etfName: string;
    action: string;
    shares: number;
    price: number;
    amount: number;
    fee: number;
    tax: number;
    netAmount: number;
}

interface Dividend {
    id: number;
    etfCode: string;
    etfName: string;
    exDate: string;
    paymentDate: string;
    cashDividend: number;
    stockDividend: number;
    shares: number;
    totalAmount: number;
}

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

export default function ETFDetailPage({
    params,
}: {
    params: Promise<{ etfCode: string }>;
}) {
    const { etfCode } = use(params);
    const code = decodeURIComponent(etfCode);

    const [holding, setHolding] = useState<Holding | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [dividends, setDividends] = useState<Dividend[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"transactions" | "dividends">("transactions");

    const fetchData = useCallback(async () => {
        try {
            const [holdingRes, txRes, divRes] = await Promise.all([
                fetch(`/api/holdings?etfCode=${code}`),
                fetch(`/api/transactions?etfCode=${code}`),
                fetch(`/api/dividends?etfCode=${code}`),
            ]);

            const holdingData = await holdingRes.json();
            const txData = await txRes.json();
            const divData = await divRes.json();

            setHolding(holdingData.holdings?.[0] || null);
            setTransactions(txData.transactions || []);
            setDividends(divData.dividends || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [code]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Group transactions by month
    const groupedByMonth = transactions.reduce(
        (acc, tx) => {
            const month = tx.date.substring(0, 7); // "2025-12"
            if (!acc[month]) acc[month] = [];
            acc[month].push(tx);
            return acc;
        },
        {} as Record<string, Transaction[]>
    );

    const sortedMonths = Object.keys(groupedByMonth).sort().reverse();

    if (loading) {
        return (
            <div style={{ padding: 40 }}>
                <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                    <a
                        href="/dashboard"
                        style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 14 }}
                    >
                        ← 返回總覽
                    </a>
                </div>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                    <span style={{ color: "var(--accent-blue)" }}>{code}</span>{" "}
                    {holding?.etfName || ""}
                </h1>
            </div>

            {/* Stats */}
            {holding && (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: 16,
                        marginBottom: 28,
                    }}
                >
                    <StatCard label="持有股數" value={holding.totalShares.toLocaleString()} />
                    <StatCard label="平均成本" value={`$${holding.avgCost.toFixed(2)}`} />
                    <StatCard
                        label="目前股價"
                        value={holding.currentPrice > 0 ? `$${holding.currentPrice.toFixed(2)}` : "—"}
                    />
                    <StatCard
                        label="未實現損益"
                        value={formatTWD(holding.unrealizedPnl)}
                        color={holding.unrealizedPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
                    />
                    <StatCard
                        label="年化報酬(含息)"
                        value={formatPercent(holding.annualizedReturnWithDiv)}
                        color={
                            holding.annualizedReturnWithDiv >= 0 ? "var(--accent-green)" : "var(--accent-red)"
                        }
                    />
                </div>
            )}

            {/* Tabs */}
            <div
                style={{
                    display: "flex",
                    gap: 4,
                    marginBottom: 20,
                    borderBottom: "1px solid var(--border-color)",
                }}
            >
                <TabButton
                    active={activeTab === "transactions"}
                    onClick={() => setActiveTab("transactions")}
                    label={`交易明細 (${transactions.length})`}
                />
                <TabButton
                    active={activeTab === "dividends"}
                    onClick={() => setActiveTab("dividends")}
                    label={`股利紀錄 (${dividends.length})`}
                />
            </div>

            {/* Transactions tab */}
            {activeTab === "transactions" && (
                <div>
                    {sortedMonths.length === 0 ? (
                        <div
                            className="card-static"
                            style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}
                        >
                            尚無交易紀錄
                        </div>
                    ) : (
                        sortedMonths.map((month) => (
                            <div key={month} className="card-static" style={{ marginBottom: 16, overflow: "hidden" }}>
                                <div
                                    style={{
                                        padding: "12px 20px",
                                        background: "var(--bg-secondary)",
                                        fontWeight: 600,
                                        fontSize: 14,
                                        borderBottom: "1px solid var(--border-color)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <span>{month}</span>
                                    <span style={{ color: "var(--text-muted)" }}>
                                        {groupedByMonth[month].length} 筆交易
                                    </span>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>日期</th>
                                            <th>買/賣</th>
                                            <th style={{ textAlign: "right" }}>股數</th>
                                            <th style={{ textAlign: "right" }}>單價</th>
                                            <th style={{ textAlign: "right" }}>成交金額</th>
                                            <th style={{ textAlign: "right" }}>手續費</th>
                                            <th style={{ textAlign: "right" }}>交易稅</th>
                                            <th style={{ textAlign: "right" }}>淨收付</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedByMonth[month].map((tx) => (
                                            <tr key={tx.id}>
                                                <td>{tx.date.split("T")[0]}</td>
                                                <td>
                                                    <span
                                                        className={tx.action === "BUY" ? "badge badge-buy" : "badge badge-sell"}
                                                    >
                                                        {tx.action === "BUY" ? "買入" : "賣出"}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                    {tx.shares.toLocaleString()}
                                                </td>
                                                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                    {tx.price.toFixed(2)}
                                                </td>
                                                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                    {tx.amount.toLocaleString()}
                                                </td>
                                                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                    {tx.fee}
                                                </td>
                                                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                    {tx.tax}
                                                </td>
                                                <td
                                                    style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                                                    className={tx.netAmount >= 0 ? "text-profit" : "text-loss"}
                                                >
                                                    {tx.netAmount.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Dividends tab */}
            {activeTab === "dividends" && (
                <div className="card-static" style={{ overflow: "hidden" }}>
                    {dividends.length === 0 ? (
                        <div
                            style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}
                        >
                            尚無股利紀錄
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>除權息日</th>
                                    <th>發放日</th>
                                    <th style={{ textAlign: "right" }}>現金股利/股</th>
                                    <th style={{ textAlign: "right" }}>股票股利/股</th>
                                    <th style={{ textAlign: "right" }}>持有股數</th>
                                    <th style={{ textAlign: "right" }}>實收金額</th>
                                    <th>加入日曆</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dividends.map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.exDate.split("T")[0]}</td>
                                        <td>{d.paymentDate.split("T")[0]}</td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {d.cashDividend.toFixed(4)}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {d.stockDividend.toFixed(4)}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {d.shares.toLocaleString()}
                                        </td>
                                        <td
                                            style={{
                                                textAlign: "right",
                                                color: "var(--accent-yellow)",
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {formatTWD(d.totalAmount)}
                                        </td>
                                        <td>
                                            <a
                                                href={generateGoogleCalendarUrl({
                                                    title: `${code} ${d.etfName} 除權息日`,
                                                    date: new Date(d.exDate),
                                                    description: `現金股利: ${d.cashDividend}/股, 持有: ${d.shares}股, 預計收入: ${formatTWD(d.totalAmount)}`,
                                                })}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-secondary btn-sm"
                                            >
                                                📅 加入日曆
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

function StatCard({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color?: string;
}) {
    return (
        <div className="card-static" style={{ padding: 16 }}>
            <p
                style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                }}
            >
                {label}
            </p>
            <p
                style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: color || "var(--text-primary)",
                }}
            >
                {value}
            </p>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                background: "none",
                border: "none",
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--accent-blue)" : "var(--text-muted)",
                cursor: "pointer",
                borderBottom: active ? "2px solid var(--accent-blue)" : "2px solid transparent",
                marginBottom: -1,
                transition: "all 0.2s ease",
            }}
        >
            {label}
        </button>
    );
}
