// Indian-style number formatting for display (₹1,23,456) and for speech
// ("one lakh twenty-three thousand four hundred and fifty-six").

export const inr = (n, { decimals = 0 } = {}) =>
  '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const num = n => Number(n).toLocaleString('en-IN');

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function under100(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
}
function under1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  if (!h) return under100(r);
  return ONES[h] + ' hundred' + (r ? ' and ' + under100(r) : '');
}

// Indian number words: crore / lakh / thousand.
export function words(n) {
  n = Math.round(Math.abs(n));
  if (n === 0) return 'zero';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(under1000(crore) + ' crore');
  if (lakh) parts.push(under100(lakh) + ' lakh');
  if (thousand) parts.push(under100(thousand) + ' thousand');
  if (n) parts.push((parts.length && n < 100 ? 'and ' : '') + under1000(n));
  return parts.join(' ');
}

// Script token for a rupee amount: shows "₹12,541" on screen, speaks it in words.
export const rs = n => `{${inr(n)}|${words(n)} rupees}`;

// Decimal grams, spoken naturally ("nine point six grams").
export function grams(g, dp = 1) {
  const v = Number(g).toFixed(dp);
  const [i, d] = v.split('.');
  const spoken = words(+i) + (d && +d ? ' point ' + d.split('').map(x => ONES[+x]).join(' ') : '');
  return `{${v} g|${spoken} grams}`;
}

export const timeNow = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
