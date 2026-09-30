// Demo content you can edit. Everything CKC-specific lives here.

export const STORE = {
  name: 'CKC Jewellers',
  city: 'Bengaluru',
  // DUMMY payee — deliberately not a real account. Replace with CKC's merchant VPA for a real payment.
  upiVpa: 'ckcjewellers.demo@upi',
  upiName: 'CKC Jewellers',
};

// Savings scheme — placeholder terms. Replace with CKC's actual scheme before showing it as fact.
export const SCHEME = {
  name: 'CKC Gold Savings Plan',
  months: 11,          // customer pays this many instalments
  bonusMonths: 1,      // CKC contributes this many instalments
  amounts: [5000, 10000, 25000],
};

// Pieces for the "choose & pay" flow. Price = gold weight × karat rate + stones + making% (on gold) + 3% GST.
export const PRODUCTS = [
  {
    id: 'ring', name: 'Solitaire Ring', collection: 'Eternal Solitaires', img: 'assets/img/ring.png',
    karat: 18, weight: 3.6, stoneLabel: '0.40 ct solitaire · VS1 · F', stoneValue: 78000, making: 0.14,
    words: ['ring', 'solitaire', 'रिंग', 'अंगूठी', 'सॉलिटेयर', 'ರಿಂಗ್', 'ಉಂಗುರ', 'ಸಾಲಿಟೇರ್'],
    i18n: {
      en: { spoken: 'the solitaire ring', stone: 'a forty-cent solitaire diamond of exceptional clarity' },
      hi: { spoken: 'Solitaire Ring', made: 'बनी है', stone: 'इसमें forty-cent का एक बेहद साफ़ solitaire diamond है', brought: 'लाई जाएगी' },
      kn: { spoken: 'Solitaire Ring', stone: 'ಇದರಲ್ಲಿ forty-cent ನ ಅತ್ಯುತ್ತಮ clarity ಯ solitaire diamond ಇದೆ' },
    },
  },
  {
    id: 'earrings', name: 'Halo Drop Earrings', collection: 'Aura Halo', img: 'assets/img/earrings.png',
    karat: 18, weight: 5.8, stoneLabel: '0.62 ct diamonds · VS · G', stoneValue: 64000, making: 0.14,
    words: ['earrings', 'earring', 'drops', 'halo drop', 'इयररिंग', 'इयररिंग्स', 'झुमके', 'बाली', 'बालियाँ', 'ಇಯರಿಂಗ್', 'ಇಯರಿಂಗ್ಸ್', 'ಓಲೆ', 'ಜುಮ್ಕಿ'],
    i18n: {
      en: { spoken: 'the halo drop earrings', plural: true, stone: 'sixty-two cents of brilliant diamonds set in a halo' },
      hi: { spoken: 'Halo Drop Earrings', made: 'बने हैं', stone: 'इनमें halo में जड़े sixty-two cents के brilliant diamonds हैं', brought: 'लाए जाएँगे' },
      kn: { spoken: 'Halo Drop Earrings', stone: 'halo ನಲ್ಲಿ sixty-two cents ನ brilliant diamonds ಕೂರಿಸಲಾಗಿದೆ' },
    },
  },
  {
    id: 'pendant', name: 'Halo Pendant & Chain', collection: 'Aura Halo', img: 'assets/img/pendant.png',
    karat: 18, weight: 4.2, stoneLabel: '0.30 ct diamonds · VS · G', stoneValue: 32000, making: 0.12,
    words: ['pendant', 'chain', 'necklace', 'पेंडेंट', 'चेन', 'हार', 'लॉकेट', 'ಪೆಂಡೆಂಟ್', 'ಚೈನ್', 'ಸರ', 'ಲಾಕೆಟ್'],
    i18n: {
      en: { spoken: 'the halo pendant', stone: 'a halo of brilliant diamonds on a fine gold chain' },
      hi: { spoken: 'Halo Pendant', made: 'बना है', stone: 'इसमें brilliant diamonds का halo है, और साथ में एक नाज़ुक gold chain', brought: 'लाया जाएगा' },
      kn: { spoken: 'Halo Pendant', stone: 'brilliant diamonds ನ halo ಜೊತೆ ಒಂದು ನಾಜೂಕಾದ gold chain ಇದೆ' },
    },
  },
];

export const GST = 0.03;

export function priceOf(p, rate) {
  const perGram = p.karat === 22 ? rate.r22 : p.karat === 24 ? rate.r24 : rate.r18;
  const gold = Math.round(p.weight * perGram);
  const making = Math.round(gold * p.making);
  const sub = gold + making + p.stoneValue;
  const gst = Math.round(sub * GST);
  return { perGram, gold, making, stone: p.stoneValue, gst, total: sub + gst };
}
