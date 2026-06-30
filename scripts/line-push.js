/**
 * LINE Notification Push Script
 * Run with: node --env-file=.env.local scripts/line-push.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!lineToken || lineToken === 'your_line_channel_access_token_here') {
            console.error('Error: Please configure LINE_CHANNEL_ACCESS_TOKEN in .env.local');
            process.exit(1);
        }

        console.log('Fetching unique holdings from database...');
        // Find all distinct holding ETF codes
        const transactions = await prisma.transaction.findMany({
            select: { etfCode: true, etfName: true },
            distinct: ['etfCode']
        });

        if (transactions.length === 0) {
            console.log('No ETF holdings found. Exiting.');
            process.exit(0);
        }

        console.log(`Found ${transactions.length} unique ETFs. Fetching upcoming dividend events...`);

        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        // Normalize dates to YYYY-MM-DD for comparison
        const todayStr = today.toISOString().split('T')[0];
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const nextWeekStr = nextWeek.toISOString().split('T')[0];
        
        const currentYear = today.getFullYear().toString();
        const startDate = `${currentYear}-01-01`;
        const endDate = `${currentYear}-12-31`;

        const upcomingEvents = [];

        await Promise.all(transactions.map(async (t) => {
            try {
                const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividend&data_id=${t.etfCode}&start_date=${startDate}&end_date=${endDate}`;
                const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const json = await res.json();
                
                if (json.status === 200 && json.data) {
                    json.data.forEach(item => {
                        const exDate = item.CashExDividendTradingDate || item.StockExDividendTradingDate || '';
                        const payDate = item.CashDividendPaymentDate || '';
                        
                        const cashDiv = item.CashEarningsDistribution || 0;
                        const stockDiv = item.StockEarningsDistribution || 0;

                        // Check if exDate or payDate is within the next 7 days
                        const isExDateUpcoming = exDate >= todayStr && exDate <= nextWeekStr;
                        const isPayDateUpcoming = payDate >= todayStr && payDate <= nextWeekStr;

                        if (isExDateUpcoming || isPayDateUpcoming) {
                            upcomingEvents.push({
                                code: t.etfCode,
                                name: t.etfName,
                                exDate,
                                payDate,
                                cashDiv,
                                stockDiv,
                                exTarget: isExDateUpcoming,
                                payTarget: isPayDateUpcoming
                            });
                        }
                    });
                }
            } catch (e) {
                console.error(`Error fetching data for ${t.etfCode}:`, e.message);
            }
        }));

        if (upcomingEvents.length === 0) {
            console.log('No upcoming dividend events for the next 7 days. Enjoy your week!');
            process.exit(0);
        }

        // Build Flex Message contents
        const contents = upcomingEvents.map(e => {
            const bodyContents = [];
            
            if (e.exTarget) {
                bodyContents.push({
                    type: 'box',
                    layout: 'horizontal',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'box',
                            layout: 'vertical',
                            backgroundColor: '#e74c3c',
                            cornerRadius: 'sm',
                            paddingAll: '2px',
                            width: '45px',
                            contents: [
                                { type: 'text', text: '除息', color: '#ffffff', size: 'xs', align: 'center', weight: 'bold' }
                            ]
                        },
                        { type: 'text', text: e.exDate, color: '#e74c3c', size: 'sm', weight: 'bold', gravity: 'center' }
                    ]
                });
            }
            
            if (e.payTarget) {
                bodyContents.push({
                    type: 'box',
                    layout: 'horizontal',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'box',
                            layout: 'vertical',
                            backgroundColor: '#2ecc71',
                            cornerRadius: 'sm',
                            paddingAll: '2px',
                            width: '45px',
                            contents: [
                                { type: 'text', text: '發放', color: '#ffffff', size: 'xs', align: 'center', weight: 'bold' }
                            ]
                        },
                        { type: 'text', text: e.payDate, color: '#2ecc71', size: 'sm', weight: 'bold', gravity: 'center' }
                    ]
                });
            }
            
            if (e.cashDiv > 0) {
                bodyContents.push({
                    type: 'box',
                    layout: 'horizontal',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'box',
                            layout: 'vertical',
                            width: '45px',
                            contents: [
                                { type: 'text', text: '現金', color: '#aaaaaa', size: 'xs', align: 'center' }
                            ]
                        },
                        { type: 'text', text: `${e.cashDiv.toFixed(4)}`, color: '#666666', size: 'sm', gravity: 'center' }
                    ]
                });
            }
            
            if (e.stockDiv > 0) {
                bodyContents.push({
                    type: 'box',
                    layout: 'horizontal',
                    spacing: 'md',
                    contents: [
                        {
                            type: 'box',
                            layout: 'vertical',
                            width: '45px',
                            contents: [
                                { type: 'text', text: '股票', color: '#aaaaaa', size: 'xs', align: 'center' }
                            ]
                        },
                        { type: 'text', text: `${e.stockDiv.toFixed(4)}`, color: '#666666', size: 'sm', gravity: 'center' }
                    ]
                });
            }

            return {
                type: 'bubble',
                size: 'micro',
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: e.code,
                            weight: 'bold',
                            color: '#1DB446',
                            size: 'sm'
                        },
                        {
                            type: 'text',
                            text: e.name,
                            weight: 'bold',
                            size: 'md',
                            margin: 'md'
                        },
                        {
                            type: 'separator',
                            margin: 'md'
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            margin: 'md',
                            spacing: 'sm',
                            contents: bodyContents
                        }
                    ]
                }
            };
        });

        // Use carousel if multiple events, else single bubble
        const flexContainer = contents.length > 1 
            ? { type: 'carousel', contents: contents.slice(0, 10) } // LINE carousel limit is 10
            : contents[0];

        // Build urgent text for today/tomorrow ex-dividend and payment
        let urgentText = '';
        upcomingEvents.forEach(e => {
            // 除息提醒
            if (e.exTarget && (e.exDate === todayStr || e.exDate === tomorrowStr)) {
                const dayStr = e.exDate === todayStr ? '今天' : '明天';
                urgentText += `⚠️ 除息提醒：${e.code} ${e.name}\n`;
                urgentText += `📅 ${dayStr} (${e.exDate}) 除息\n`;
                if (e.cashDiv > 0) urgentText += `💵 現金股利：${e.cashDiv.toFixed(4)} 元/股\n`;
                if (e.stockDiv > 0) urgentText += `📈 股票股利：${e.stockDiv.toFixed(4)} 元/股\n`;
                urgentText += '\n';
            }
            // 發放提醒
            if (e.payTarget && (e.payDate === todayStr || e.payDate === tomorrowStr)) {
                const dayStr = e.payDate === todayStr ? '今天' : '明天';
                urgentText += `💰 股息發放提醒：${e.code} ${e.name}\n`;
                urgentText += `📅 ${dayStr} (${e.payDate}) 入帳\n`;
                if (e.cashDiv > 0) urgentText += `💵 現金股利：${e.cashDiv.toFixed(4)} 元/股\n`;
                if (e.stockDiv > 0) urgentText += `📈 股票股利：${e.stockDiv.toFixed(4)} 元/股\n`;
                urgentText += '\n';
            }
        });
        urgentText = urgentText.trim();

        const messagesToSend = [];
        if (urgentText) {
            messagesToSend.push({
                type: 'text',
                text: urgentText
            });
        }
        messagesToSend.push({
            type: 'flex',
            altText: '📢 本週 ETF 除權息提醒',
            contents: flexContainer
        });

        console.log('Sending broadcast Flex message to LINE...');
        
        const lineResponse = await fetch('https://api.line.me/v2/bot/message/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify({
                messages: messagesToSend
            })
        });

        if (!lineResponse.ok) {
            const errBody = await lineResponse.text();
            console.error('Failed to send broadcast:', errBody);
        } else {
            console.log('Broadcast successfully sent!');
        }

    } catch (error) {
        console.error('An unexpected error occurred:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
