#!/usr/bin/env node
// One-shot sector heatmap seeder — uses Finnhub for ETF quotes, Yahoo as fallback
import { loadEnvFile, runSeed } from './_seed-utils.mjs';

loadEnvFile(import.meta.url);

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

const SECTOR_SYMBOLS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLI', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC', 'SMH'];
const SECTOR_NAMES = {
  XLK: 'Technology', XLF: 'Financials', XLE: 'Energy', XLV: 'Health Care',
  XLY: 'Consumer Disc.', XLI: 'Industrials', XLP: 'Consumer Staples',
  XLU: 'Utilities', XLB: 'Materials', XLRE: 'Real Estate', XLC: 'Comm. Services', SMH: 'Semiconductors',
};
const CACHE_KEY = 'market:sectors:v2';
const TTL = 1800;

async function upstashSet(key, value, ttl) {
  const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EX', ttl, JSON.stringify(value)]),
  });
  return res.ok;
}

async function fetchFinnhub(symbol) {
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.c) return null;
    return { price: d.c, change: d.dp };
  } catch { return null; }
}

async function fetchYahoo(symbol) {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = await r.json();
    const meta = d?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
    const change = prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;
    return { price: meta.regularMarketPrice, change: +change.toFixed(2) };
  } catch { return null; }
}

async function main() {
  console.log('=== Sector Heatmap Seed ===');
  const sectors = [];

  for (const sym of SECTOR_SYMBOLS) {
    let q = FINNHUB_KEY ? await fetchFinnhub(sym) : null;
    if (!q) q = await fetchYahoo(sym);
    if (q) {
      sectors.push({ symbol: sym, name: SECTOR_NAMES[sym] || sym, change: q.change, price: q.price });
      console.log(`  ${sym} (${SECTOR_NAMES[sym]}): $${q.price} (${q.change > 0 ? '+' : ''}${q.change}%)`);
    } else {
      console.warn(`  ${sym}: failed`);
    }
    await new Promise(r => setTimeout(r, 120)); // stay under Finnhub rate limit
  }

  if (!sectors.length) { console.error('No sector data — aborting'); process.exit(1); }

  const payload = { sectors, valuations: [] };
  const ok = await upstashSet(CACHE_KEY, { data: payload, fetchedAt: Date.now() }, TTL);
  const okMeta = await upstashSet(`seed-meta:${CACHE_KEY}`, { fetchedAt: Date.now(), recordCount: sectors.length }, TTL * 4);
  console.log(`\nSeeded ${sectors.length}/${SECTOR_SYMBOLS.length} sectors — Redis: ${ok && okMeta ? 'OK' : 'PARTIAL'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
