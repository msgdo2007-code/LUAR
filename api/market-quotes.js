const { json } = require('./_lib');

function symbolsFromRequest(req) {
  const raw = String(req.query?.symbols || '').split(',');
  return [...new Set(raw.map(value => value.trim().toUpperCase()).filter(value => /^[A-Z0-9._/-]{1,20}$/.test(value)))].slice(0, 30);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'MÃ©todo nÃ£o permitido.' });
  const provider = String(req.query?.provider || 'brapi').toLowerCase();
  const symbols = symbolsFromRequest(req);
  if (!symbols.length) return json(res, 400, { error: 'Informe ao menos um sÃ­mbolo.' });
  try {
    if (provider === 'brapi') {
      const url = `https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(symbols.join(','))}`;
      const response = await fetch(url, { headers: { ...(process.env.BRAPI_TOKEN ? { Authorization: `Bearer ${process.env.BRAPI_TOKEN}` } : {}), Accept: 'application/json' } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return json(res, 502, { error: 'A brapi nÃ£o respondeu.', details: body });
      return json(res, 200, { provider: 'brapi', quotes: (body.stocks || body.results || []).map(item => ({ symbol: item.symbol || item.stock, price: Number(item.regularMarketPrice || item.close || 0), change: Number(item.regularMarketChangePercent || item.change || 0) })) });
    }
    if (provider === 'alpaca') {
      if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_SECRET_KEY) return json(res, 503, { error: 'Alpaca nÃ£o configurada no servidor.' });
      const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols.join(','))}&feed=iex`;
      const response = await fetch(url, { headers: { 'APCA-API-KEY-ID': process.env.ALPACA_API_KEY, 'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY, Accept: 'application/json' } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return json(res, 502, { error: 'A Alpaca nÃ£o respondeu.', details: body });
      const quotes = Object.entries(body || {}).map(([symbol, item]) => {
        const price = Number(item.latestTrade?.p || item.minuteBar?.c || item.dailyBar?.c || 0);
        const previous = Number(item.prevDailyBar?.c || 0);
        return { symbol, price, change: previous ? ((price - previous) / previous) * 100 : 0 };
      });
      return json(res, 200, { provider: 'alpaca', quotes });
    }
    return json(res, 400, { error: 'Provedor invÃ¡lido.' });
  } catch (error) {
    console.error('market-quotes:', error);
    return json(res, 502, { error: 'NÃ£o foi possÃ­vel consultar as cotaÃ§Ãµes.' });
  }
};
