// Annualized return calculation utilities

import { differenceInDays } from "date-fns";

interface HoldingCalcInput {
    transactions: {
        date: Date;
        action: "BUY" | "SELL";
        shares: number;
        price: number;
        fee: number;
        tax: number;
        netAmount: number;
    }[];
    dividends: {
        totalAmount: number;
    }[];
    currentPrice: number;
}

export interface HoldingStats {
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

export function calculateHoldingStats(input: HoldingCalcInput): HoldingStats {
    const { transactions, dividends, currentPrice } = input;

    let totalShares = 0;
    let totalCost = 0;
    let realizedPnl = 0;
    let avgCost = 0;
    let earliestDate: Date | null = null;

    // Sort transactions by date
    const sorted = [...transactions].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
    );

    for (const tx of sorted) {
        if (!earliestDate) earliestDate = tx.date;

        if (tx.action === "BUY") {
            totalCost += tx.shares * tx.price + tx.fee;
            totalShares += tx.shares;
            avgCost = totalShares > 0 ? totalCost / totalShares : 0;
        } else {
            // SELL
            const sellCost = avgCost * tx.shares;
            const sellProceeds = tx.shares * tx.price - tx.fee - tx.tax;
            realizedPnl += sellProceeds - sellCost;
            totalCost -= sellCost;
            totalShares -= tx.shares;
        }
    }

    const marketValue = totalShares * currentPrice;
    const unrealizedPnl = marketValue - totalCost;
    const totalDividends = dividends.reduce((sum, d) => sum + d.totalAmount, 0);
    const totalPnl = unrealizedPnl + realizedPnl + totalDividends;

    // Annualized return
    const totalInvested = sorted
        .filter((t) => t.action === "BUY")
        .reduce((sum, t) => sum + t.shares * t.price + t.fee, 0);

    const daysHeld = earliestDate
        ? differenceInDays(new Date(), earliestDate)
        : 0;

    const yearsHeld = daysHeld / 365;

    let annualizedReturnWithDiv = 0;
    let annualizedReturnWithoutDiv = 0;

    if (totalInvested > 0 && yearsHeld > 0) {
        const totalReturnWithDiv =
            (unrealizedPnl + realizedPnl + totalDividends) / totalInvested;
        const totalReturnWithoutDiv =
            (unrealizedPnl + realizedPnl) / totalInvested;

        annualizedReturnWithDiv =
            (Math.pow(1 + totalReturnWithDiv, 1 / yearsHeld) - 1) * 100;
        annualizedReturnWithoutDiv =
            (Math.pow(1 + totalReturnWithoutDiv, 1 / yearsHeld) - 1) * 100;
    }

    return {
        totalShares,
        totalCost,
        avgCost,
        marketValue,
        unrealizedPnl,
        realizedPnl,
        totalDividends,
        totalPnl,
        annualizedReturnWithDiv,
        annualizedReturnWithoutDiv,
    };
}

/**
 * Generate Google Calendar event URL for ex-dividend date
 */
export function generateGoogleCalendarUrl(params: {
    title: string;
    date: Date;
    description?: string;
}): string {
    const { title, date, description } = params;
    const dateStr = date.toISOString().replace(/[-:]/g, "").split("T")[0];
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().replace(/[-:]/g, "").split("T")[0];

    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", title);
    url.searchParams.set("dates", `${dateStr}/${nextDayStr}`);
    if (description) url.searchParams.set("details", description);

    return url.toString();
}

/**
 * Format number as TWD currency
 */
export function formatTWD(value: number): string {
    return new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: "TWD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
