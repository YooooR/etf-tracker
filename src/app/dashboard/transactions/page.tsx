"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

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

const defaultForm = {
    date: new Date().toISOString().split("T")[0],
    etfCode: "",
    etfName: "",
    action: "BUY",
    shares: "",
    price: "",
    fee: "0",
    tax: "0",
};

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

    // Excel Import State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showImport, setShowImport] = useState(false);
    const [importData, setImportData] = useState<{ transactions: any[]; dividends: any[]; lendingIncomes: any[] }>({ transactions: [], dividends: [], lendingIncomes: [] });
    const [importForm, setImportForm] = useState({ etfCode: "", etfName: "" });
    const [importing, setImporting] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/transactions");
            const data = await res.json();
            setTransactions(data.transactions || []);
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

    const openAdd = () => {
        setForm(defaultForm);
        setEditId(null);
        setShowModal(true);
    };

    const openEdit = (tx: Transaction) => {
        setForm({
            date: tx.date.split("T")[0],
            etfCode: tx.etfCode,
            etfName: tx.etfName,
            action: tx.action,
            shares: String(tx.shares),
            price: String(tx.price),
            fee: String(tx.fee),
            tax: String(tx.tax),
        });
        setEditId(tx.id);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const shares = Number(form.shares);
        const price = Number(form.price);
        const fee = Number(form.fee);
        const tax = Number(form.tax);
        const amount = shares * price;
        const netAmount =
            form.action === "BUY"
                ? -(amount + fee)
                : amount - fee - tax;

        const body = {
            ...form,
            shares,
            price,
            fee,
            tax,
            amount,
            netAmount,
        };

        try {
            const url = editId
                ? `/api/transactions/${editId}`
                : "/api/transactions";
            const method = editId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || "操作失敗", "error");
                return;
            }

            showToast(editId ? "已更新" : "已新增", "success");
            setShowModal(false);
            fetchData();
        } catch {
            showToast("操作失敗", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("確定要刪除這筆交易？")) return;

        try {
            const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
            if (res.ok) {
                showToast("已刪除", "success");
                fetchData();
            }
        } catch {
            showToast("刪除失敗", "error");
        }
    };

    const updateField = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            // Read with cellDates to automatically convert Excel serial dates to JS Dates
            const wb = XLSX.read(data, { cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

            const txs: any[] = [];
            const divs: any[] = [];
            const lends: any[] = [];

            for (const row of rows) {
                const dateCell = row[0];
                if (!dateCell) continue;

                // Check if it looks like a date (either Date object or YYYY/MM/DD string)
                let dateStr = "";
                if (dateCell instanceof Date) {
                    // Extract local year, month, date to avoid UTC timezone off-by-one shifts
                    const y = dateCell.getFullYear();
                    const m = String(dateCell.getMonth() + 1).padStart(2, "0");
                    const d = String(dateCell.getDate()).padStart(2, "0");
                    dateStr = `${y}-${m}-${d}`;
                } else if (typeof dateCell === "string" && /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(dateCell.trim())) {
                    dateStr = dateCell.trim().replace(/\//g, "-");
                } else {
                    continue; // Not a data row
                }

                const price = Number(row[1]) || 0;
                const shares = Number(row[2]) || 0;
                const amount = Number(row[3]) || 0;
                // const lendingShares = Number(row[4]) || 0;
                const lendingIncome = Number(row[5]) || 0;
                const cashDividend = Number(row[6]) || 0;
                const stockDividend = Number(row[7]) || 0;
                const fee = Number(row[8]) || 0;

                // 1. Transaction (Buy)
                if (price > 0 && shares > 0) {
                    txs.push({
                        date: dateStr,
                        action: "BUY",
                        price,
                        shares,
                        amount,
                        fee,
                        tax: 0,
                        netAmount: -(amount + fee)
                    });
                }

                // 2. Lending Income
                if (lendingIncome > 0) {
                    lends.push({
                        date: dateStr,
                        totalIncome: lendingIncome,
                        fee: 0, // Fee may be mixed, assuming 0 for isolated lending income or separate in source
                        tax: 0,
                        netIncome: lendingIncome
                    });
                }

                // 3. Dividend
                if (cashDividend > 0 || stockDividend > 0) {
                    divs.push({
                        date: dateStr,
                        cashDividend,
                        stockDividend,
                        shares: 0 // Cannot easily deduce exact shares for dividend from this row format alone
                    });
                }
            }

            if (txs.length === 0 && divs.length === 0 && lends.length === 0) {
                showToast("未能從檔案中解析出任何紀錄", "error");
                return;
            }

            setImportData({ transactions: txs, dividends: divs, lendingIncomes: lends });
            setImportForm({ etfCode: "", etfName: "" });
            setShowImport(true);

        } catch (err) {
            console.error(err);
            showToast("檔案讀取失敗", "error");
        } finally {
            // reset file input
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setImporting(true);
        try {
            const res = await fetch("/api/import/excel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    etfCode: importForm.etfCode,
                    etfName: importForm.etfName,
                    ...importData
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || "匯入失敗", "error");
                return;
            }

            showToast("匯入成功", "success");
            setShowImport(false);
            fetchData();
        } catch (err) {
            showToast("連線失敗", "error");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                }}
            >
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                        交易紀錄
                    </h1>
                    <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                        所有買賣交易明細
                    </p>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <input type="file" ref={fileInputRef} hidden accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                    <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                        📥 匯入 Excel
                    </button>
                    <button className="btn btn-primary" onClick={openAdd}>
                        ＋ 新增交易
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="card-static" style={{ overflow: "hidden" }}>
                {loading ? (
                    <div style={{ padding: 40 }}>
                        <div className="loading-shimmer" style={{ height: 300, borderRadius: 8 }} />
                    </div>
                ) : transactions.length === 0 ? (
                    <div
                        style={{
                            padding: 60,
                            textAlign: "center",
                            color: "var(--text-muted)",
                        }}
                    >
                        <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                        <p>尚無交易紀錄</p>
                        <button
                            className="btn btn-primary"
                            style={{ marginTop: 16 }}
                            onClick={openAdd}
                        >
                            新增第一筆
                        </button>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>日期</th>
                                    <th>代號</th>
                                    <th>名稱</th>
                                    <th>買/賣</th>
                                    <th style={{ textAlign: "right" }}>股數</th>
                                    <th style={{ textAlign: "right" }}>單價</th>
                                    <th style={{ textAlign: "right" }}>成交金額</th>
                                    <th style={{ textAlign: "right" }}>手續費</th>
                                    <th style={{ textAlign: "right" }}>交易稅</th>
                                    <th style={{ textAlign: "right" }}>淨收付</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => (
                                    <tr key={tx.id}>
                                        <td>{tx.date.split("T")[0]}</td>
                                        <td style={{ fontWeight: 600, color: "var(--accent-blue)" }}>
                                            {tx.etfCode}
                                        </td>
                                        <td style={{ color: "var(--text-secondary)" }}>
                                            {tx.etfName}
                                        </td>
                                        <td>
                                            <span className={tx.action === "BUY" ? "badge badge-buy" : "badge badge-sell"}>
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
                                        <td>
                                            <div style={{ display: "flex", gap: 4 }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => openEdit(tx)}
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() => handleDelete(tx.id)}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>
                            {editId ? "編輯交易" : "新增交易"}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                    <label style={labelStyle}>日期</label>
                                    <input
                                        className="input"
                                        type="date"
                                        value={form.date}
                                        onChange={(e) => updateField("date", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>買/賣</label>
                                    <select
                                        className="input"
                                        value={form.action}
                                        onChange={(e) => updateField("action", e.target.value)}
                                    >
                                        <option value="BUY">買入</option>
                                        <option value="SELL">賣出</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>證券代號</label>
                                    <input
                                        className="input"
                                        placeholder="例: 0056"
                                        value={form.etfCode}
                                        onChange={(e) => updateField("etfCode", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>證券名稱</label>
                                    <input
                                        className="input"
                                        placeholder="例: 元大高股息"
                                        value={form.etfName}
                                        onChange={(e) => updateField("etfName", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>股數</label>
                                    <input
                                        className="input"
                                        type="number"
                                        placeholder="1000"
                                        value={form.shares}
                                        onChange={(e) => updateField("shares", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>單價</label>
                                    <input
                                        className="input"
                                        type="number"
                                        step="0.01"
                                        placeholder="36.70"
                                        value={form.price}
                                        onChange={(e) => updateField("price", e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>手續費</label>
                                    <input
                                        className="input"
                                        type="number"
                                        value={form.fee}
                                        onChange={(e) => updateField("fee", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>交易稅</label>
                                    <input
                                        className="input"
                                        type="number"
                                        value={form.tax}
                                        onChange={(e) => updateField("tax", e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Preview */}
                            {form.shares && form.price && (
                                <div
                                    style={{
                                        marginTop: 16,
                                        padding: "12px 16px",
                                        background: "var(--bg-secondary)",
                                        borderRadius: 8,
                                        fontSize: 13,
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    成交金額：{(Number(form.shares) * Number(form.price)).toLocaleString()} TWD
                                </div>
                            )}

                            <div
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    marginTop: 24,
                                    justifyContent: "flex-end",
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? "儲存中..." : editId ? "更新" : "新增"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import Data Modal */}
            {showImport && (
                <div className="modal-overlay" onClick={() => !importing && setShowImport(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Excel 匯入預覽</h2>

                        <div style={{ padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: 8, marginBottom: 20 }}>
                            <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "var(--text-secondary)" }}>已從檔案解析出：</p>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                                <li>{importData.transactions.length} 筆 交易紀錄</li>
                                <li>{importData.dividends.length} 筆 股利紀錄</li>
                                <li>{importData.lendingIncomes.length} 筆 借券收入紀錄</li>
                            </ul>
                        </div>

                        <form onSubmit={handleImportSubmit}>
                            <p style={{ fontSize: 13, color: "var(--accent-yellow)", marginBottom: 12 }}>
                                ⚠️ 請輸入這批紀錄所屬的 ETF 代號與名稱，系統將一併套用。
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                                <div>
                                    <label style={labelStyle}>證券代號</label>
                                    <input
                                        className="input"
                                        placeholder="例: 0056"
                                        value={importForm.etfCode}
                                        onChange={(e) => setImportForm(prev => ({ ...prev, etfCode: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>證券名稱</label>
                                    <input
                                        className="input"
                                        placeholder="例: 元大高股息"
                                        value={importForm.etfName}
                                        onChange={(e) => setImportForm(prev => ({ ...prev, etfName: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowImport(false)} disabled={importing}>
                                    取消
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={importing || !importForm.etfCode || !importForm.etfName}>
                                    {importing ? "匯入中..." : "確認匯入"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
                    {toast.msg}
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
