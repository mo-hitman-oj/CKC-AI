// CKC Jewellers · AI Concierge — local demo server.
// Serves public/ and a small API:
//   GET  /api/gold-rate   live indicative Indian retail rates (COMEX gold × USD/INR + duty)
//   POST /api/speak       { text } → ElevenLabs audio + word timings (disk-cached)
//   POST /api/transcribe  raw audio body → { text }   (OpenAI)
//   POST /api/route       { text, context } → { action, ... }  (OpenAI intent router / live answer)
// Usage: node server.js → http://localhost:5173
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------- env
function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const PORT = process.env.PORT || 5173;
const PUBLIC = path.join(__dirname, 'public');
const CACHE = path.join(__dirname, 'voice-cache');
// On Vercel the bundle is read-only: pre-generated lines ship in voice-cache/ (also copied to the CDN at /voice/);
// anything new is generated per request and returned inline as a data: URL.
const ON_VERCEL = !!process.env.VERCEL;
if (!ON_VERCEL) fs.mkdirSync(CACHE, { recursive: true });

const OPENAI_KEY = process.env.OPEN_AI_KEY || process.env.OPENAI_API_KEY;
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID || 'ZUrEGyu8GFMwnHbvLhv2'; // Monika Sogam — Indian English, warm
const TTS_MODEL = process.env.TTS_MODEL || 'eleven_multilingual_v2';
// Kannada isn't in multilingual_v2 (it comes out garbled); v3 speaks it properly.
const TTS_MODELS = { en: TTS_MODEL, hi: process.env.TTS_MODEL_HI || TTS_MODEL, kn: process.env.TTS_MODEL_KN || 'eleven_v3' };
const LANGS = { en: 'English', hi: 'Hindi', kn: 'Kannada' };
const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-4.1-mini';
const STT_MODEL = process.env.STT_MODEL || 'gpt-4o-transcribe';

// ---------------------------------------------------------------- gold rate
// Indian retail ≈ international spot × USD/INR × (1 + import duty & cess ≈ 6%) + small dealer premium.
// Numbers are "indicative"; the UI says so. Fallback keeps the demo alive offline.
const IMPORT_FACTOR = 1.065;
const TROY_OZ_G = 31.1035;
let goldCache = null;

async function yahoo(symbol, range = '1mo') {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000),
  });
  const j = await r.json();
  const res = j.chart.result[0];
  const closes = res.indicators.quote[0].close;
  const series = res.timestamp.map((t, i) => ({ t: t * 1000, v: closes[i] })).filter(p => p.v != null);
  return { price: res.meta.regularMarketPrice, series };
}

async function goldRate() {
  if (goldCache && Date.now() - goldCache.fetchedAt < 20 * 60 * 1000) return goldCache; // stable during a demo
  try {
    const [gold, silver, inr] = await Promise.all([yahoo('GC=F'), yahoo('SI=F'), yahoo('USDINR=X')]);
    const perGram = usdOz => (usdOz * inr.price / TROY_OZ_G) * IMPORT_FACTOR;
    const r24 = perGram(gold.price);
    const round = v => Math.round(v);
    // Daily 22K series in INR for the trend line (use today's FX for all points — good enough for shape).
    const trend = gold.series.map(p => ({ t: p.t, v: round(perGram(p.v) * 0.916) }));
    trend[trend.length - 1].v = round(r24 * 0.916);
    const prev = trend.length > 1 ? trend[trend.length - 2].v : trend[0].v;
    goldCache = {
      live: true,
      fetchedAt: Date.now(),
      r24: round(r24),
      r22: round(r24 * 0.916),
      r18: round(r24 * 0.75),
      silver: round(perGram(silver.price)),
      change22: round(r24 * 0.916) - prev,
      trend,
      usdinr: inr.price,
    };
    return goldCache;
  } catch (e) {
    console.warn('  gold-rate fetch failed, using fallback:', e.message);
    if (goldCache) return goldCache;
    const r24 = 13720;
    const trend = Array.from({ length: 22 }, (_, i) => ({ t: Date.now() - (21 - i) * 864e5, v: Math.round(r24 * 0.916 * (0.97 + 0.03 * Math.sin(i / 3) + i * 0.0012)) }));
    trend[trend.length - 1].v = Math.round(r24 * 0.916);
    return { live: false, fetchedAt: Date.now(), r24, r22: Math.round(r24 * 0.916), r18: Math.round(r24 * 0.75), silver: 172, change22: 38, trend };
  }
}

// ---------------------------------------------------------------- ElevenLabs speech with word timings
function wordsFromAlignment(a) {
  const words = [];
  let cur = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } return; }
    if (!cur) cur = { w: '', start: a.character_start_times_seconds[i], end: 0 };
    cur.w += ch;
    cur.end = a.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  return words;
}

const inflight = new Map();
async function speak(text, lang = 'en') {
  const model = TTS_MODELS[lang] || TTS_MODEL;
  const key = crypto.createHash('sha1').update(`${VOICE_ID}|${model}|${text}`).digest('hex').slice(0, 16);
  const mp3 = path.join(CACHE, `${key}.mp3`);
  const meta = path.join(CACHE, `${key}.json`);
  const result = { audio: `/voice/${key}.mp3`, key };
  if (fs.existsSync(mp3) && fs.existsSync(meta)) return { ...result, words: JSON.parse(fs.readFileSync(meta, 'utf8')) };
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVEN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
      }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const words = wordsFromAlignment(j.alignment);
    if (ON_VERCEL) return { key, audio: `data:audio/mpeg;base64,${j.audio_base64}`, words };
    fs.writeFileSync(mp3, Buffer.from(j.audio_base64, 'base64'));
    fs.writeFileSync(meta, JSON.stringify(words));
    return { ...result, words };
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ---------------------------------------------------------------- OpenAI
async function transcribe(buf, mime, lang = 'en') {
  const ext = /mp4|m4a/.test(mime) ? 'mp4' : /ogg/.test(mime) ? 'ogg' : /mpeg|mp3/.test(mime) ? 'mp3' : /wav/.test(mime) ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mime || 'audio/webm' }), `speech.${ext}`);
  form.append('model', STT_MODEL);
  // No domain prompt: with one, the model "hears" gold-rate questions in pure noise.
  // Language pinned to the customer's chosen language (auto-detect turns Indian-accented English into Devanagari).
  form.append('language', LANGS[lang] ? lang : 'en');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: form,
  });
  if (!r.ok) throw new Error(`OpenAI STT ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).text || '';
}

const ROUTER_PROMPT = `You are the voice concierge of CKC Jewellers, a prestigious jewellery house in Bengaluru, India, speaking to a customer seated at a table in the showroom.
Every customer utterance is routed. Reply with JSON (unused fields as empty strings):
{"action":"flow","flow":"gold_rate"|"savings"|"shop"}  — customer wants: today's gold/silver rate or price of gold ("gold_rate"); a gold savings scheme / monthly plan / instalments ("savings"); to see, choose, buy, price or pay for jewellery — including asking the price of a ring, earrings, pendant or any piece, or looking to buy a gift for someone ("shop").
{"action":"choose","value":"<one of the offered option ids>"} — ONLY when the context lists options and the customer is picking one (e.g. "the necklace", "ten thousand", "yes please", "go ahead").
{"action":"answer","text":"<spoken reply>"} — anything else: greetings, general questions about jewellery, gold purity, hallmarking (BIS HUID), care, occasions, gifting. Keep it warm, gracious and concise: 1–3 short sentences, suitable to be spoken aloud. Never use markdown, lists, emojis or symbols like ₹ — write "rupees". Do NOT invent CKC-specific facts (store history, prices, offers, policies, staff); for those, offer to call a CKC relationship manager to the table. If the customer speaks Hindi or Kannada, reply in that language. You may end by gently suggesting one of: today's gold rate, the gold savings plan, or browsing the collection.
{"action":"reset"} — customer says goodbye / thank you that's all / start over.
{"action":"ignore"} — the transcript is noise, a stray word, or gibberish (e.g. "Beep", a random foreign word, "Thank you." with no context) rather than something said to you.`;

async function route(text, context, lang = 'en') {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_schema', json_schema: { name: 'route', strict: true, schema: {
        type: 'object', additionalProperties: false, required: ['action', 'flow', 'value', 'text'],
        properties: {
          action: { type: 'string', enum: ['flow', 'choose', 'answer', 'reset', 'ignore'] },
          flow: { type: 'string', enum: ['gold_rate', 'savings', 'shop', ''] },
          value: { type: 'string', description: 'option id when action=choose, else ""' },
          text: { type: 'string', description: 'spoken reply when action=answer, else ""' },
        } } } },
      messages: [
        { role: 'system', content: ROUTER_PROMPT + (lang === 'en' ? '' : `\nThe customer chose ${LANGS[lang]}. Write every "answer" in ${LANGS[lang]} (native script), in a warm, natural, conversational register — but say numbers, prices and terms like gold rate, karat, UPI, GST in English, in Roman script (e.g. "twelve thousand rupees"). Option labels may be in ${LANGS[lang]}; match on meaning.${lang === 'kn' ? ' Keep Kannada answers to one or two short sentences.' : ''}`) },
        { role: 'user', content: `Context: ${JSON.stringify(context || {})}\nCustomer said: "${text}"` },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI chat ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return JSON.parse(j.choices[0].message.content);
}

// ---------------------------------------------------------------- http
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
};

const readBody = req => new Promise((res, rej) => {
  const chunks = [];
  req.on('data', c => chunks.push(c)).on('end', () => res(Buffer.concat(chunks))).on('error', rej);
});
const sendJSON = (res, code, obj) => { res.writeHead(code, { 'Content-Type': TYPES['.json'] }); res.end(JSON.stringify(obj)); };

function serveFile(res, root, urlPath) {
  const filePath = path.normalize(path.join(root, urlPath));
  if (!filePath.startsWith(root + path.sep) || path.basename(filePath).startsWith('.')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found: ' + urlPath); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/gold-rate') return sendJSON(res, 200, await goldRate());
    if (p === '/api/speak' && req.method === 'POST') {
      const { text, lang } = JSON.parse(await readBody(req));
      return sendJSON(res, 200, await speak(text, lang));
    }
    if (p === '/api/transcribe' && req.method === 'POST') {
      const t0 = Date.now();
      const text = await transcribe(await readBody(req), req.headers['content-type'], url.searchParams.get('lang') || 'en');
      console.log(`  🎙  "${text}" (${Date.now() - t0}ms)`);
      return sendJSON(res, 200, { text });
    }
    if (p === '/api/route' && req.method === 'POST') {
      const { text, context, lang } = JSON.parse(await readBody(req));
      const out = await route(text, context, lang);
      console.log('  →', JSON.stringify(out));
      return sendJSON(res, 200, out);
    }
    if (p.startsWith('/voice/')) return serveFile(res, CACHE, p.slice('/voice'.length));
    return serveFile(res, PUBLIC, p === '/' ? '/index.html' : p);
  } catch (e) {
    console.error('  ✖', p, e.message);
    return sendJSON(res, 500, { error: e.message });
  }
}

module.exports = handle; // Vercel entrypoint (default export)
if (require.main === module) http.createServer(handle).listen(PORT, () => {
  console.log(`\n  CKC Jewellers · AI Concierge`);
  console.log(`  ▸ http://localhost:${PORT}`);
  console.log(`  voice ${VOICE_ID} · tts ${TTS_MODELS.en} / kn ${TTS_MODELS.kn} · chat ${CHAT_MODEL} · stt ${STT_MODEL}`);
  if (!OPENAI_KEY || !ELEVEN_KEY) console.log('  ⚠ missing OPEN_AI_KEY or ELEVENLABS_API_KEY in .env');
  console.log('');
});
