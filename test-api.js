const https = require('https');

function fetchFinMind(stock_id) {
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividend&data_id=${stock_id}&start_date=2024-01-01`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', (d) => data += d);
    res.on('end', () => {
      console.log(data.substring(0, 1000));
    });
  }).on('error', console.error);
}

fetchFinMind('00878');
