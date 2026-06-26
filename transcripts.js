// Spoken transcripts for each language, split into caption lines.
// Captions are revealed in sync with playback (weighted by line length),
// so they advance with the voice without needing hand-authored timestamps.
// Source: subtitle.md

export const TRANSCRIPTS = {
  english: {
    name: 'English',
    native: 'English',
    code: 'EN',
    audio: 'assets/audio/english.mp3',
    lines: [
      'Welcome to CKC Jewellers.',
      "I'm your AI Jewellery Concierge — here to help you discover the perfect piece.",
      'I can recommend collections, explain diamond quality, compare designs, and answer your questions in real time.',
      'How may I assist you today?',
    ],
  },
  hindi: {
    name: 'हिन्दी',
    native: 'Hindi',
    code: 'हिं',
    audio: 'assets/audio/hindi.mp3',
    lines: [
      'नमस्ते, CKC ज्वेलर्स में आपका स्वागत है।',
      'आज मैं आपकी किस तरह सहायता कर सकता हूँ?',
    ],
  },
  kannada: {
    name: 'ಕನ್ನಡ',
    native: 'Kannada',
    code: 'ಕನ್',
    audio: 'assets/audio/kannada.mp3',
    lines: [
      'ನಮಸ್ಕಾರ, CKC Jewellers‌ಗೆ ಸ್ವಾಗತ.',
      'ನಾನು ನಿಮ್ಮ ಎಐ ಜುವೆಲರಿ ಕನ್ಸಿಯರ್ಜ್.',
      'ಮದುವೆ, ವಾರ್ಷಿಕೋತ್ಸವ ಅಥವಾ ವಿಶೇಷ ಉಡುಗೊರಿಗಾಗಿ ಸೂಕ್ತ ಆಭರಣವನ್ನು ಆಯ್ಕೆ ಮಾಡಲು ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.',
      'ವಜ್ರಗಳ ಗುಣಮಟ್ಟವನ್ನು ವಿವರಿಸಬಹುದು, ವಿವಿಧ ವಿನ್ಯಾಸಗಳನ್ನು ಹೋಲಿಸಬಹುದು ಮತ್ತು ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳಿಗೆ ತಕ್ಷಣ ಉತ್ತರಿಸಬಹುದು.',
      'ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
    ],
  },
};

// Default caption shown while idle.
export const IDLE_TAGLINE = "I'm here to help you find the perfect piece.";
