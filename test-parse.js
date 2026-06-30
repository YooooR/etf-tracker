const XLSX = require("xlsx");
const fs = require("fs");

const file = fs.readFileSync("test_ledger.csv");
const wb = XLSX.read(file, { type: "buffer", cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];

const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const txs = [];
const divs = [];
const lends = [];

for (const row of rows) {
    const dateCell = row[0];
    if (!dateCell) continue;

    let dateStr = "";
    if (dateCell instanceof Date) {
        dateStr = dateCell.toISOString().split("T")[0];
    } else if (typeof dateCell === "string" && /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(dateCell.trim())) {
        dateStr = dateCell.trim().replace(/\//g, "-");
    } else {
        continue;
    }

    const price = Number(row[1]) || 0;
    const shares = Number(row[2]) || 0;
    const amount = Number(row[3]) || 0;
    const lendingIncome = Number(row[5]) || 0;
    const cashDividend = Number(row[6]) || 0;
    const stockDividend = Number(row[7]) || 0;
    const fee = Number(row[8]) || 0;

    if (price > 0 && shares > 0) {
        txs.push({ date: dateStr, action: "BUY", price, shares, amount, fee, tax: 0, netAmount: -(amount + fee) });
    }
    if (lendingIncome > 0) {
        lends.push({ date: dateStr, totalIncome: lendingIncome, fee: 0, tax: 0, netIncome: lendingIncome });
    }
    if (cashDividend > 0 || stockDividend > 0) {
        divs.push({ date: dateStr, cashDividend, stockDividend, shares: 0 });
    }
}

console.log("Transactions:", txs);
console.log("Dividends:", divs);
console.log("Lending Incomes:", lends);
