"use client";

import { useEffect, useState } from "react";

interface LendingIncome {
    id: number;
    yearMonth: string;
    etfCode: string;
    etfName: string;
    totalIncome: number;
    fee: number;
    tax: number;
    netIncome: number;
    createdAt: string;
    statement?: { yearMonth: string };
}

export default function LendingPage() {
    const [incomes, setIncomes] = useState<LendingIncome[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalNet, setTotalNet] = useState(0);

    const fetchIncomes = async () => {
        try {
            const res = await fetch("/api/lending");
            const data = await res.json();
            if (res.ok) {
                setIncomes(data.incomes || []);
                setTotalNet(data.totalNetIncome || 0);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIncomes();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm("確定要刪除這筆紀錄嗎？")) return;
        try {
            const res = await fetch(`/api/lending/${id}`, { method: "DELETE" });
            if (res.ok) fetchIncomes();
            else alert("刪除失敗");
        } catch {
            alert("刪除失敗");
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: 40, color: "var(--text-muted)" }}>
                載入中...
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
                        💰 借券收入
                    </h1>
                    <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                        追蹤你的有價證券借貸收入
                    </p>
                </div>
            </div>

            {/* Summary Card */}
            <div className="card" style={{ marginBottom: 32, padding: 24 }}>
                <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>
                    累計淨收入
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    $ {Math.round(totalNet).toLocaleString()}
                </div>
            </div>

            {/* List */}
            <div className="card">
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>
                        收入紀錄
                    </h2>
                </div>

                {incomes.length === 0 ? (
                    <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
                        <div style={{ fontSize: 16, marginBottom: 8 }}>尚無借券收入紀錄</div>
                        <div style={{ fontSize: 14 }}>請至「對帳單」上傳匯入</div>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>對帳單月份</th>
                                    <th>代號</th>
                                    <th>名稱</th>
                                    <th style={{ textAlign: "right" }}>總收入</th>
                                    <th style={{ textAlign: "right" }}>手續費</th>
                                    <th style={{ textAlign: "right" }}>代扣稅</th>
                                    <th style={{ textAlign: "right" }}>淨收入</th>
                                    <th style={{ textAlign: "right" }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incomes.map((inc) => (
                                    <tr key={inc.id}>
                                        <td style={{ color: "var(--text-secondary)" }}>
                                            {inc.statement?.yearMonth || inc.yearMonth}
                                        </td>
                                        <td style={{ fontWeight: 600, color: "var(--accent-blue)" }}>
                                            {inc.etfCode}
                                        </td>
                                        <td style={{ color: "var(--text-secondary)" }}>
                                            {inc.etfName}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {Math.round(inc.totalIncome).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}>
                                            {Math.round(inc.fee).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}>
                                            {Math.round(inc.tax).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--accent-green)" }}>
                                            {Math.round(inc.netIncome).toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <button
                                                onClick={() => handleDelete(inc.id)}
                                                className="btn btn-secondary btn-sm"
                                                style={{ color: "var(--accent-red)", borderColor: "transparent", background: "transparent" }}
                                            >
                                                刪除
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
