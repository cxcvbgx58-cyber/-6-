import { MarketCoin, RowData } from '../../models';

export const isCoinExcluded = (coin: Partial<MarketCoin> | Partial<RowData>) => {
  const symbolRaw = (coin as any).baseAsset || (coin as any).pair || (coin as any).symbol || '';
  const symbol = symbolRaw.replace('USDT', '').toUpperCase();
  const exchange = coin.exchange;
  const market = (coin as any).market || (coin as any).marketType;

  if (exchange === 'Binance') {
    const fullyExcluded = ['NEAR', 'AVAX', 'BCH', 'TAO', 'SHIB', 'RENDER', 'OP', 'FIL', 'INJ', 'AXS', 'LTC', 'SUI', 'POL'];
    if (fullyExcluded.includes(symbol)) return true;
    if (market === 'FUTURES' && symbol === 'ONDO') return true;
    if (market === 'SPOT' && (symbol === 'ICP' || symbol === 'PENDLE')) return true;
  }

  if (exchange === 'Bybit') {
    const fullyExcluded = ['NEAR', 'STX', 'STRK', 'PEPE'];
    if (fullyExcluded.includes(symbol)) return true;
    const futuresExcluded = ['AVAX', 'BCH', 'LTC', 'GALA', 'ENA', 'ONDO', 'SUI', '1000BONK', '1000FLOKI', 'SEI'];
    if (market === 'FUTURES' && futuresExcluded.includes(symbol)) return true;
    if (market === 'SPOT' && (symbol === 'RENDER' || symbol === 'OP')) return true;
  }

  return false;
};
