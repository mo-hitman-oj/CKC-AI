// CKC Concierge — orchestrates stage, voice, flows and UI.
import { createStage } from './stage/stage.js';
import { Speaker, Listener } from './voice.js';
import { Panels, answerCard } from './panels.js';
import * as P from './panels.js';
import { PRODUCTS } from './config.js';
import { FLOWS, LINES, allLines } from './flows.js';
import { inr, timeNow } from './format.js';

const $ = s => document.querySelector(s);
const body = document.body;

// ---------------------------------------------------------------- settings
const DEFAULTS = { entity: 'gold', captions: true, autoPay: 0, lang: 'en' };
let settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ckc-settings') || '{}')); } catch {}
const saveSettings = () => { try { localStorage.setItem('ckc-settings', JSON.stringify(settings)); } catch {} };

// ---------------------------------------------------------------- core objects
const stage = createStage($('#stage'), { entity: settings.entity });
const panels = new Panels($('#panels'));
const caption = $('#caption');
const chips = $('#chips');
const micBtn = $('#mic');
let rate = null;
let listenerSignal = null;

const speaker = new Speaker({
  onStart: parsed => renderCaption(parsed),
  onWord: (i, parsed, em) => {
    stage.pulse(em ? 1 : 0.38 + Math.random() * 0.14);
    highlightWord(i, parsed);
  },
  onEnd: () => caption.classList.add('fade'),
});
const listener = new Listener({ onLevel: s => { listenerSignal = s; } });

// Per-frame: feed the live audio signal (voice or mic) to the entity.
(function loop() {
  const s = speaker.signal() || (listenerSignal && { ...listenerSignal, level: listenerSignal.level * 0.8 });
  stage.setSignal(s || { level: 0, bass: 0, mid: 0, treble: 0 });
  requestAnimationFrame(loop);
})();

// ---------------------------------------------------------------- captions (word-synced)
let capSentence = -1;
function sentencesOf(parsed) {
  if (parsed._sent) return parsed._sent;
  const out = [[]];
  parsed.tokens.forEach(t => { out[out.length - 1].push(t); if (/[.?!।]["”]?$/.test(t.display)) out.push([]); });
  return (parsed._sent = out.filter(s => s.length));
}
function renderCaption(parsed) {
  capSentence = -1;
  caption.classList.remove('fade', 'user');
  caption.innerHTML = '';
  if (parsed.wordCount) highlightWord(0, parsed, true);
}
function highlightWord(i, parsed, preview = false) {
  if (!settings.captions) return;
  const sents = sentencesOf(parsed);
  const si = sents.findIndex(s => s.some(t => i >= t.start && i < t.start + t.count));
  if (si < 0) return;
  if (si !== capSentence) {
    capSentence = si;
    caption.innerHTML = `<p>${sents[si].map(t => `<span class="${t.em ? 'em' : ''}" data-s="${t.start}">${t.display}</span>`).join(' ')}</p>`;
  }
  if (preview) return;
  caption.querySelectorAll('span').forEach(sp => {
    const s = +sp.dataset.s;
    sp.classList.toggle('on', s <= i);
    sp.classList.toggle('now', s <= i && i < s + (parsed.tokens.find(t => t.start === s)?.count || 1));
  });
}
function showUserText(text, pending = false) {
  caption.classList.remove('fade');
  caption.classList.add('user');
  caption.innerHTML = `<p><span class="you">You</span>${pending ? '<span class="dots"><i></i><i></i><i></i></span>' : `“${text.replace(/</g, '&lt;')}”`}</p>`;
}

// ---------------------------------------------------------------- state
function engage() {
  if (body.dataset.state === 'engaged') return;
  body.dataset.state = 'engaged';
  stage.setLayout('left');
}
function toAttract() {
  run?.abort();
  speaker.stop();
  clearAsk();
  panels.clear();
  caption.innerHTML = '';
  body.dataset.state = 'attract';
  stage.setLayout('center');
  stage.setMode('idle');
}

// Hold: while the customer is speaking / we're thinking, flows wait before talking again.
let gate = null;
const hold = () => { if (!gate) { let r; gate = { p: new Promise(x => (r = x)), release: () => { gate = null; r(); } }; } };
const release = () => gate?.release();

// ---------------------------------------------------------------- flow runner
let run = null;
let pendingAsk = null;
let payResolve = null;
let flowActive = false;

function clearAsk() {
  pendingAsk = null;
  chips.innerHTML = '';
}

function makeCtx(signal) {
  const guard = () => { if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' }); };
  const lang = settings.lang;
  return {
    lang, S: LINES[lang], rate, panels, stage,
    async say(script, cues) {
      while (gate) await gate.p;
      guard();
      stage.setMode('speaking');
      try { await speaker.say(script, cues, signal); }
      finally { if (!speaker.playing && !gate) stage.setMode('idle'); }
    },
    ask(prompt, options) {
      guard();
      return new Promise((resolve, reject) => {
        pendingAsk = { prompt, options, resolve: id => { clearAsk(); resolve(id); } };
        chips.innerHTML = `<span class="try">${TRY[settings.lang]}</span>` + options.map((o, i) =>
          `<button class="chip" data-id="${o.id}" style="--i:${i}">${o.label}</button>`).join('');
        signal.addEventListener('abort', () => { clearAsk(); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
      });
    },
    waitPayment() {
      guard();
      body.classList.add('awaiting-pay');
      return new Promise((resolve, reject) => {
        const done = () => { body.classList.remove('awaiting-pay'); payResolve = null; clearTimeout(t); resolve(); };
        payResolve = done;
        const t = settings.autoPay ? setTimeout(done, settings.autoPay) : 0;
        signal.addEventListener('abort', () => { body.classList.remove('awaiting-pay'); clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
      });
    },
  };
}

async function startFlow(name) {
  if (!FLOWS[name] || !rate) return;
  run?.abort();
  speaker.stop();
  clearAsk();
  release();
  const ctl = new AbortController();
  run = ctl;
  engage();
  bumpIdle();
  let next = name;
  flowActive = true;
  try {
    while (next && next !== 'attract' && !ctl.signal.aborted) next = await FLOWS[next](makeCtx(ctl.signal));
    if (next === 'attract' && run === ctl) toAttract();
  } catch (e) {
    if (e.name !== 'AbortError') { console.error(e); toast('Something went wrong — ' + e.message); }
  } finally {
    if (run === ctl) flowActive = false;
  }
}

function choose(id) {
  bumpIdle();
  if (pendingAsk?.options.some(o => o.id === id)) return pendingAsk.resolve(id);
  if (FLOWS[id]) startFlow(id);
}

// ---------------------------------------------------------------- live voice
async function listen() {
  if (listener.active) return listener.stop();
  if (!rate) return;
  bumpIdle();
  speaker.skip(); // barge-in: cut the voice, keep the flow alive
  hold();
  micBtn.classList.add('on');
  stage.setMode('listening');
  let blob;
  try { blob = await listener.listen(); }
  catch (e) { toast('Microphone unavailable — ' + e.message); }
  micBtn.classList.remove('on');
  if (!blob || blob.size < 2000) { stage.setMode('idle'); return release(); }

  stage.setMode('thinking');
  showUserText('', true);
  try {
    const t = await fetch(`/api/transcribe?lang=${settings.lang}`, { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob }).then(r => r.json());
    const text = (t.text || '').trim();
    if (!/\p{L}{2}/u.test(text)) { caption.innerHTML = ''; stage.setMode('idle'); return release(); } // nothing intelligible
    showUserText(text);
    const quick = localMatch(text);
    if (quick) { release(); return pendingAsk.resolve(quick.id); }
    const context = pendingAsk
      ? { awaiting: pendingAsk.prompt, options: pendingAsk.options.map(({ id, label, hint }) => ({ id, label, hint })) }
      : { screen: body.dataset.state };
    const out = await fetch('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, context, lang: settings.lang }) })
      .then(r => r.json()).catch(() => ({})) ;
    await act(out, text);
  } catch (e) {
    console.error(e);
    toast('Voice service error — ' + e.message);
    release();
    stage.setMode('idle');
  }
}

// Unambiguous answers to an on-screen question are matched locally (no network round-trip).
function localMatch(text) {
  if (!pendingAsk) return null;
  const norm = x => ' ' + String(x).toLowerCase().replace(/(\d),(?=\d)/g, '$1').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const t = norm(text);
  // Longest matching phrase wins ("twenty-five thousand" beats "five thousand").
  const scored = pendingAsk.options.map(o => [o, Math.max(0, ...[o.label, ...(o.hint || [])].map(norm).filter(k => t.includes(k)).map(k => k.length))])
    .filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  if (!scored.length || (scored[1] && scored[1][1] === scored[0][1]) || t.trim().split(' ').length > 9) return null;
  return scored[0][0];
}

async function act(out, text) {
  const local = localMatch(text);
  if ((out.action === 'flow' && FLOWS[out.flow]) || ['gold_rate', 'savings', 'shop'].includes(out.action)) return startFlow(out.flow || out.action);
  if (out.action === 'reset') return startFlow('done');
  if (out.action === 'ignore') { caption.innerHTML = ''; stage.setMode('idle'); return release(); }
  if (out.action === 'choose' && pendingAsk?.options.some(o => o.id === String(out.value))) { release(); return pendingAsk.resolve(String(out.value)); }
  if (local && out.action !== 'answer') { release(); return pendingAsk.resolve(local.id); }

  // Free-form question → live answer, spoken with the same word-synced voice.
  const reply = out.action === 'answer' && out.text ? out.text : LINES[settings.lang].notSure();
  engage();
  if (out.action === 'answer') panels.show(answerCard(text), { max: 2 });
  // Start voicing the answer now; if it isn't ready within ~1s (Kannada takes several seconds),
  // say a pre-voiced "one moment" so the room isn't left in silence.
  const S = LINES[settings.lang];
  const ready = speaker.prepare(reply).then(() => true, () => true);
  const quick = await Promise.race([ready, new Promise(r => setTimeout(() => r(false), 1000))]);
  try {
    if (!quick) { stage.setMode('speaking'); await speaker.say(S.hold()); stage.setMode('thinking'); await ready; }
    stage.setMode('speaking');
    await speaker.say(reply);
  } catch {}
  stage.setMode('idle');
  if (!flowActive && !document.querySelector('#panels .menu')) {
    release();
    return startFlow('menu');
  }
  release();
}

// ---------------------------------------------------------------- idle reset
let idleT;
function bumpIdle() {
  clearTimeout(idleT);
  idleT = setTimeout(function check() {
    if (speaker.playing || listener.active || body.classList.contains('awaiting-pay')) { idleT = setTimeout(check, 10000); return; }
    if (body.dataset.state === 'engaged') toAttract();
  }, 120000);
}

// ---------------------------------------------------------------- UI wiring
$('#begin').addEventListener('click', () => startFlow('welcome'));

// ---------------------------------------------------------------- language
const TRY = { en: 'Try saying', hi: 'ऐसे कहें', kn: 'ಹೀಗೆ ಹೇಳಿ' };
const ATTRACT = {
  en: { hello: 'Namaskara', sub: 'Welcome to CKC Jewellers — your personal concierge', begin: 'Begin' },
  hi: { hello: 'नमस्ते', sub: 'CKC ज्वेलर्स में आपका स्वागत है', begin: 'शुरू करें' },
  kn: { hello: 'ನಮಸ್ಕಾರ', sub: 'CKC Jewellers ಗೆ ಸ್ವಾಗತ', begin: 'ಪ್ರಾರಂಭಿಸಿ' },
};
const LANG_ORDER = ['en', 'hi', 'kn'];
function setLang(lang) {
  if (!LINES[lang]) return;
  settings.lang = lang;
  speaker.lang = lang;
  saveSettings();
  document.documentElement.lang = lang;
  const a = ATTRACT[lang];
  $('#attract .namaskara').textContent = a.hello;
  $('#attract .sub').textContent = a.sub;
  $('#begin span').textContent = a.begin;
  document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('sel', b.dataset.lang === lang));
  if (rate) prewarm(); // voice this language first
}
document.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
micBtn.addEventListener('click', listen);
chips.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) choose(b.dataset.id); });
$('#panels').addEventListener('click', e => {
  const flow = e.target.closest('[data-flow]');
  if (flow) return startFlow(flow.dataset.flow);
  const c = e.target.closest('[data-choice]');
  if (c) return choose(c.dataset.choice);
  if (e.target.closest('.qr-wrap')) payResolve?.();
});
$('#home').addEventListener('click', toAttract);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 4000);
}

// Settings drawer
const drawer = $('#settings');
const toggleSettings = open => drawer.classList.toggle('open', open ?? !drawer.classList.contains('open'));
$('#gear').addEventListener('click', () => toggleSettings());
$('#settings-close').addEventListener('click', () => toggleSettings(false));
function syncSettingsUI() {
  drawer.querySelectorAll('[data-entity]').forEach(b => b.classList.toggle('sel', b.dataset.entity === settings.entity));
  $('#opt-captions').checked = settings.captions;
  $('#opt-autopay').checked = !!settings.autoPay;
  body.classList.toggle('no-captions', !settings.captions);
}
drawer.addEventListener('click', e => {
  const b = e.target.closest('[data-entity]');
  if (!b) return;
  settings.entity = b.dataset.entity;
  stage.setEntity(settings.entity);
  saveSettings(); syncSettingsUI();
});
$('#opt-captions').addEventListener('change', e => { settings.captions = e.target.checked; saveSettings(); syncSettingsUI(); });
$('#opt-autopay').addEventListener('change', e => { settings.autoPay = e.target.checked ? 7000 : 0; saveSettings(); });
syncSettingsUI();

// Presenter shortcuts
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) listen(); }
  else if (e.key === '1') startFlow('gold_rate');
  else if (e.key === '2') startFlow('savings');
  else if (e.key === '3') startFlow('shop');
  else if (e.key === 'w' || e.key === 'Enter') body.dataset.state === 'attract' && startFlow('welcome');
  else if (e.key === 'p' || e.key === 'P') payResolve?.();
  else if (e.key === 'r' || e.key === 'Escape') toAttract();
  else if (e.key === 's' || e.key === 'S') toggleSettings();
  else if (e.key === 'l' || e.key === 'L') setLang(LANG_ORDER[(LANG_ORDER.indexOf(settings.lang) + 1) % 3]);
  else if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});

// Clock
const clock = $('#clock');
const tickClock = () => { clock.textContent = timeNow(); };
tickClock(); setInterval(tickClock, 15000);

// ---------------------------------------------------------------- boot: live rate + pre-warm every voice line
// Voice every line ahead of time: current language first, then the others.
let prewarmRun = 0;
async function prewarm() {
  const run = ++prewarmRun;
  const status = $('#voice-status');
  const order = [settings.lang, ...LANG_ORDER.filter(l => l !== settings.lang)];
  const counts = Object.fromEntries(order.map(l => [l, { done: 0, total: 0, failed: 0 }]));
  const jobs = order.flatMap(l => { const ls = allLines(rate, l); counts[l].total = ls.length; return ls.map(t => [l, t]); });
  const NAME = { en: 'English', hi: 'Hindi', kn: 'Kannada' };
  const upd = () => {
    if (run !== prewarmRun) return;
    status.innerHTML = order.map(l => { const c = counts[l]; return `<span class="${c.done === c.total ? 'ok' : ''}">${NAME[l]} ${c.done}/${c.total}${c.failed ? ` · ${c.failed} failed` : ''}</span>`; }).join('');
    status.classList.toggle('ok', order.every(l => counts[l].done === counts[l].total));
  };
  upd();
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (jobs.length && run === prewarmRun) {
      const [l, t] = jobs.shift();
      try { await speaker.prepare(t, l); counts[l].done++; } catch (e) { counts[l].failed++; console.warn('prewarm', e); }
      upd();
    }
  }));
}

(async function boot() {
  try {
    rate = await fetch('/api/gold-rate').then(r => r.json());
  } catch (e) { toast('Could not load gold rate'); return; }
  const up = rate.change22 >= 0;
  $('#ticker').innerHTML = `<i class="${rate.live ? 'live' : ''}"></i>22K <b>${inr(rate.r22)}</b>/g <span class="${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${inr(Math.abs(rate.change22))}</span>`;
  $('#ticker').classList.add('show');
  body.classList.add('ready');
  const qlang = new URLSearchParams(location.search).get('lang');
  setLang(LINES[qlang] ? qlang : settings.lang);
  devShot(new URLSearchParams(location.search).get('shot'));
  const auto = new URLSearchParams(location.search).get('auto'); // dev: ?auto=gold_rate starts a flow on load
  if (auto) setTimeout(() => startFlow(auto), 300);

})();

// Dev only: ?shot=menu|rate|plan|summary|gallery|price|upi|success renders a screen without audio (for screenshots).
function devShot(shot) {
  if (!shot) return;
  body.classList.add('no-anim');
  if (shot === 'attract') return;
  engage();
  stage.setLayout('left', { instant: true });
  const p = PRODUCTS[0];
  const cap = t => { caption.innerHTML = `<p>${t.split(' ').map((w, i) => `<span class="${i < 7 ? 'on' : ''} ${i === 6 ? 'now' : ''}">${w}</span>`).join(' ')}</p>`; };
  const chipsOf = labels => { chips.innerHTML = `<span class="try">Try saying</span>` + labels.map((l, i) => `<button class="chip" style="--i:${i}">${l}</button>`).join(''); };
  const S = {
    menu: () => { panels.show(P.menuCard()); chipsOf(["Today's gold rate", 'Gold savings plan', 'Explore & buy']); cap("I'm your personal concierge. What would you like to do?"); },
    rate: () => { panels.show(P.rateCard(rate)); panels.show(P.trendCard(rate)); cap("Twenty-two karat is ₹12,571 per gram, and twenty-four karat is ₹13,723."); chipsOf(['Start a savings plan', 'Explore pieces', "That's all, thank you"]); },
    plan: () => { const el = panels.show(P.planCard()); el.classList.add('show-bonus'); panels.show(P.amountCard()); cap('How much would you like to set aside each month?'); chipsOf(['₹5,000 / month', '₹10,000 / month', '₹25,000 / month']); },
    summary: () => { panels.show(P.planSummaryCard(10000, rate)); cap('So you can redeem jewellery worth ₹1,20,000.'); chipsOf(['Yes, please', 'Not now']); },
    gallery: () => { panels.show(P.galleryCard()); cap('Here are a few pieces from our diamond collection. Which one catches your eye?'); },
    price: () => { panels.show(P.productCard(p)); panels.show(P.priceCard(p, rate)); cap('Your total comes to ₹1,23,850. Shall I generate the payment for you?'); chipsOf(['Yes, please', 'Not now']); },
    upi: () => { panels.show(P.upiCard(123850, 'Solitaire Ring · 18K · 3.6 g')); cap("Here's your payment code. Just scan it with any UPI app."); },
    success: () => { panels.show(P.successCard(123850, 'Solitaire Ring', '<p class="s-note">Invoice &amp; diamond certificate sent to your phone</p>')); panels.show(P.menuCard(), { max: 2 }); cap('Payment confirmed, thank you!'); },
  };
  S[shot]?.();
}
