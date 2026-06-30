"use client";

import { useEffect, useState, useCallback } from "react";
import { formatTWD, formatPercent } from "@/lib/calculations";

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

const defaultForm = {
    etfCode: "",
    etfName: "",
    exDate: "",
    paymentDate: "",
    cashDividend: "",
    stockDividend: "0",
    shares: "",
    totalAmount: "",
};

export default function DividendsPage() {
    const [dividends, setDividends] = useState<Dividend[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
    const [activeTab, setActiveTab] = useState<"record" | "market-info">("record");

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/dividends");
            const data = await res.json();
            setDividends(data.dividends || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    const showToast = (msg: string, type: string) => setToast({ msg, type });

    const updateField = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch("/api/dividends", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    cashDividend: Number(form.cashDividend),
                    stockDividend: Number(form.stockDividend),
                    shares: Number(form.shares),
                    totalAmount: Number(form.totalAmount),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || "操作失敗", "error");
                return;
            }

            showToast("已新增", "success");
            setShowModal(false);
            setForm(defaultForm);
            fetchData();
        } catch {
            showToast("操作失敗", "error");
        } finally {
            setSaving(false);
        }
    };

    // Group by ETF
    const grouped = dividends.reduce(
        (acc, d) => {
            if (!acc[d.etfCode]) acc[d.etfCode] = { name: d.etfName, items: [], total: 0 };
            acc[d.etfCode].items.push(d);
            acc[d.etfCode].total += d.totalAmount;
            return acc;
        },
        {} as Record<string, { name: string; items: Dividend[]; total: number }>
    );

    const totalDividends = dividends.reduce((sum, d) => sum + d.totalAmount, 0);

    return (
        <div className="animate-fade-in">
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                }}
            >
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>股利紀錄</h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                        歷年股利收入：
                        <span style={{ color: "var(--accent-yellow)", fontWeight: 600 }}>
                            {formatTWD(totalDividends)}
                        </span>
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    ＋ 新增股利
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid var(--border-color)", paddingBottom: 16 }}>
                <button
                    className={`btn ${activeTab === "record" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setActiveTab("record")}
                >
                    📝 個人紀錄
                </button>
                <button
                    className={`btn ${activeTab === "market-info" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setActiveTab("market-info")}
                >
                    🔍 除權息查詢
                </button>
            </div>

            {activeTab === "record" ? (
                <>
                    {loading ? (
                        <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
                    ) : dividends.length === 0 ? (
                        <div
                            className="card-static"
                            style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}
                        >
                            <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
                            <p>尚無股利紀錄</p>
                            <button
                                className="btn btn-primary"
                                style={{ marginTop: 16 }}
                                onClick={() => setShowModal(true)}
                            >
                                新增第一筆
                            </button>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([code, group]) => (
                            <div key={code} className="card-static" style={{ marginBottom: 16, overflow: "hidden" }}>
                                <div
                                    style={{
                                        padding: "12px 20px",
                                        background: "var(--bg-secondary)",
                                        borderBottom: "1px solid var(--border-color)",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                >
                                    <span style={{ fontWeight: 600 }}>
                                        <span style={{ color: "var(--accent-blue)" }}>{code}</span> {group.name}
                                    </span>
                                    <span style={{ color: "var(--accent-yellow)", fontSize: 13 }}>
                                        累計 {formatTWD(group.total)}
                                    </span>
                                </div>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>除權息日</th>
                                            <th>發放日</th>
                                            <th style={{ textAlign: "right" }}>現金股利/股</th>
                                            <th style={{ textAlign: "right" }}>股票股利/股</th>
                                            <th style={{ textAlign: "right" }}>持有股數</th>
                                            <th style={{ textAlign: "right" }}>實收金額</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.items.map((d) => (
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    )}
                </>
            ) : (
                <MarketDividendTab />
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>新增股利紀錄</h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                    <label style={labelStyle}>證券代號</label>
                                    <input
                                        className="input"
                                        placeholder="0056"
                                        value={form.etfCode}
                                        onChange={(e) => updateField("etfCode", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>證券名稱</label>
                                    <input
                                        className="input"
                                        placeholder="元大高股息"
                                        value={form.etfName}
                                        onChange={(e) => updateField("etfName", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>除權息日</label>
                                    <input
                                        className="input"
                                        type="date"
                                        value={form.exDate}
                                        onChange={(e) => updateField("exDate", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>發放日</label>
                                    <input
                                        className="input"
                                        type="date"
                                        value={form.paymentDate}
                                        onChange={(e) => updateField("paymentDate", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>現金股利/股</label>
                                    <input
                                        className="input"
                                        type="number"
                                        step="0.0001"
                                        value={form.cashDividend}
                                        onChange={(e) => updateField("cashDividend", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>股票股利/股</label>
                                    <input
                                        className="input"
                                        type="number"
                                        step="0.0001"
                                        value={form.stockDividend}
                                        onChange={(e) => updateField("stockDividend", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>持有股數</label>
                                    <input
                                        className="input"
                                        type="number"
                                        value={form.shares}
                                        onChange={(e) => updateField("shares", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>實收金額</label>
                                    <input
                                        className="input"
                                        type="number"
                                        value={form.totalAmount}
                                        onChange={(e) => updateField("totalAmount", e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    取消
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? "儲存中..." : "新增"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

// Subcomponent: Market Dividend Info Search
function MarketDividendTab() {
    const [holdings, setHoldings] = useState<{ etfCode: string; etfName: string }[]>([]);
    const [selectedCode, setSelectedCode] = useState<string>("");
    const [infoData, setInfoData] = useState<any>(null);
    const [loadingInfo, setLoadingInfo] = useState(false);
    const [summaryData, setSummaryData] = useState<any[]>([]);
    const [loadingSummary, setLoadingSummary] = useState(true);

    useEffect(() => {
        // Fetch user holdings to populate the dropdown
        fetch("/api/holdings")
            .then(res => res.json())
            .then(data => {
                if (data.holdings && data.holdings.length > 0) {
                    setHoldings(data.holdings);
                    setSelectedCode(data.holdings[0].etfCode);
                }
            })
            .catch(console.error);

        // Fetch summary 
        fetch("/api/dividends/summary")
            .then(res => res.json())
            .then(data => {
                if (data.summary) {
                    setSummaryData(data.summary);
                }
            })
            .catch(console.error)
            .finally(() => setLoadingSummary(false));
    }, []);

    useEffect(() => {
        if (!selectedCode) return;
        setLoadingInfo(true);
        setInfoData(null);
        fetch(`/api/dividends/info?etfCode=${selectedCode}`)
            .then(res => res.json())
            .then(data => {
                setInfoData(data);
            })
            .catch(console.error)
            .finally(() => setLoadingInfo(false));
    }, [selectedCode]);

    return (
        <div className="animate-fade-in">
            {/* Holdings Summary Table */}
            <div className="card-static" style={{ overflow: "hidden", marginBottom: 32 }}>
                <div
                    style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border-color)",
                    }}
                >
                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>持倉總表：近期除權息資訊</h2>
                </div>
                {loadingSummary ? (
                    <div style={{ padding: 40, textAlign: "center" }}>
                        <div className="loading-shimmer" style={{ height: 100, borderRadius: 8 }} />
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>代號</th>
                                    <th>名稱</th>
                                    <th>最新除權息日</th>
                                    <th>最新股利發放日</th>
                                    <th style={{ textAlign: "right" }}>現金股利</th>
                                    <th style={{ textAlign: "right" }}>股票股利</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryData.map((item, idx) => {
                                    let isCurrentMonth = false;
                                    if (item.latestEvent && item.latestEvent.exDate) {
                                        const now = new Date();
                                        const d = new Date(item.latestEvent.exDate.replace(/-/g, '/'));
                                        if (!isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
                                            isCurrentMonth = true;
                                        }
                                    }
                                    return (
                                        <tr key={idx} onClick={() => setSelectedCode(item.etfCode)} style={{ cursor: "pointer" }} title="點擊查看詳細">
                                            <td style={{ color: "var(--accent-blue)", fontWeight: 600 }}>{item.etfCode}</td>
                                            <td>{item.etfName}</td>
                                            {item.latestEvent ? (
                                                <>
                                                    <td>
                                                        <span style={isCurrentMonth ? {
                                                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                            color: 'var(--accent-yellow)',
                                                            padding: '4px 8px',
                                                            borderRadius: '6px',
                                                            fontWeight: 600
                                                        } : { fontWeight: 500 }}>
                                                            {item.latestEvent.exDate}
                                                        </span>
                                                    </td>
                                                    <td>{item.latestEvent.paymentDate}</td>
                                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--accent-yellow)" }}>
                                                        {item.latestEvent.cashDividend.toFixed(4)}
                                                    </td>
                                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                        {item.latestEvent.stockDividend.toFixed(4)}
                                                    </td>
                                                </>
                                            ) : (
                                                <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>
                                                    近期無資料
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {summaryData.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>
                                            目前無持倉紀錄
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>個別查詢</h2>
            
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <span style={{ fontWeight: 500 }}>選擇持倉 ETF：</span>
                <select 
                    className="input" 
                    style={{ width: 250, cursor: "pointer" }}
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                >
                    {holdings.map(h => (
                        <option key={h.etfCode} value={h.etfCode}>
                            {h.etfCode} {h.etfName}
                        </option>
                    ))}
                    {holdings.length === 0 && (
                        <option value="">(無發現持倉)</option>
                    )}
                </select>
            </div>

            {loadingInfo && (
                <div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }}></div>
            )}

            {!loadingInfo && infoData && !infoData.error && (
                <div className="animate-fade-in">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                        <div className="card-static" style={{ padding: "20px" }}>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, fontWeight: 500 }}>
                                年度總股利 (預估)
                            </p>
                            <p style={{ fontSize: 28, fontWeight: 700, color: "var(--accent-yellow)", fontVariantNumeric: "tabular-nums" }}>
                                {infoData.totalCashDividend.toFixed(3)} <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-muted)" }}>元/股</span>
                            </p>
                        </div>
                        <div className="card-static" style={{ padding: "20px" }}>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, fontWeight: 500 }}>
                                股票股利總計
                            </p>
                            <p style={{ fontSize: 28, fontWeight: 700, color: "var(--accent-primary)", fontVariantNumeric: "tabular-nums" }}>
                                {infoData.totalStockDividend.toFixed(3)} <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-muted)" }}>元/股</span>
                            </p>
                        </div>
                        <div className="card-static" style={{ padding: "20px", position: "relative", overflow: "hidden" }}>
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "var(--gradient-primary)" }} />
                            <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, fontWeight: 500 }}>
                                年度殖利率
                            </p>
                            <p style={{ fontSize: 28, fontWeight: 700, color: "var(--accent-green)", fontVariantNumeric: "tabular-nums" }}>
                                {formatPercent(infoData.annualYield)}
                            </p>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                                依目前股價：{infoData.currentPrice > 0 ? infoData.currentPrice.toFixed(2) : "—"}
                            </p>
                        </div>
                    </div>

                    <div className="card-static" style={{ overflow: "hidden" }}>
                        <div
                            style={{
                                padding: "16px 20px",
                                borderBottom: "1px solid var(--border-color)",
                            }}
                        >
                            <h2 style={{ fontSize: 16, fontWeight: 600 }}>{infoData.year} 年除權息明細</h2>
                        </div>
                        
                        {infoData.events && infoData.events.length > 0 ? (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>除權息日</th>
                                        <th>股利發放日</th>
                                        <th style={{ textAlign: "right" }}>現金股利 (元)</th>
                                        <th style={{ textAlign: "right" }}>股票股利 (元)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {infoData.events.map((ev: any, idx: number) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 500 }}>{ev.exDate}</td>
                                            <td style={{ color: "var(--text-muted)" }}>{ev.paymentDate}</td>
                                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--accent-yellow)" }}>
                                                {ev.cashDividend.toFixed(4)}
                                            </td>
                                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                {ev.stockDividend.toFixed(4)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                                尚無該年度除權息資料
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!loadingInfo && infoData?.error && (
                <div className="card-static" style={{ padding: 40, textAlign: "center", color: "var(--accent-red)" }}>
                    {infoData.error}
                </div>
            )}
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-muted)",
    marginBottom: 6,
};
