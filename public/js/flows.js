// Guided conversation flows, in English, Hindi and Kannada.
// Each line is a script (see voice.js parseScript):
//   [[cue]] brings a panel in on the exact next word · {shown|spoken} · *emphasis*
// Hindi/Kannada lines keep numbers and trade terms (gold rate, karat, UPI, GST) in English —
// the way customers and staff actually speak in Bengaluru showrooms.
import { rs, grams, words } from './format.js';
import { SCHEME, PRODUCTS, priceOf } from './config.js';
import * as P from './panels.js';

const roundTo = (n, step) => Math.round(n / step) * step;
const cap = s => s[0].toUpperCase() + s.slice(1);
const ordinal = n => ({ 1: 'first', 2: 'second', 10: 'tenth', 11: 'eleventh', 12: 'twelfth', 13: 'thirteenth' }[n] || `${n}th`);
const monthDelta = r => r.trend.at(-1).v - r.trend[0].v; // 22K change across the trend window
const planMath = amt => { const paid = amt * SCHEME.months, bonus = amt * SCHEME.bonusMonths; return { paid, bonus, total: paid + bonus }; };
const MONTHS = () => `${words(SCHEME.months)} months`;
const BONUS_NTH = () => `${ordinal(SCHEME.months + 1)} instalment`;

// ---------------------------------------------------------------- lines
const EN = {
  welcome: () =>
    `Namaskara, and welcome to CKC Jewellers. [[menu]] I'm your personal concierge. I can share *today's gold rate,* help you start a *gold savings plan,* or help you *choose a piece* and pay right here at your table. What would you like to do?`,
  anythingElse: () => `[[menu]] Is there anything else I can help you with?`,
  goodbye: () => `Thank you for visiting CKC Jewellers. It was a pleasure to assist you. Have a wonderful day!`,
  hold: () => `One moment, please.`,
  notSure: () => `I'm sorry, I didn't quite catch that. You can tap an option on the screen, or try asking me again.`,

  rate: r => {
    const month = monthDelta(r);
    const day = r.change22 === 0 ? `Prices are steady since yesterday,`
      : r.change22 > 0 ? `That's up ${rs(r.change22)} since yesterday,` : `That's down ${rs(-r.change22)} since yesterday,`;
    const trend = month < 0
      ? `[[trend]] and still about ${rs(roundTo(-month, 10))} lower than a month ago, which makes this a *good time to buy.*`
      : `[[trend]] and about ${rs(roundTo(month, 10))} higher than a month ago, so locking in gold *sooner* can help.`;
    return `[[rate]] Here is today's gold rate in Bengaluru. Twenty-two karat is ${rs(r.r22)} per gram, and twenty-four karat is ${rs(r.r24)}. ${day} ${trend}`;
  },
  rateNext: () => `Would you like to lock in gold with a *savings plan,* or explore some pieces at today's rate?`,

  planIntro: () =>
    `[[plan]] Our *Gold Savings Plan* is a lovely way to buy gold a little at a time. You pay a fixed amount every month for *${MONTHS()},* [[bonus]] and CKC pays the *${BONUS_NTH()}* for you. [[amounts]] How much would you like to set aside each month?`,
  planSummary: (amt, r) => {
    const m = planMath(amt);
    return `Wonderful. With ${rs(amt)} a month, [[summary]] you pay ${rs(m.paid)}, and CKC adds ${rs(m.bonus)}, so you can redeem jewellery worth ${rs(m.total)}. At today's rate, that's about ${grams(m.total / r.r22)} of twenty-two karat gold. Shall I set up your first instalment now?`;
  },
  planPay: amt => `[[upi]] Here is your payment code. Please scan it with any UPI app to pay your first instalment of ${rs(amt)}.`,
  planPaid: () => `[[paid]] Payment received, thank you! Welcome to the *CKC Gold Savings Plan.* Your plan passbook has been sent to your phone.`,
  planLater: () => `No problem at all. You can start the plan whenever you like.`,

  gallery: () => `[[gallery]] Here are a few pieces from our *diamond collection,* each one hallmarked and certified. Which one catches your eye?`,
  product: (p, r) => {
    const t = p.i18n.en;
    return `[[product]] Excellent choice. ${cap(t.spoken)} ${t.plural ? 'are' : 'is'} crafted in *${words(p.karat)} karat gold,* with ${t.stone}. [[price]] At today's gold rate, including diamonds, making charges and GST, your total comes to ${rs(priceOf(p, r).total)}. Shall I generate the payment for you?`;
  },
  shopPay: () => `[[upi]] Here's your payment code. Just scan it with Google Pay, PhonePe, or any UPI app.`,
  shopPaid: p => `[[paid]] Payment confirmed, thank you! ${cap(p.i18n.en.spoken)} will be cleaned, certified, and gift-wrapped, and brought to your table in just a few minutes.`,
  shopLater: () => `Of course, take your time. [[gallery]] Would you like to look at another piece?`,
};

const HI = {
  welcome: () =>
    `नमस्ते, CKC ज्वेलर्स में आपका स्वागत है। [[menu]] मैं आपकी personal concierge हूँ। मैं आपको *आज का gold rate* बता सकती हूँ, *gold savings plan* शुरू करने में मदद कर सकती हूँ, या आप कोई *piece चुनकर* यहीं बैठे-बैठे payment कर सकते हैं। बताइए, मैं आपकी क्या मदद करूँ?`,
  anythingElse: () => `[[menu]] क्या मैं आपकी किसी और चीज़ में मदद कर सकती हूँ?`,
  goodbye: () => `CKC ज्वेलर्स आने के लिए धन्यवाद। आपकी मदद करके बहुत अच्छा लगा। आपका दिन शुभ हो!`,
  hold: () => `एक पल, मैं देखती हूँ।`,
  notSure: () => `माफ़ कीजिए, मैं ठीक से समझ नहीं पाई। आप स्क्रीन पर कोई option चुन सकते हैं, या फिर से पूछ सकते हैं।`,

  rate: r => {
    const month = monthDelta(r);
    const day = r.change22 === 0 ? `ये कल जितना ही है,`
      : r.change22 > 0 ? `ये कल से ${rs(r.change22)} ज़्यादा है,` : `ये कल से ${rs(-r.change22)} कम है,`;
    const trend = month < 0
      ? `[[trend]] और एक महीने पहले से लगभग ${rs(roundTo(-month, 10))} कम है, इसलिए ये *खरीदने का अच्छा समय* है।`
      : `[[trend]] और एक महीने पहले से लगभग ${rs(roundTo(month, 10))} ज़्यादा है, इसलिए *जल्दी* gold लेना फ़ायदेमंद रहेगा।`;
    return `[[rate]] ये रहा बेंगलुरु में आज का gold rate। Twenty-two karat का रेट ${rs(r.r22)} प्रति ग्राम है, और twenty-four karat का ${rs(r.r24)}। ${day} ${trend}`;
  },
  rateNext: () => `क्या आप *savings plan* के ज़रिए gold जमा करना चाहेंगे, या आज के रेट पर कुछ pieces देखना चाहेंगे?`,

  planIntro: () =>
    `[[plan]] हमारा *Gold Savings Plan* थोड़ा-थोड़ा करके gold खरीदने का एक बढ़िया तरीका है। आप *${MONTHS()}* तक हर महीने एक तय रकम जमा करते हैं, [[bonus]] और *${BONUS_NTH()}* CKC की तरफ़ से। [[amounts]] आप हर महीने कितना जमा करना चाहेंगे?`,
  planSummary: (amt, r) => {
    const m = planMath(amt);
    return `बहुत बढ़िया। हर महीने ${rs(amt)} से, [[summary]] आप कुल ${rs(m.paid)} जमा करेंगे, और CKC ${rs(m.bonus)} जोड़ेगा, यानी आप ${rs(m.total)} की ज्वेलरी ले सकते हैं। आज के रेट पर ये लगभग ${grams(m.total / r.r22)} twenty-two karat gold है। क्या मैं आपकी पहली instalment अभी set up कर दूँ?`;
  },
  planPay: amt => `[[upi]] ये रहा आपका payment code। अपनी पहली instalment, ${rs(amt)}, देने के लिए किसी भी UPI app से scan कीजिए।`,
  planPaid: () => `[[paid]] Payment मिल गया, धन्यवाद! *CKC Gold Savings Plan* में आपका स्वागत है। आपकी plan passbook आपके फ़ोन पर भेज दी गई है।`,
  planLater: () => `कोई बात नहीं। आप जब चाहें ये plan शुरू कर सकते हैं।`,

  gallery: () => `[[gallery]] ये हैं हमारे *diamond collection* के कुछ pieces, सभी hallmarked और certified। आपको कौन सा पसंद आया?`,
  product: (p, r) => {
    const t = p.i18n.hi;
    return `[[product]] बहुत बढ़िया चुनाव। ${t.spoken} *eighteen karat gold* में ${t.made}, और ${t.stone}। [[price]] आज के gold rate पर, diamonds, making charges और GST मिलाकर, कुल कीमत ${rs(priceOf(p, r).total)} है। क्या मैं payment तैयार कर दूँ?`;
  },
  shopPay: () => `[[upi]] ये रहा आपका payment code। बस Google Pay, PhonePe या किसी भी UPI app से scan कीजिए।`,
  shopPaid: p => `[[paid]] Payment confirm हो गया, धन्यवाद! आपकी ${p.i18n.hi.spoken} साफ़ करके, certify करके और gift-wrap करके, कुछ ही मिनटों में आपकी टेबल पर ${p.i18n.hi.brought}।`,
  shopLater: () => `बिल्कुल, आराम से देखिए। [[gallery]] क्या आप कोई और piece देखना चाहेंगे?`,
};

const KN = {
  welcome: () =>
    `ನಮಸ್ಕಾರ, CKC Jewellers ಗೆ ಸ್ವಾಗತ. [[menu]] ನಾನು ನಿಮ್ಮ personal concierge. ನಾನು *ಇವತ್ತಿನ gold rate* ಹೇಳಬಹುದು, *gold savings plan* ಶುರು ಮಾಡಲು ಸಹಾಯ ಮಾಡಬಹುದು, ಅಥವಾ ನೀವು ಒಂದು *piece ಆಯ್ಕೆ ಮಾಡಿ* ಇಲ್ಲೇ ಕುಳಿತು payment ಮಾಡಬಹುದು. ನಿಮಗೆ ಏನು ಸಹಾಯ ಬೇಕು?`,
  anythingElse: () => `[[menu]] ನಾನು ಇನ್ನೇನಾದರೂ ಸಹಾಯ ಮಾಡಬಹುದಾ?`,
  goodbye: () => `CKC Jewellers ಗೆ ಬಂದಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು. ನಿಮಗೆ ಸಹಾಯ ಮಾಡಿದ್ದು ತುಂಬಾ ಖುಷಿ ಆಯ್ತು. ನಿಮ್ಮ ದಿನ ಶುಭವಾಗಿರಲಿ!`,
  hold: () => `ಒಂದು ಕ್ಷಣ, ನೋಡುತ್ತೇನೆ.`,
  notSure: () => `ಕ್ಷಮಿಸಿ, ನನಗೆ ಸರಿಯಾಗಿ ಅರ್ಥ ಆಗಲಿಲ್ಲ. ಸ್ಕ್ರೀನ್ ಮೇಲೆ ಒಂದು option ಆಯ್ಕೆ ಮಾಡಿ, ಅಥವಾ ಮತ್ತೆ ಕೇಳಿ.`,

  rate: r => {
    const month = monthDelta(r);
    const day = r.change22 === 0 ? `ಇದು ನಿನ್ನೆಯಷ್ಟೇ ಇದೆ,`
      : r.change22 > 0 ? `ಇದು ನಿನ್ನೆಗಿಂತ ${rs(r.change22)} ಜಾಸ್ತಿ,` : `ಇದು ನಿನ್ನೆಗಿಂತ ${rs(-r.change22)} ಕಡಿಮೆ,`;
    const trend = month < 0
      ? `[[trend]] ಮತ್ತು ಒಂದು ತಿಂಗಳ ಹಿಂದಿಗಿಂತ ಸುಮಾರು ${rs(roundTo(-month, 10))} ಕಡಿಮೆ ಇದೆ, ಹಾಗಾಗಿ ಇದು *ಖರೀದಿಸಲು ಒಳ್ಳೆಯ ಸಮಯ.*`
      : `[[trend]] ಮತ್ತು ಒಂದು ತಿಂಗಳ ಹಿಂದಿಗಿಂತ ಸುಮಾರು ${rs(roundTo(month, 10))} ಜಾಸ್ತಿ ಇದೆ, ಹಾಗಾಗಿ *ಬೇಗ* gold ತೆಗೆದುಕೊಳ್ಳುವುದು ಒಳ್ಳೆಯದು.`;
    return `[[rate]] ಇದು ಬೆಂಗಳೂರಿನಲ್ಲಿ ಇವತ್ತಿನ gold rate. Twenty-two karat ಒಂದು ಗ್ರಾಂಗೆ ${rs(r.r22)}, ಮತ್ತು twenty-four karat ${rs(r.r24)}. ${day} ${trend}`;
  },
  rateNext: () => `*Savings plan* ಮೂಲಕ gold ಉಳಿತಾಯ ಮಾಡಲು ಇಷ್ಟಪಡುತ್ತೀರಾ, ಅಥವಾ ಇವತ್ತಿನ rate ನಲ್ಲಿ ಕೆಲವು pieces ನೋಡುತ್ತೀರಾ?`,

  planIntro: () =>
    `[[plan]] ನಮ್ಮ *Gold Savings Plan* ಸ್ವಲ್ಪ ಸ್ವಲ್ಪವಾಗಿ gold ಖರೀದಿಸಲು ಒಂದು ಒಳ್ಳೆಯ ದಾರಿ. ನೀವು *${MONTHS()}* ಪ್ರತಿ ತಿಂಗಳು ಒಂದು ನಿಗದಿತ ಮೊತ್ತ ಕಟ್ಟುತ್ತೀರಿ, [[bonus]] ಮತ್ತು *${BONUS_NTH()}* ಅನ್ನು CKC ಕಟ್ಟುತ್ತದೆ. [[amounts]] ನೀವು ಪ್ರತಿ ತಿಂಗಳು ಎಷ್ಟು ಉಳಿಸಲು ಬಯಸುತ್ತೀರಿ?`,
  planSummary: (amt, r) => {
    const m = planMath(amt);
    return `ತುಂಬಾ ಒಳ್ಳೆಯದು. ತಿಂಗಳಿಗೆ ${rs(amt)} ಅಂದರೆ, [[summary]] ನೀವು ಒಟ್ಟು ${rs(m.paid)} ಕಟ್ಟುತ್ತೀರಿ, CKC ${rs(m.bonus)} ಸೇರಿಸುತ್ತದೆ, ಹಾಗಾಗಿ ನೀವು ${rs(m.total)} ಮೌಲ್ಯದ ಆಭರಣ ತೆಗೆದುಕೊಳ್ಳಬಹುದು. ಇವತ್ತಿನ rate ನಲ್ಲಿ ಅದು ಸುಮಾರು ${grams(m.total / r.r22)} twenty-two karat gold. ನಿಮ್ಮ ಮೊದಲ instalment ಅನ್ನು ಈಗಲೇ set up ಮಾಡಲಾ?`;
  },
  planPay: amt => `[[upi]] ಇದು ನಿಮ್ಮ payment code. ನಿಮ್ಮ ಮೊದಲ instalment ${rs(amt)} ಕಟ್ಟಲು ಯಾವುದೇ UPI app ನಿಂದ scan ಮಾಡಿ.`,
  planPaid: () => `[[paid]] Payment ಬಂದಿದೆ, ಧನ್ಯವಾದಗಳು! *CKC Gold Savings Plan* ಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ plan passbook ಅನ್ನು ನಿಮ್ಮ phone ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ.`,
  planLater: () => `ಪರವಾಗಿಲ್ಲ. ನಿಮಗೆ ಬೇಕಾದಾಗ ಈ plan ಶುರು ಮಾಡಬಹುದು.`,

  gallery: () => `[[gallery]] ಇವು ನಮ್ಮ *diamond collection* ನ ಕೆಲವು pieces, ಎಲ್ಲವೂ hallmarked ಮತ್ತು certified. ನಿಮಗೆ ಯಾವುದು ಇಷ್ಟ ಆಯ್ತು?`,
  product: (p, r) => {
    const t = p.i18n.kn;
    return `[[product]] ಅದ್ಭುತ ಆಯ್ಕೆ. ${t.spoken} *eighteen karat gold* ನಲ್ಲಿ ಮಾಡಲಾಗಿದೆ, ${t.stone}. [[price]] ಇವತ್ತಿನ gold rate ನಲ್ಲಿ, diamonds, making charges ಮತ್ತು GST ಸೇರಿ, ಒಟ್ಟು ಬೆಲೆ ${rs(priceOf(p, r).total)}. Payment ತಯಾರು ಮಾಡಲಾ?`;
  },
  shopPay: () => `[[upi]] ಇದು ನಿಮ್ಮ payment code. Google Pay, PhonePe ಅಥವಾ ಯಾವುದೇ UPI app ನಿಂದ scan ಮಾಡಿ.`,
  shopPaid: p => `[[paid]] Payment confirm ಆಗಿದೆ, ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ${p.i18n.kn.spoken} ಅನ್ನು clean ಮಾಡಿ, certify ಮಾಡಿ, gift-wrap ಮಾಡಿ, ಕೆಲವೇ ನಿಮಿಷಗಳಲ್ಲಿ ನಿಮ್ಮ table ಗೆ ತರಲಾಗುತ್ತದೆ.`,
  shopLater: () => `ಖಂಡಿತ, ನಿಧಾನವಾಗಿ ನೋಡಿ. [[gallery]] ಇನ್ನೊಂದು piece ನೋಡಲು ಇಷ್ಟಪಡುತ್ತೀರಾ?`,
};

export const LINES = { en: EN, hi: HI, kn: KN };

// Every line the demo can say for a given rate + language — voiced ahead of time so playback is instant.
export function allLines(r, lang = 'en') {
  const S = LINES[lang];
  return [
    S.welcome(), S.rate(r), S.rateNext(), S.planIntro(), S.anythingElse(), S.gallery(), S.goodbye(), S.notSure(), S.hold(),
    ...SCHEME.amounts.flatMap(a => [S.planSummary(a, r), S.planPay(a)]), S.planPaid(), S.planLater(),
    ...PRODUCTS.map(p => S.product(p, r)), S.shopPay(), ...PRODUCTS.map(S.shopPaid), S.shopLater(),
  ];
}

// ---------------------------------------------------------------- on-screen options (chips)
// hint = extra words that select the option when spoken (matched locally, before asking GPT).
const UI = {
  en: {
    menu: ["Today's gold rate", 'Gold savings plan', 'Explore & buy'],
    afterRate: ['Start a savings plan', 'Explore pieces'],
    yes: 'Yes, please', no: 'Not now', done: "That's all, thank you", perMonth: 'month',
  },
  hi: {
    menu: ['आज का gold rate', 'Gold savings plan', 'देखें और खरीदें'],
    afterRate: ['Savings plan शुरू करें', 'Pieces देखें'],
    yes: 'हाँ, ज़रूर', no: 'अभी नहीं', done: 'बस, धन्यवाद', perMonth: 'महीना',
  },
  kn: {
    menu: ['ಇವತ್ತಿನ gold rate', 'Gold savings plan', 'ನೋಡಿ ಮತ್ತು ಖರೀದಿಸಿ'],
    afterRate: ['Savings plan ಶುರು ಮಾಡಿ', 'Pieces ನೋಡಿ'],
    yes: 'ಹೌದು, ಖಂಡಿತ', no: 'ಈಗ ಬೇಡ', done: 'ಅಷ್ಟೇ, ಧನ್ಯವಾದಗಳು', perMonth: 'ತಿಂಗಳು',
  },
};
const YES_HINTS = ['yes', 'yeah', 'sure', 'go ahead', 'please do', 'okay', 'ok', 'of course', 'haan', 'ha',
  'हाँ', 'हां', 'जी', 'ठीक है', 'ज़रूर', 'जरूर', 'बिल्कुल', 'ಹೌದು', 'ಸರಿ', 'ಓಕೆ', 'ಖಂಡಿತ', 'ಬೇಕು', 'ಮಾಡಿ'];
const NO_HINTS = ['no', 'not now', 'later', 'nahi', 'maybe later', 'नहीं', 'नही', 'अभी नहीं', 'बाद में', 'ಬೇಡ', 'ಇಲ್ಲ', 'ಈಗ ಬೇಡ', 'ಆಮೇಲೆ'];

const opts = lang => {
  const u = UI[lang];
  return {
    menu: [
      { id: 'gold_rate', label: u.menu[0] },
      { id: 'savings', label: u.menu[1] },
      { id: 'shop', label: u.menu[2] },
    ],
    afterRate: [{ id: 'savings', label: u.afterRate[0] }, { id: 'shop', label: u.afterRate[1] }],
    yesNo: [{ id: 'yes', label: u.yes, hint: YES_HINTS }, { id: 'no', label: u.no, hint: NO_HINTS }],
    done: { id: 'done', label: u.done },
    amounts: SCHEME.amounts.map(a => ({
      id: String(a), label: `₹${a.toLocaleString('en-IN')} / ${u.perMonth}`,
      hint: [words(a), String(a), a.toLocaleString('en-IN'), a / 1000 + 'k', a / 1000 + ' thousand', a / 1000 + ' हज़ार', a / 1000 + ' हजार', a / 1000 + ' ಸಾವಿರ'],
    })),
    pieces: PRODUCTS.map(p => ({ id: p.id, label: p.name, hint: p.words })),
  };
};

// ---------------------------------------------------------------- flows
// c = { lang, S, rate, say, ask, panels, stage, waitPayment }
export const FLOWS = {
  async welcome(c) {
    const o = opts(c.lang);
    await c.say(c.S.welcome(), { menu: () => c.panels.show(P.menuCard(c.lang), { replace: true }) });
    return c.ask('main menu', o.menu);
  },

  async menu(c) {
    const o = opts(c.lang);
    await new Promise(r => setTimeout(r, 1400)); // let the confirmation breathe
    await c.say(c.S.anythingElse(), { menu: () => c.panels.show(P.menuCard(c.lang), { max: 2 }) });
    return c.ask('anything else', [...o.menu, o.done]);
  },

  async gold_rate(c) {
    const r = c.rate, o = opts(c.lang);
    await c.say(c.S.rate(r), {
      rate: () => c.panels.show(P.rateCard(r), { replace: true }),
      trend: () => c.panels.show(P.trendCard(r)),
    });
    await c.say(c.S.rateNext());
    return c.ask('after gold rate', [...o.afterRate, o.done]);
  },

  async savings(c) {
    const o = opts(c.lang);
    let plan;
    await c.say(c.S.planIntro(), {
      plan: () => { plan = c.panels.show(P.planCard(), { replace: true }); },
      bonus: () => plan?.classList.add('show-bonus'),
      amounts: () => c.panels.show(P.amountCard()),
    });
    const amt = +(await c.ask('monthly instalment amount', o.amounts));
    c.panels.root.querySelectorAll('.amount').forEach(b => b.classList.toggle('sel', +b.dataset.choice === amt));
    await c.say(c.S.planSummary(amt, c.rate), {
      summary: () => c.panels.show(P.planSummaryCard(amt, c.rate), { replace: true }),
    });
    if (await c.ask('start first instalment?', o.yesNo) !== 'yes') {
      await c.say(c.S.planLater());
      return 'menu';
    }
    const label = `${SCHEME.name} · Instalment 1 of ${SCHEME.months}`;
    await c.say(c.S.planPay(amt), { upi: () => c.panels.show(P.upiCard(amt, label), { replace: true }) });
    await c.waitPayment();
    await c.say(c.S.planPaid(), {
      paid: () => c.panels.show(P.successCard(amt, label, `<p class="s-note">Passbook sent via SMS &amp; WhatsApp</p>`), { replace: true }),
    });
    return 'menu';
  },

  async shop(c) {
    const o = opts(c.lang);
    await c.say(c.S.gallery(), { gallery: () => c.panels.show(P.galleryCard(), { replace: true }) });
    for (;;) {
      const id = await c.ask('which piece', [...o.pieces, o.done]);
      if (id === 'done') return 'done';
      const p = PRODUCTS.find(x => x.id === id);
      await c.say(c.S.product(p, c.rate), {
        product: () => c.panels.show(P.productCard(p), { replace: true }),
        price: () => c.panels.show(P.priceCard(p, c.rate)),
      });
      if (await c.ask('generate payment?', o.yesNo) === 'yes') {
        const total = priceOf(p, c.rate).total;
        await c.say(c.S.shopPay(), { upi: () => c.panels.show(P.upiCard(total, `${p.name} · ${p.karat}K · ${p.weight} g`), { replace: true }) });
        await c.waitPayment();
        await c.say(c.S.shopPaid(p), {
          paid: () => c.panels.show(P.successCard(total, p.name, `<p class="s-note">Invoice &amp; diamond certificate sent to your phone</p>`), { replace: true }),
        });
        return 'menu';
      }
      await c.say(c.S.shopLater(), { gallery: () => c.panels.show(P.galleryCard(), { replace: true }) });
    }
  },

  async done(c) {
    await c.say(c.S.goodbye());
    return 'attract';
  },
};
