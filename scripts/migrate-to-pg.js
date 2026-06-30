/**
 * 資料轉移腳本：SQLite -> PostgreSQL
 * 用法：
 *   1. 在 .env.local 加入 DATABASE_URL (Render PostgreSQL 連線字串)
 *   2. 執行：node --env-file=.env.local scripts/migrate-to-pg.js
 *
 * 注意：此腳本需要同時能讀到 SQLite (dev.db) 與 PostgreSQL (DATABASE_URL)
 * 執行完後，本機的 .env.local 可以直接使用新的 DATABASE_URL
 */

const { PrismaClient: PgClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

const pgPrisma = new PgClient();
const sqlite = new Database(path.join(__dirname, '../prisma/dev.db'), { readonly: true });

async function main() {
    console.log('🚀 開始資料轉移：SQLite -> PostgreSQL...\n');

    // 1. Users
    const users = sqlite.prepare('SELECT * FROM User').all();
    console.log(`📦 找到 ${users.length} 位使用者`);
    for (const u of users) {
        await pgPrisma.user.upsert({
            where: { username: u.username },
            update: {},
            create: {
                id: u.id,
                username: u.username,
                passwordHash: u.passwordHash,
                displayName: u.displayName,
                createdAt: new Date(u.createdAt),
            },
        });
    }
    console.log(`✅ Users 轉移完成\n`);

    // 2. Statements
    const statements = sqlite.prepare('SELECT * FROM Statement').all();
    console.log(`📦 找到 ${statements.length} 筆對帳單`);
    for (const s of statements) {
        await pgPrisma.statement.upsert({
            where: { id: s.id },
            update: {},
            create: {
                id: s.id,
                userId: s.userId,
                yearMonth: s.yearMonth,
                imageUrls: s.imageUrls || '[]',
                parsed: Boolean(s.parsed),
                aiResult: s.aiResult || null,
                createdAt: new Date(s.createdAt),
            },
        });
    }
    console.log(`✅ Statements 轉移完成\n`);

    // 3. Transactions
    const transactions = sqlite.prepare('SELECT * FROM "Transaction"').all();
    console.log(`📦 找到 ${transactions.length} 筆交易紀錄`);
    for (const t of transactions) {
        await pgPrisma.transaction.upsert({
            where: { id: t.id },
            update: {},
            create: {
                id: t.id,
                userId: t.userId,
                statementId: t.statementId || null,
                date: new Date(t.date),
                etfCode: t.etfCode,
                etfName: t.etfName,
                action: t.action,
                shares: t.shares,
                price: t.price,
                amount: t.amount,
                fee: t.fee || 0,
                tax: t.tax || 0,
                netAmount: t.netAmount || 0,
                createdAt: new Date(t.createdAt),
            },
        });
    }
    console.log(`✅ Transactions 轉移完成\n`);

    // 4. Dividends
    const dividends = sqlite.prepare('SELECT * FROM "Dividend"').all();
    console.log(`📦 找到 ${dividends.length} 筆股利紀錄`);
    for (const d of dividends) {
        await pgPrisma.dividend.upsert({
            where: { id: d.id },
            update: {},
            create: {
                id: d.id,
                userId: d.userId,
                etfCode: d.etfCode,
                etfName: d.etfName,
                exDate: new Date(d.exDate),
                paymentDate: new Date(d.paymentDate),
                cashDividend: d.cashDividend || 0,
                stockDividend: d.stockDividend || 0,
                shares: d.shares,
                totalAmount: d.totalAmount || 0,
                createdAt: new Date(d.createdAt),
            },
        });
    }
    console.log(`✅ Dividends 轉移完成\n`);

    // 5. LendingIncomes
    const lendingIncomes = sqlite.prepare('SELECT * FROM "LendingIncome"').all();
    console.log(`📦 找到 ${lendingIncomes.length} 筆借券收入`);
    for (const l of lendingIncomes) {
        await pgPrisma.lendingIncome.upsert({
            where: { id: l.id },
            update: {},
            create: {
                id: l.id,
                userId: l.userId,
                statementId: l.statementId || null,
                yearMonth: l.yearMonth,
                etfCode: l.etfCode,
                etfName: l.etfName,
                totalIncome: l.totalIncome || 0,
                fee: l.fee || 0,
                tax: l.tax || 0,
                netIncome: l.netIncome || 0,
                createdAt: new Date(l.createdAt),
            },
        });
    }
    console.log(`✅ LendingIncomes 轉移完成\n`);

    console.log('🎉 全部資料轉移成功！');
}

main()
    .catch(e => {
        console.error('❌ 轉移失敗：', e);
        process.exit(1);
    })
    .finally(async () => {
        await pgPrisma.$disconnect();
        sqlite.close();
    });
