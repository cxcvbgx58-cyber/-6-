const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Extended list of tickers based on top market cap and common coins
const TICKERS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "DOT", "LINK", "MATIC",
  "TRX", "LTC", "BCH", "NEAR", "UNI", "ICP", "AVAX", "STX", "ATOM", "XLM",
  "PEPE", "SHIB", "ARB", "OP", "TIA", "SUI", "SEI", "INJ", "RNDR", "FET",
  "FIL", "HBAR", "VET", "KAS", "APT", "IMX", "LDO", "GRT", "MKR", "AAVE"
];

const OUT_DIR = path.resolve(__dirname, '../public/logos');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  try {
    const { data: coinList } = await axios.get('https://api.coingecko.com/api/v3/coins/list');
    const bySymbol = {};
    for (const c of coinList) {
      const s = (c.symbol || '').toUpperCase();
      if (!bySymbol[s]) bySymbol[s] = [];
      bySymbol[s].push(c.id);
    }

    const misses = [];
    for (const symbol of TICKERS) {
      const ids = bySymbol[symbol.toUpperCase()] || [];
      if (ids.length === 0) {
        misses.push(symbol);
        continue;
      }
      
      // Best-effort: first match
      const id = ids[0]; 
      try {
        const infoUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
        const { data: info } = await axios.get(infoUrl);
        const imgUrl = (info && info.image && (info.image.large || info.image.small || info.image.thumb)) || null;
        
        if (!imgUrl) { 
          misses.push(symbol); 
          continue; 
        }

        const ext = imgUrl.split('?')[0].split('.').pop().toLowerCase();
        const outPath = path.join(OUT_DIR, `${symbol.toUpperCase()}.${ext}`);
        
        const resp = await axios.get(imgUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(outPath, resp.data);
      } catch (e) {
        misses.push(symbol);
      }
      // Polite delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
  }
})();
