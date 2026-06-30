"use client";

import { useState, useCallback, useEffect } from "react";

interface Statement {
    id: number;
    yearMonth: string;
    imageUrls: string;
    parsed: boolean;
    createdAt: string;
}

interface ParsedTransaction {
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
    selected: boolean; // for UI selection
}

interface ParsedHolding {
    etfCode: string;
    etfName: string;
    shares: number;
    marketPrice: number;
    marketValue: number;
}

interface ParsedLending {
    etfCode: string;
    etfName: string;
    totalIncome: number;
    fee: number;
    tax: number;
    netIncome: number;
    selected: boolean;
}

export default function StatementsPage() {
    const [statements, setStatements] = useState<Statement[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [dragover, setDragover] = useState(false);
    const [yearMonth, setYearMonth] = useState(
        new Date().toISOString().substring(0, 7)
    );
    const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

    // Error + retry countdown
    const [parseError, setParseError] = useState<string | null>(null);
    const [retryCountdown, setRetryCountdown] = useState(0);

    // Parse state
    const [parsing, setParsing] = useState(false);
    const [parsedTx, setParsedTx] = useState<ParsedTransaction[]>([]);
    const [parsedHoldings, setParsedHoldings] = useState<ParsedHolding[]>([]);
    const [parsedLending, setParsedLending] = useState<ParsedLending[]>([]);
    const [parseStatementId, setParseStatementId] = useState<number | null>(null);
    const [showParseModal, setShowParseModal] = useState(false);
    const [confirming, setConfirming] = useState(false);

    // Image selection for parse
    const [showSelectModal, setShowSelectModal] = useState(false);
    const [selectImages, setSelectImages] = useState<string[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [selectStatementId, setSelectStatementId] = useState<number | null>(null);
    const [parseMethod, setParseMethod] = useState<"gemini" | "tesseract">("gemini");
    const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");

    // Image preview
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [previewIdx, setPreviewIdx] = useState(0);

    // Gmail & PDF State
    const [gmailLoading, setGmailLoading] = useState(false);
    const [showPdfPasswordModal, setShowPdfPasswordModal] = useState(false);
    const [pdfPassword, setPdfPassword] = useState("");
    const [fetchedPdfBase64, setFetchedPdfBase64] = useState("");
    const [showGmailListModal, setShowGmailListModal] = useState(false);
    const [gmailEmails, setGmailEmails] = useState<{id: string, snippet: string, date: string}[]>([]);

    const fetchStatements = useCallback(async () => {
        try {
            const res = await fetch("/api/statements");
            const data = await res.json();
            setStatements(data.statements || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatements();
    }, [fetchStatements]);

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(t);
        }
    }, [toast]);

    // Countdown timer for rate limit retry
    useEffect(() => {
        if (retryCountdown <= 0) return;
        const t = setInterval(() => {
            setRetryCountdown((prev) => {
                if (prev <= 1) {
                    setParseError(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [retryCountdown]);

    const showToast = useCallback((msg: string, type: string) => setToast({ msg, type }), []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("gmail_auth") === "success") {
            showToast("Gmail 授權成功，請再次點擊匯入按鈕", "success");
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.get("error") === "oauth_failed") {
            showToast("Gmail 授權失敗", "error");
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (urlParams.get("error") === "oauth_rejected") {
            showToast("Gmail 授權被拒絕", "error");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [showToast]);

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);

        const formData = new FormData();
        formData.append("yearMonth", yearMonth);
        for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
        }

        try {
            const res = await fetch("/api/statements/upload", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                showToast("上傳成功", "success");
                fetchStatements();
            } else {
                const data = await res.json();
                showToast(data.error || "上傳失敗", "error");
            }
        } catch {
            showToast("上傳失敗", "error");
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragover(false);
        handleUpload(e.dataTransfer.files);
    };

    // Open image selection modal before parsing
    const openSelectModal = (statementId: number, urls: string[]) => {
        setSelectStatementId(statementId);
        setSelectImages(urls);
        // Default: select all
        setSelectedIndices(urls.map((_, i) => i));
        setShowSelectModal(true);
    };

    const toggleSelectIdx = (idx: number) => {
        setSelectedIndices((prev) =>
            prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
        );
    };

    const handleParse = async (statementId: number, selectedImages?: number[]) => {
        setParsing(true);
        setParseStatementId(statementId);
        setParseError(null);
        setRetryCountdown(0);
        setShowSelectModal(false);

        try {
            const res = await fetch("/api/statements/parse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ statementId, selectedImages, method: parseMethod, geminiModel }),
            });

            const data = await res.json();
            if (!res.ok) {
                if (res.status === 429) {
                    const sec = data.retryAfterSeconds || 60;
                    setParseError(`⚠️ Gemini API 配額已用完`);
                    setRetryCountdown(sec);
                } else {
                    setParseError(`❌ ${data.error || "解析失敗"}`);
                }
                return;
            }

            const txWithSelection = (data.transactions || []).map(
                (tx: Omit<ParsedTransaction, "selected">) => ({
                    ...tx,
                    selected: true,
                })
            );

            setParsedTx(txWithSelection);
            setParsedHoldings(data.holdings || []);
            setParsedLending(
                (data.lendingIncome || []).map(
                    (li: Omit<ParsedLending, "selected">) => ({ ...li, selected: true })
                )
            );
            setParseError(null);
            setParseError(null);
            setShowParseModal(true);
            if (data.model) {
                showToast(`使用 ${data.model} 解析成功`, "success");
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "連線失敗";
            setParseError(`❌ 解析失敗：${msg}`);
        } finally {
            setParsing(false);
        }
    };

    const handleViewAiResult = async (statementId: number) => {
        setParsing(true);
        setParseStatementId(statementId);
        setParseError(null);

        try {
            const res = await fetch(`/api/statements/${statementId}/ai-result`);
            const data = await res.json();

            if (!res.ok) {
                showToast(data.error || "無法取得上次的解析結果", "error");
                setParsing(false);
                return;
            }

            const txWithSelection = (data.transactions || []).map(
                (tx: Omit<ParsedTransaction, "selected">) => ({ ...tx, selected: true })
            );

            setParsedTx(txWithSelection);
            setParsedHoldings(data.holdings || []);
            setParsedLending(
                (data.lendingIncome || []).map(
                    (li: Omit<ParsedLending, "selected">) => ({ ...li, selected: true })
                )
            );

            setShowParseModal(true);
        } catch (err) {
            showToast("無法載入解析結果", "error");
        } finally {
            setParsing(false);
        }
    };

    const handleConfirm = async () => {
        const selected = parsedTx.filter((tx) => tx.selected);
        const selectedLending = parsedLending.filter((li) => li.selected);
        if (selected.length === 0 && selectedLending.length === 0) {
            showToast("請至少選取一筆交易或借券收入", "error");
            return;
        }

        setConfirming(true);

        try {
            const res = await fetch("/api/statements/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    statementId: parseStatementId,
                    transactions: selected.map(({ selected: _, ...rest }) => rest),
                    lendingIncome: selectedLending.map(({ selected: _, ...rest }) => rest),
                }),
            });

            const data = await res.json();
            if (res.ok) {
                showToast(data.message || "匯入成功", "success");
                setShowParseModal(false);
                setParsedTx([]);
                setParsedHoldings([]);
                setParsedLending([]);
                fetchStatements();
            } else {
                showToast(data.error || "匯入失敗", "error");
            }
        } catch {
            showToast("匯入失敗", "error");
        } finally {
            setConfirming(false);
        }
    };

    const handleDelete = async (statementId: number) => {
        if (!confirm("確定要刪除此對帳單？相關的交易紀錄也會一併刪除。")) return;

        try {
            const res = await fetch(`/api/statements/${statementId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                showToast("已刪除", "success");
                fetchStatements();
            } else {
                const data = await res.json();
                showToast(data.error || "刪除失敗", "error");
            }
        } catch {
            showToast("刪除失敗", "error");
        }
    };

    const toggleTx = (idx: number) => {
        setParsedTx((prev) =>
            prev.map((tx, i) => (i === idx ? { ...tx, selected: !tx.selected } : tx))
        );
    };

    const toggleAll = () => {
        const allSelected = parsedTx.every((tx) => tx.selected);
        setParsedTx((prev) => prev.map((tx) => ({ ...tx, selected: !allSelected })));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateTxField = (idx: number, field: string, value: any) => {
        setParsedTx((prev) =>
            prev.map((tx, i) => (i === idx ? { ...tx, [field]: value } : tx))
        );
    };

    const openImagePreview = (imageUrls: string[]) => {
        setPreviewImages(imageUrls);
        setPreviewIdx(0);
        setShowPreview(true);
    };

    const handleGmailImport = async () => {
        setGmailLoading(true);
        try {
            const res = await fetch("/api/gmail/statements");
            if (res.status === 401) {
                const data = await res.json();
                if (data.needsAuth) {
                    window.location.href = "/api/auth/google";
                    return;
                }
            }
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "讀取失敗");
            }
            const data = await res.json();
            setGmailEmails(data.emails || []);
            setShowGmailListModal(true);
        } catch (e: any) {
            showToast(e.message || "讀取 Gmail 失敗", "error");
        } finally {
            setGmailLoading(false);
        }
    };

    const handleSelectEmail = async (messageId: string) => {
        setGmailLoading(true);
        try {
            const res = await fetch("/api/gmail/statements/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "下載附件失敗");
            }
            const data = await res.json();
            setFetchedPdfBase64(data.pdfBase64);
            setPdfPassword("");
            setShowGmailListModal(false);
            setShowPdfPasswordModal(true);
        } catch(e: any) {
            showToast(e.message || "下載附件失敗", "error");
        } finally {
            setGmailLoading(false);
        }
    };

    const handlePdfDecrypt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pdfPassword) {
            showToast("請輸入密碼", "error");
            return;
        }
        setGmailLoading(true);

        try {
            const pdfjsLib = await import("pdfjs-dist");
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

            const pdfData = atob(fetchedPdfBase64.replace(/-/g, '+').replace(/_/g, '/'));
            const uint8Array = new Uint8Array(pdfData.length);
            for (let i = 0; i < pdfData.length; i++) {
                uint8Array[i] = pdfData.charCodeAt(i);
            }

            const loadingTask = pdfjsLib.getDocument({
                data: uint8Array,
                password: pdfPassword,
            });

            const pdf = await loadingTask.promise;
            
            // Yuanta statements normally have transactions on page 2.
            const pageNum = pdf.numPages >= 2 ? 2 : 1; 
            const page = await pdf.getPage(pageNum);

            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context!,
                viewport: viewport,
            }).promise;

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    showToast("影像轉換失敗", "error");
                    setGmailLoading(false);
                    return;
                }
                const file = new File([blob], "statement_page2.png", { type: "image/png" });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                
                setShowPdfPasswordModal(false);
                setFetchedPdfBase64("");
                await handleUpload(dataTransfer.files);
                setGmailLoading(false);
            }, "image/png", 1.0);

        } catch (e: any) {
            console.error(e);
            if (e.name === "PasswordException") {
                showToast("密碼錯誤，請重新輸入", "error");
            } else {
                showToast("PDF 解析失敗: " + (e.message || ""), "error");
            }
            setGmailLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>對帳單管理</h1>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    上傳對帳單圖片，AI 自動解析交易明細
                </p>
            </div>

            {/* Upload area */}
            <div className="card-static" style={{ padding: 24, marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
                    <div>
                        <label style={labelStyle}>對帳期間</label>
                        <input
                            className="input"
                            type="month"
                            value={yearMonth}
                            onChange={(e) => setYearMonth(e.target.value)}
                            style={{ width: 200 }}
                        />
                    </div>
                    <button 
                        className="btn btn-secondary" 
                        onClick={handleGmailImport}
                        disabled={gmailLoading || uploading}
                    >
                        {gmailLoading ? "⏳ 處理中..." : "📧 從 Gmail 選擇信件匯入"}
                    </button>
                </div>

                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragover(true);
                    }}
                    onDragLeave={() => setDragover(false)}
                    onDrop={handleDrop}
                    style={{
                        border: `2px dashed ${dragover ? "var(--accent-blue)" : "var(--border-color)"}`,
                        borderRadius: 12,
                        padding: 48,
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        background: dragover ? "rgba(59,130,246,0.05)" : "transparent",
                    }}
                    onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.multiple = true;
                        input.onchange = () => handleUpload(input.files);
                        input.click();
                    }}
                >
                    <div style={{ fontSize: 40, marginBottom: 12 }}>
                        {uploading ? "⏳" : "📄"}
                    </div>
                    <p style={{ color: "var(--text-secondary)", marginBottom: 4 }}>
                        {uploading ? "上傳中..." : "拖放對帳單圖片到此處，或點擊選擇"}
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        支援 JPG、PNG 格式，可多張上傳
                    </p>
                </div>
            </div>

            {/* History */}
            <div className="card-static" style={{ overflow: "hidden" }}>
                <div
                    style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--border-color)",
                        fontWeight: 600,
                        fontSize: 16,
                    }}
                >
                    上傳紀錄
                </div>

                {loading ? (
                    <div style={{ padding: 40 }}>
                        <div className="loading-shimmer" style={{ height: 200, borderRadius: 8 }} />
                    </div>
                ) : statements.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                        尚無上傳紀錄
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>對帳期間</th>
                                <th>圖片數</th>
                                <th>解析狀態</th>
                                <th>上傳時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statements.map((s) => {
                                const urls = JSON.parse(s.imageUrls || "[]") as string[];
                                return (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 600 }}>{s.yearMonth}</td>
                                        <td>{urls.length} 張</td>
                                        <td>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: s.parsed
                                                        ? "rgba(16,185,129,0.15)"
                                                        : "rgba(245,158,11,0.15)",
                                                    color: s.parsed
                                                        ? "var(--accent-green)"
                                                        : "var(--accent-yellow)",
                                                }}
                                            >
                                                {s.parsed ? "已解析" : "待解析"}
                                            </span>
                                        </td>
                                        <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                                            {new Date(s.createdAt).toLocaleString("zh-TW")}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => openImagePreview(urls)}
                                                >
                                                    👁️ 檢視原圖
                                                </button>
                                                {s.parsed ? (
                                                    <>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => handleViewAiResult(s.id)}
                                                            disabled={parsing}
                                                        >
                                                            {parsing && parseStatementId === s.id ? "⏳ 載入中..." : "📊 上次解析結果"}
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => openSelectModal(s.id, urls)}
                                                            title="重新跑一次 AI 解析 (耗費 API 額度)"
                                                            disabled={parsing}
                                                        >
                                                            🔄 重新 AI 解析
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => openSelectModal(s.id, urls)}
                                                        disabled={parsing}
                                                    >
                                                        {parsing && parseStatementId === s.id ? "🔄 解析中..." : "🤖 執行 AI 解析"}
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ background: "rgba(239,68,68,0.1)", color: "var(--accent-red)", border: "1px solid rgba(239,68,68,0.2)" }}
                                                    onClick={() => handleDelete(s.id)}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Gmail Email List Modal */}
            {showGmailListModal && (
                <div className="modal-overlay" onClick={() => setShowGmailListModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600 }}>📥 選擇要匯入的對帳單信件</h2>
                            <button style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }} onClick={() => setShowGmailListModal(false)}>✕</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
                            {gmailEmails.length === 0 ? (
                                <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>目前沒有找到符合的信件，請確認關鍵字是否相符</div>
                            ) : (
                                gmailEmails.map(email => (
                                    <div key={email.id} style={{ padding: 12, border: "1px solid var(--border-color)", borderRadius: 8, cursor: "pointer", background: "var(--bg-card)" }} 
                                        onClick={() => handleSelectEmail(email.id)}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ fontWeight: 600, color: "var(--accent-blue)" }}>{email.date}</span>
                                        </div>
                                        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: email.snippet }} />
                                    </div>
                                ))
                            )}
                        </div>
                        {gmailLoading && <div style={{ marginTop: 16, textAlign: "center", color: "var(--accent-yellow)", fontWeight: 600 }}>⏳ 下載附件中...</div>}
                    </div>
                </div>
            )}

            {/* Gmail PDF Password Modal */}
            {showPdfPasswordModal && (
                <div className="modal-overlay" onClick={() => setShowPdfPasswordModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>🔐 解鎖對帳單 PDF</h2>
                        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
                            已從 Gmail 成功下載。請輸入解鎖密碼（元大證券通常為身分證字號）。
                            <br />
                            <small style={{ color: "var(--accent-red)" }}>注意：處理全在瀏覽器端進行，密碼不會傳輸到伺服器。</small>
                        </p>
                        <form onSubmit={handlePdfDecrypt}>
                            <input
                                type="password"
                                className="input"
                                placeholder="身分證字號或其他密碼"
                                value={pdfPassword}
                                onChange={(e) => setPdfPassword(e.target.value)}
                                required
                                autoFocus
                            />
                            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPdfPasswordModal(false)}>
                                    取消
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={gmailLoading}>
                                    {gmailLoading ? "解密中..." : "解密並匯入"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Parse Error Banner */}
            {parseError && (
                <div
                    style={{
                        marginTop: 16,
                        padding: "16px 20px",
                        borderRadius: 10,
                        background: retryCountdown > 0
                            ? "rgba(245,158,11,0.1)"
                            : "rgba(239,68,68,0.1)",
                        border: `1px solid ${retryCountdown > 0 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)"}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                    }}
                >
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>{parseError}</p>
                        {retryCountdown > 0 && (
                            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                ⏳ 可於 <span style={{ color: "var(--accent-yellow)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{retryCountdown}</span> 秒後重試
                                （免費版 Gemini API 每分鐘有請求次數上限）
                            </p>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {retryCountdown <= 0 && parseStatementId && (
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                    const s = statements.find((st) => st.id === parseStatementId);
                                    if (s) openSelectModal(s.id, JSON.parse(s.imageUrls || "[]"));
                                }}
                                disabled={parsing}
                            >
                                🔄 重試
                            </button>
                        )}
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setParseError(null); setRetryCountdown(0); }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Image Selection Modal */}
            {showSelectModal && (
                <div className="modal-overlay" onClick={() => setShowSelectModal(false)}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 720, width: "95%" }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600 }}>
                                📋 選擇要解析的頁面
                            </h2>
                            <button
                                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }}
                                onClick={() => setShowSelectModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                            💡 只選擇含交易明細的頁面（通常是第 2、3 頁），跳過總覽、借貸、信託等頁面，可大幅減少 API 用量
                        </p>

                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                            gap: 12,
                            marginBottom: 20,
                        }}>
                            {selectImages.map((url, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => toggleSelectIdx(idx)}
                                    style={{
                                        border: selectedIndices.includes(idx)
                                            ? "2px solid var(--accent-blue)"
                                            : "2px solid var(--border-color)",
                                        borderRadius: 10,
                                        padding: 6,
                                        cursor: "pointer",
                                        opacity: selectedIndices.includes(idx) ? 1 : 0.4,
                                        transition: "all 0.15s ease",
                                        position: "relative",
                                    }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={url}
                                        alt={`第 ${idx + 1} 頁`}
                                        style={{
                                            width: "100%",
                                            height: 160,
                                            objectFit: "cover",
                                            borderRadius: 6,
                                        }}
                                    />
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 6,
                                        padding: "6px 0 2px",
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIndices.includes(idx)}
                                            onChange={() => toggleSelectIdx(idx)}
                                            style={{ cursor: "pointer" }}
                                        />
                                        第 {idx + 1} 頁
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Method selector */}
                        <div style={{
                            display: "flex",
                            flexDirection: "column" as const,
                            gap: 10,
                            marginBottom: 16,
                            padding: 14,
                            borderRadius: 10,
                            background: "var(--bg-main)",
                            border: "1px solid var(--border-color)",
                        }}>
                            <div style={{ display: "flex", gap: 10 }}>
                                <button
                                    onClick={() => setParseMethod("gemini")}
                                    style={{
                                        flex: 1,
                                        padding: "10px 12px",
                                        borderRadius: 8,
                                        border: parseMethod === "gemini" ? "2px solid var(--accent-blue)" : "1px solid var(--border-color)",
                                        background: parseMethod === "gemini" ? "rgba(59,130,246,0.1)" : "transparent",
                                        cursor: "pointer",
                                        textAlign: "left" as const,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>🤖 Gemini AI</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>高精度，需 API 配額</div>
                                </button>
                                <button
                                    onClick={() => setParseMethod("tesseract")}
                                    style={{
                                        flex: 1,
                                        padding: "10px 12px",
                                        borderRadius: 8,
                                        border: parseMethod === "tesseract" ? "2px solid var(--accent-green)" : "1px solid var(--border-color)",
                                        background: parseMethod === "tesseract" ? "rgba(16,185,129,0.1)" : "transparent",
                                        cursor: "pointer",
                                        textAlign: "left" as const,
                                        color: "var(--text-primary)",
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>📝 Tesseract OCR</div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>本地執行，無限次</div>
                                </button>
                            </div>
                            {parseMethod === "gemini" && (
                                <select
                                    value={geminiModel}
                                    onChange={(e) => setGeminiModel(e.target.value)}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: 8,
                                        border: "1px solid var(--border-color)",
                                        background: "var(--bg-card)",
                                        color: "var(--text-primary)",
                                        fontSize: 13,
                                        cursor: "pointer",
                                    }}
                                >
                                    <option value="gemini-2.5-flash">🚀 gemini-2.5-flash（精確，20 RPD）</option>
                                    <option value="gemini-2.5-flash-lite">💨 gemini-2.5-flash-lite（快速，20 RPD）</option>
                                </select>
                            )}
                        </div>

                        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowSelectModal(false)}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleParse(selectStatementId!, selectedIndices)}
                                disabled={selectedIndices.length === 0}
                            >
                                {parseMethod === "gemini" ? "🤖" : "📝"} 解析選取的 {selectedIndices.length} 頁
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Parse Results Modal */}
            {showParseModal && (
                <div className="modal-overlay" onClick={() => setShowParseModal(false)}>
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 900, width: "95%" }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 600 }}>
                                🤖 AI 解析結果
                            </h2>
                            <button
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                    fontSize: 20,
                                }}
                                onClick={() => setShowParseModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Transactions */}
                        {parsedTx.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
                                        交易明細 ({parsedTx.filter((t) => t.selected).length}/{parsedTx.length} 已選取)
                                    </h3>
                                    <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
                                        {parsedTx.every((t) => t.selected) ? "取消全選" : "全選"}
                                    </button>
                                </div>
                                <div style={{ overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: 8 }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40 }}>✓</th>
                                                <th>日期</th>
                                                <th>代號</th>
                                                <th>名稱</th>
                                                <th>買/賣</th>
                                                <th style={{ textAlign: "right" }}>股數</th>
                                                <th style={{ textAlign: "right" }}>單價</th>
                                                <th style={{ textAlign: "right" }}>金額</th>
                                                <th style={{ textAlign: "right" }}>手續費</th>
                                                <th style={{ textAlign: "right" }}>稅</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedTx.map((tx, idx) => {
                                                const inputStyle = {
                                                    background: "transparent",
                                                    border: "1px solid var(--border-color)",
                                                    borderRadius: 4,
                                                    color: "var(--text-primary)",
                                                    padding: "4px 6px",
                                                    fontSize: 13,
                                                    fontVariantNumeric: "tabular-nums" as const,
                                                    width: "100%",
                                                };
                                                return (
                                                    <tr
                                                        key={idx}
                                                        style={{ opacity: tx.selected ? 1 : 0.4 }}
                                                    >
                                                        <td>
                                                            <input
                                                                type="checkbox"
                                                                checked={tx.selected}
                                                                onChange={() => toggleTx(idx)}
                                                                style={{ cursor: "pointer" }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="date"
                                                                value={tx.date || ""}
                                                                onChange={(e) => updateTxField(idx, "date", e.target.value)}
                                                                style={{ ...inputStyle, width: 130 }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                value={tx.etfCode || ""}
                                                                onChange={(e) => updateTxField(idx, "etfCode", e.target.value)}
                                                                style={{ ...inputStyle, width: 70, fontWeight: 600, color: "var(--accent-blue)" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                value={tx.etfName || ""}
                                                                onChange={(e) => updateTxField(idx, "etfName", e.target.value)}
                                                                style={{ ...inputStyle, width: 110, color: "var(--text-secondary)" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td>
                                                            <select
                                                                value={tx.action || "BUY"}
                                                                onChange={(e) => updateTxField(idx, "action", e.target.value)}
                                                                style={{ ...inputStyle, width: 65, cursor: "pointer" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <option value="BUY">買入</option>
                                                                <option value="SELL">賣出</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                value={tx.shares ?? ""}
                                                                onChange={(e) => updateTxField(idx, "shares", parseInt(e.target.value) || 0)}
                                                                style={{ ...inputStyle, width: 75, textAlign: "right" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={tx.price ?? ""}
                                                                onChange={(e) => updateTxField(idx, "price", parseFloat(e.target.value) || 0)}
                                                                style={{ ...inputStyle, width: 80, textAlign: "right" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                value={tx.amount ?? ""}
                                                                onChange={(e) => updateTxField(idx, "amount", parseInt(e.target.value) || 0)}
                                                                style={{ ...inputStyle, width: 85, textAlign: "right" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                value={tx.fee ?? 0}
                                                                onChange={(e) => updateTxField(idx, "fee", parseInt(e.target.value) || 0)}
                                                                style={{ ...inputStyle, width: 55, textAlign: "right" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="number"
                                                                value={tx.tax ?? 0}
                                                                onChange={(e) => updateTxField(idx, "tax", parseInt(e.target.value) || 0)}
                                                                style={{ ...inputStyle, width: 55, textAlign: "right" }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Holdings */}
                        {parsedHoldings.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
                                    庫存明細（僅供參考）
                                </h3>
                                <div style={{ overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: 8 }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>代號</th>
                                                <th>名稱</th>
                                                <th style={{ textAlign: "right" }}>庫存股數</th>
                                                <th style={{ textAlign: "right" }}>參考價</th>
                                                <th style={{ textAlign: "right" }}>市值</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedHoldings.map((h, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ fontWeight: 600, color: "var(--accent-blue)" }}>
                                                        {h.etfCode}
                                                    </td>
                                                    <td style={{ color: "var(--text-secondary)" }}>{h.etfName}</td>
                                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                        {h.shares?.toLocaleString()}
                                                    </td>
                                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                        {h.marketPrice?.toFixed(2) || "—"}
                                                    </td>
                                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                                        {h.marketValue?.toLocaleString() || "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Lending Income */}
                        {parsedLending.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
                                        💰 借券收入 ({parsedLending.filter((l) => l.selected).length}/{parsedLending.length} 已選取)
                                    </h3>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => {
                                            setParsedLending((prev) => [
                                                ...prev,
                                                { etfCode: "", etfName: "", totalIncome: 0, fee: 0, tax: 0, netIncome: 0, selected: true }
                                            ]);
                                        }}>
                                            + 新增一筆
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => {
                                            const allSel = parsedLending.every((l) => l.selected);
                                            setParsedLending((prev) => prev.map((l) => ({ ...l, selected: !allSel })));
                                        }}>
                                            {parsedLending.every((l) => l.selected) ? "取消全選" : "全選"}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: 8 }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40 }}>✓</th>
                                                <th>代號</th>
                                                <th>名稱</th>
                                                <th style={{ textAlign: "right" }}>收入合計</th>
                                                <th style={{ textAlign: "right" }}>手續費</th>
                                                <th style={{ textAlign: "right" }}>代扣稅</th>
                                                <th style={{ textAlign: "right" }}>淨收入</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedLending.map((li, idx) => {
                                                const liStyle: React.CSSProperties = {
                                                    background: "transparent",
                                                    border: "1px solid var(--border-color)",
                                                    borderRadius: 4,
                                                    color: "var(--text-primary)",
                                                    padding: "4px 6px",
                                                    fontSize: 13,
                                                    fontVariantNumeric: "tabular-nums",
                                                    width: "100%",
                                                };
                                                const upd = (field: string, val: string | number | boolean) =>
                                                    setParsedLending((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: val } : l)));
                                                return (
                                                    <tr key={idx} style={{ opacity: li.selected ? 1 : 0.4 }}>
                                                        <td><input type="checkbox" checked={li.selected} onChange={() => upd("selected", !li.selected)} style={{ cursor: "pointer" }} /></td>
                                                        <td><input value={li.etfCode || ""} onChange={(e) => upd("etfCode", e.target.value)} style={{ ...liStyle, width: 70, fontWeight: 600, color: "var(--accent-blue)" }} /></td>
                                                        <td><input value={li.etfName || ""} onChange={(e) => upd("etfName", e.target.value)} style={{ ...liStyle, width: 110, color: "var(--text-secondary)" }} /></td>
                                                        <td><input type="number" step="0.01" value={li.totalIncome ?? 0} onChange={(e) => upd("totalIncome", parseFloat(e.target.value) || 0)} style={{ ...liStyle, width: 85, textAlign: "right" }} /></td>
                                                        <td><input type="number" step="0.01" value={li.fee ?? 0} onChange={(e) => upd("fee", parseFloat(e.target.value) || 0)} style={{ ...liStyle, width: 65, textAlign: "right" }} /></td>
                                                        <td><input type="number" step="0.01" value={li.tax ?? 0} onChange={(e) => upd("tax", parseFloat(e.target.value) || 0)} style={{ ...liStyle, width: 65, textAlign: "right" }} /></td>
                                                        <td><input type="number" step="0.01" value={li.netIncome ?? 0} onChange={(e) => upd("netIncome", parseFloat(e.target.value) || 0)} style={{ ...liStyle, width: 85, textAlign: "right", fontWeight: 600, color: "var(--accent-green)" }} /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {parsedTx.length === 0 && parsedHoldings.length === 0 && parsedLending.length === 0 && (
                            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                                <p style={{ fontSize: 40, marginBottom: 12 }}>🤷</p>
                                <p>此圖片中未找到交易明細</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowParseModal(false)}
                            >
                                取消
                            </button>
                            {(parsedTx.length > 0 || parsedLending.length > 0) && (
                                <button
                                    className="btn btn-primary"
                                    onClick={handleConfirm}
                                    disabled={confirming || (parsedTx.filter((t) => t.selected).length === 0 && parsedLending.filter((l) => l.selected).length === 0)}
                                >
                                    {confirming
                                        ? "匯入中..."
                                        : `確認匯入 ${parsedTx.filter((t) => t.selected).length > 0 ? `(${parsedTx.filter((t) => t.selected).length}筆交易)` : ''} ${parsedLending.filter((l) => l.selected).length > 0 ? `(${parsedLending.filter((l) => l.selected).length}筆借券)` : ''}`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {showPreview && previewImages.length > 0 && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowPreview(false)}
                    style={{ cursor: "zoom-out" }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: "relative",
                            maxWidth: "90vw",
                            maxHeight: "90vh",
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={previewImages[previewIdx]}
                            alt="對帳單"
                            style={{
                                maxWidth: "90vw",
                                maxHeight: "85vh",
                                objectFit: "contain",
                                borderRadius: 8,
                            }}
                        />
                        {previewImages.length > 1 && (
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    gap: 8,
                                    marginTop: 12,
                                }}
                            >
                                {previewImages.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setPreviewIdx(idx)}
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            border: idx === previewIdx ? "2px solid var(--accent-blue)" : "1px solid var(--border-color)",
                                            background: idx === previewIdx ? "var(--accent-blue)" : "var(--bg-card)",
                                            color: "white",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {idx + 1}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => setShowPreview(false)}
                            style={{
                                position: "absolute",
                                top: -12,
                                right: -12,
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "var(--bg-card)",
                                border: "1px solid var(--border-color)",
                                color: "var(--text-primary)",
                                cursor: "pointer",
                                fontSize: 16,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            ✕
                        </button>
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
