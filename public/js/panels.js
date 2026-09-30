// Right-hand dynamic cards. Each builder returns an element; Panels animates them in/out.
import { inr, num, timeNow } from './format.js';
import { STORE, SCHEME, PRODUCTS, priceOf } from './config.js';

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

export class Panels {
  constructor(root) { this.root = root; }

  show(el, { replace = false, max = 3 } = {}) {
    if (replace) this.clear();
    const live = [...this.root.children].filter(c => !c.classList.contains('leaving'));
    live.slice(0, Math.max(0, live.length - max + 1)).forEach(c => this.#remove(c));
    el.classList.add('card', 'entering');
    this.root.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('entering')));
    el.querySelectorAll('[data-count]').forEach(countUp);
    return el;
  }

  clear() { [...this.root.children].forEach(c => this.#remove(c)); }

  #remove(c) {
    if (c.classList.contains('leaving')) return;
    c.style.height = c.offsetHeight + 'px';
    c.classList.add('leaving');
    requestAnimationFrame(() => { c.style.height = '0px'; });
    setTimeout(() => c.remove(), 650);
  }
}

// Animated number: <span data-count="12541" data-prefix="₹"></span>
function countUp(el) {
  const target = +el.dataset.count, dp = +(el.dataset.dp || 0), prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
  const dur = +(el.dataset.dur || 1100);
  const t0 = performance.now() + +(el.dataset.delay || 0);
  const fmtNow = v => prefix + v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }) + suffix;
  if (document.body.classList.contains('no-anim')) { el.textContent = fmtNow(target); return; }
  const fmt = v => prefix + v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }) + suffix;
  el.textContent = fmt(0);
  const step = now => {
    const k = Math.min(1, Math.max(0, (now - t0) / dur));
    const e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(+(target * e).toFixed(dp));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const cnt = (v, { prefix = '₹', dp = 0, delay = 0, suffix = '' } = {}) =>
  `<span data-count="${v}" data-prefix="${prefix}" data-dp="${dp}" data-delay="${delay}" data-suffix="${suffix}">${prefix}${num(v)}${suffix}</span>`;

// ------------------------------------------------------------------ icons
const ICON = {
  rate: `<svg viewBox="0 0 48 48"><path d="M8 34 L18 24 L26 30 L40 14"/><path d="M32 14h8v8"/><path d="M6 42h36" opacity=".5"/></svg>`,
  plan: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15"/><path d="M24 15v9l6 4"/><path d="M24 4v4M24 40v4M4 24h4M40 24h4" opacity=".5"/></svg>`,
  shop: `<svg viewBox="0 0 48 48"><path d="M14 18 L24 8 L34 18 L24 42 Z"/><path d="M14 18h20M20 18l4 24M28 18l-4 24M19 18l5-10 5 10" opacity=".7"/></svg>`,
  check: `<svg viewBox="0 0 48 48"><path d="M14 25 L21 32 L35 17"/></svg>`,
};

// ------------------------------------------------------------------ cards
const MENU_TEXT = {
  en: { q: 'How may I help you today?', hint: 'Tap an option, or just ask me.',
    t: [["Today's Gold Rate", 'Live Bengaluru rates · 22K / 24K / 18K'], ['Gold Savings Plan', 'Save monthly · CKC adds one instalment'], ['Explore &amp; Buy', 'Choose a piece · pay by UPI at the table']] },
  hi: { q: 'आज मैं आपकी क्या मदद करूँ?', hint: 'कोई option चुनें, या बस मुझसे पूछें।',
    t: [['आज का Gold Rate', 'बेंगलुरु के live rates · 22K / 24K / 18K'], ['Gold Savings Plan', 'हर महीने बचत · एक instalment CKC की तरफ़ से'], ['देखें और खरीदें', 'Piece चुनें · टेबल पर ही UPI से payment']] },
  kn: { q: 'ಇವತ್ತು ನಾನು ಏನು ಸಹಾಯ ಮಾಡಲಿ?', hint: 'ಒಂದು option ಆಯ್ಕೆ ಮಾಡಿ, ಅಥವಾ ನನ್ನನ್ನು ಕೇಳಿ.',
    t: [['ಇವತ್ತಿನ Gold Rate', 'ಬೆಂಗಳೂರಿನ live rates · 22K / 24K / 18K'], ['Gold Savings Plan', 'ಪ್ರತಿ ತಿಂಗಳು ಉಳಿತಾಯ · ಒಂದು instalment CKC ಇಂದ'], ['ನೋಡಿ ಮತ್ತು ಖರೀದಿಸಿ', 'Piece ಆಯ್ಕೆ ಮಾಡಿ · table ನಲ್ಲೇ UPI payment']] },
};

export function menuCard(lang = 'en') {
  const m = MENU_TEXT[lang] || MENU_TEXT.en;
  const flows = ['gold_rate', 'savings', 'shop'], icons = [ICON.rate, ICON.plan, ICON.shop];
  return h(`
  <section class="menu">
    <p class="eyebrow">${m.q}</p>
    <div class="menu-grid">
      ${m.t.map(([b, sm], i) => `<button class="tile" data-flow="${flows[i]}">${icons[i]}<b>${b}</b><small>${sm}</small></button>`).join('')}
    </div>
    <p class="menu-hint">${m.hint}</p>
  </section>`);
}

export function rateCard(r) {
  const up = r.change22 >= 0;
  return h(`
  <section class="rate">
    <header class="card-head">
      <span class="eyebrow">Today's Gold Rate · ${STORE.city}</span>
      <span class="live ${r.live ? '' : 'off'}"><i></i>${r.live ? 'Live' : 'Indicative'} · ${timeNow()}</span>
    </header>
    <div class="rate-hero">
      <div><span class="k">22 Karat</span><span class="big">${cnt(r.r22)}</span><span class="unit">per gram</span></div>
      <span class="chg ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${inr(Math.abs(r.change22))} <small>since yesterday</small></span>
    </div>
    <div class="rate-row">
      <div><span class="k">24 Karat</span><b>${cnt(r.r24, { delay: 250 })}</b></div>
      <div><span class="k">18 Karat</span><b>${cnt(r.r18, { delay: 400 })}</b></div>
      <div><span class="k">Silver</span><b>${cnt(r.silver, { delay: 550 })}</b></div>
    </div>
    <p class="fine">Indicative retail rate per gram, excluding GST and making charges.</p>
  </section>`);
}

export function trendCard(r) {
  const pts = r.trend;
  const W = 520, H = 130, P = 6;
  const vs = pts.map(p => p.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const x = i => P + (i / (pts.length - 1)) * (W - 2 * P);
  const y = v => P + (1 - (v - min) / (max - min || 1)) * (H - 2 * P);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1)},${H} L${x(0)},${H} Z`;
  const first = pts[0].v, last = pts[pts.length - 1].v;
  const pct = ((last - first) / first * 100).toFixed(1);
  const d0 = new Date(pts[0].t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return h(`
  <section class="trend">
    <header class="card-head"><span class="eyebrow">22K · last ${pts.length} trading days</span><span class="chg ${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '+' : ''}${pct}%</span></header>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="spark">
      <defs><linearGradient id="tg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--gold)" stop-opacity=".35"/><stop offset="1" stop-color="var(--gold)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#tg)" class="spark-area"/>
      <path d="${line}" class="spark-line" pathLength="1"/>
      <circle cx="${x(pts.length - 1)}" cy="${y(last)}" r="4" class="spark-dot"/>
    </svg>
    <div class="spark-axis"><span>${d0}</span><span>High ${inr(max)} · Low ${inr(min)}</span><span>Today</span></div>
  </section>`);
}

export function planCard() {
  const total = SCHEME.months + SCHEME.bonusMonths;
  const dots = Array.from({ length: total }, (_, i) =>
    `<li class="${i >= SCHEME.months ? 'bonus' : ''}" style="--i:${i}"><span>${i + 1}</span></li>`).join('');
  return h(`
  <section class="plan">
    <header class="card-head"><span class="eyebrow">${SCHEME.name}</span></header>
    <h3>Save a little every month.<br><em>Own your jewellery sooner.</em></h3>
    <ol class="months">${dots}</ol>
    <div class="plan-legend"><span><i class="you"></i>You pay ${SCHEME.months} instalments</span><span><i class="ckc"></i>CKC adds the ${total}<sup>th</sup></span></div>
  </section>`);
}

export function amountCard(selected) {
  return h(`
  <section class="amounts">
    <p class="eyebrow">Choose your monthly instalment</p>
    <div class="amount-grid">
      ${SCHEME.amounts.map(a => `<button class="amount ${a === selected ? 'sel' : ''}" data-choice="${a}"><b>${inr(a)}</b><small>per month</small></button>`).join('')}
    </div>
  </section>`);
}

export function planSummaryCard(amount, rate) {
  const paid = amount * SCHEME.months, bonus = amount * SCHEME.bonusMonths, value = paid + bonus;
  const g = value / rate.r22;
  const mature = new Date(); mature.setMonth(mature.getMonth() + SCHEME.months + SCHEME.bonusMonths);
  return h(`
  <section class="summary">
    <header class="card-head"><span class="eyebrow">Your plan · ${inr(amount)} / month</span></header>
    <div class="sum-rows">
      <div><span>You pay · ${SCHEME.months} months</span><b>${cnt(paid)}</b></div>
      <div class="accent"><span>CKC contributes</span><b>+ ${cnt(bonus, { delay: 300 })}</b></div>
      <div class="total"><span>You redeem jewellery worth</span><b>${cnt(value, { delay: 600 })}</b></div>
    </div>
    <div class="sum-foot">
      <div><span class="k">At today's 22K rate</span><b>≈ ${cnt(+g.toFixed(1), { prefix: '', dp: 1, delay: 900, suffix: ' g' })}</b></div>
      <div><span class="k">Redeem from</span><b>${mature.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b></div>
    </div>
  </section>`);
}

export function galleryCard() {
  return h(`
  <section class="gallery">
    <header class="card-head"><span class="eyebrow">Curated for you · Diamond collection</span></header>
    <div class="gal-grid">
      ${PRODUCTS.map((p, i) => `
        <button class="piece" data-choice="${p.id}" style="--i:${i}">
          <div class="img"><img src="${p.img}" alt=""></div>
          <b>${p.name}</b><small>${p.karat}K gold · ${p.stoneLabel.split(' · ')[0]}</small>
        </button>`).join('')}
    </div>
  </section>`);
}

export function productCard(p) {
  return h(`
  <section class="product">
    <div class="p-img"><img src="${p.img}" alt=""></div>
    <div class="p-info">
      <span class="eyebrow">${p.collection} collection</span>
      <h3>${p.name}</h3>
      <ul class="specs">
        <li>${p.karat}K Gold</li><li>${p.weight} g</li><li>${p.stoneLabel}</li><li>BIS Hallmarked</li><li>Certified diamonds</li>
      </ul>
    </div>
  </section>`);
}

export function priceCard(p, rate) {
  const pr = priceOf(p, rate);
  const rows = [
    [`Gold value <small>${p.weight} g × ${inr(pr.perGram)} (${p.karat}K)</small>`, pr.gold],
    [`Diamonds <small>${p.stoneLabel}</small>`, pr.stone],
    [`Making charges <small>${Math.round(p.making * 100)}% on gold</small>`, pr.making],
    [`GST <small>3%</small>`, pr.gst],
  ];
  return h(`
  <section class="price">
    <header class="card-head"><span class="eyebrow">Price breakdown · at today's rate</span></header>
    <div class="p-rows">
      ${rows.map(([l, v], i) => `<div style="--i:${i}"><span>${l}</span><b>${cnt(v, { delay: 150 * i })}</b></div>`).join('')}
    </div>
    <div class="p-total"><span>Total payable</span><b>${cnt(pr.total, { delay: 700 })}</b></div>
  </section>`);
}

export function upiLink(amount, note) {
  const q = new URLSearchParams({ pa: STORE.upiVpa, pn: STORE.upiName, am: amount.toFixed(2), cu: 'INR', tn: note });
  return 'upi://pay?' + q.toString().replace(/\+/g, '%20');
}

function qrSvg(text) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
  return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#15110a"/></svg>`;
}

export function upiCard(amount, label) {
  const link = upiLink(amount, label);
  const el = h(`
  <section class="upi">
    <div class="qr-wrap" title="Demo: click to simulate payment">
      <div class="qr">${qrSvg(link)}<div class="qr-logo">CKC</div></div>
      <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      <div class="scanline"></div>
    </div>
    <div class="upi-info">
      <span class="eyebrow">Scan to pay with any UPI app</span>
      <div class="upi-amt">${inr(amount)}</div>
      <p class="upi-for">${label}</p>
      <div class="payee"><span>Pay to</span><b>${STORE.upiName}</b><code>${STORE.upiVpa}</code></div>
      <div class="apps"><span>GPay</span><span>PhonePe</span><span>Paytm</span><span>BHIM</span></div>
      <div class="waiting"><i></i><i></i><i></i> Waiting for payment · <span class="timer">05:00</span></div>
    </div>
  </section>`);
  const timer = el.querySelector('.timer');
  const end = Date.now() + 5 * 60 * 1000;
  const iv = setInterval(() => {
    if (!el.isConnected) return clearInterval(iv);
    const s = Math.max(0, Math.round((end - Date.now()) / 1000));
    timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000);
  return el;
}

export function successCard(amount, label, extra = '') {
  const ref = 'CKC' + Date.now().toString().slice(-9);
  return h(`
  <section class="success">
    <div class="tick">${ICON.check}</div>
    <div>
      <span class="eyebrow">Payment received</span>
      <div class="s-amt">${inr(amount)}</div>
      <p>${label}</p>
      <dl><dt>Reference</dt><dd>${ref}</dd><dt>Paid via</dt><dd>UPI</dd><dt>Time</dt><dd>${timeNow()}</dd></dl>
      ${extra}
    </div>
  </section>`);
}

export function answerCard(question) {
  return h(`<section class="ask"><span class="eyebrow">You asked</span><p>“${question.replace(/</g, '&lt;')}”</p></section>`);
}
