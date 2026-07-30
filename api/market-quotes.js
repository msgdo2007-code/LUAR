const { json } = require('./_lib');

function symbolsFromRequest(req) {
  const raw = String(req.query?.symbols || '').split(',');
  return [...new Set(raw.map(value => value.trim().toUpperCase()).filter(value => /^[A-Z0-9._/-]{1,20}$/.test(value)))].slice(0, 30);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
  const provider = String(req.query?.provider || 'brapi').toLowerCase();
  const symbols = symbolsFromRequest(req);
  if (!symbols.length) return json(res, 400, { error: 'Informe ao menos um símbolo.' });
  try {
    if (provider === 'brapi') {
      const url = `https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
      const response = await fetch(url, { headers: { ...(process.env.BRAPI_TOKEN ? { Authorization: `Bearer ${process.env.BRAPI_TOKEN}` } : {}), Accept: 'application/json' } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return json(res, 502, { error: 'A brapi não respondeu.', details: body });
      return json(res, 200, { provider: 'brapi', quotes: (body.stocks || body.results || []).map(item => { const stats = item.defaultKeyStatistics || item.financialData || item.summaryDetail || item; const number = (...keys) => { for (const key of keys) { const value = Number(stats?.[key] ?? item?.[key]); if (Number.isFinite(value) && value !== 0) return value; } return 0; }; return { symbol: item.symbol || item.stock, price: Number(item.regularMarketPrice || item.close || 0), change: Number(item.regularMarketChangePercent || item.change || 0), metrics: { pe: number('priceEarnings','trailingPE'), pb: number('priceToBook'), eps: number('earningsPerShare','trailingEps'), dy: number('dividendYield','trailingAnnualDividendYield'), roe: number('returnOnEquity'), marketCap: number('marketCap'), netMargin: number('netProfitMargin') } }; }) });
    }
    if (provider === 'alpaca') {
      if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_SECRET_KEY) return json(res, 503, { error: 'Alpaca não configurada no servidor.' });
      const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols.join(','))}&feed=iex`;
      const response = await fetch(url, { headers: { 'APCA-API-KEY-ID': process.env.ALPACA_API_KEY, 'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY, Accept: 'application/json' } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return json(res, 502, { error: 'A Alpaca não respondeu.', details: body });
      const quotes = Object.entries(body || {}).map(([symbol, item]) => {
        const price = Number(item.latestTrade?.p || item.minuteBar?.c || item.dailyBar?.c || 0);
        const previous = Number(item.prevDailyBar?.c || 0);
        return { symbol, price, change: previous ? ((price - previous) / previous) * 100 : 0 };
      });
      return json(res, 200, { provider: 'alpaca', quotes });
    }
    return json(res, 400, { error: 'Provedor inválido.' });
  } catch (error) {
    console.error('market-quotes:', error);
    return json(res, 502, { error: 'Não foi possível consultar as cotações.' });
  }
};
