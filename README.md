# CKC Jewellers · AI Concierge

A landscape, table-side AI concierge demo. A 3D entity (molten gold by default) speaks with a
real voice, and **every spoken word drives a pulse** on the entity and lights up the caption.
As it talks, it glides left and brings in live UI cards on the right: gold rate, savings plan,
product and price breakdown, and a UPI QR code.

## Run

```bash
node server.js          # → http://localhost:5173  (Node 18+, no npm install)
```

Keys are read from `.env` (`OPEN_AI_KEY`, `ELEVENLABS_API_KEY`). Open the page and wait for
**Settings** until English, Hindi and Kannada each show 25/25 (first load generates and caches the voice to `voice-cache/`).
Then press **Begin** (or Enter). Press **F** for fullscreen.

## Languages

English, हिंदी and ಕನ್ನಡ, chosen with the picker on the welcome screen (or **L**). Every scripted line, chip and the menu card
are translated. Numbers and trade terms (gold rate, karat, UPI, GST) stay in English inside Hindi and Kannada sentences,
the way people talk in Bengaluru showrooms. Live questions are transcribed and answered in the chosen language.
Voices: `eleven_multilingual_v2` for English and Hindi; `eleven_v3` for Kannada (v2 garbles it). v3 is slow (about 8s for a
short live answer), so the concierge says a pre-voiced "one moment" first. Scripted lines are all pre-cached.

## Guided-live mode

* **Scripted flows:** each line is voiced by ElevenLabs *with word timestamps*, so panel reveals,
  caption highlights and entity pulses land on the exact word ("…twenty-two karat is **₹12,571**…").
* **Live voice:** tap the mic, or press **Space**, and speak. `gpt-4o-transcribe` transcribes the speech.
  `gpt-4.1-mini` then either starts a flow, picks an on-screen option ("the earrings", "ten thousand",
  "yes please"), or answers a free-form question. Answers are spoken with the same word-synced voice.
  Tapping the mic while it's talking interrupts it.
* **Live gold rate:** COMEX gold × USD/INR (Yahoo Finance) plus ~6.5% import duty/premium gives an
  indicative Indian retail rate, with 22K/18K derived from it. Falls back to fixed figures if offline.

### Flows
1. **Today's gold rate:** 22K/24K/18K/silver card plus a one-month trend. The spoken line adapts to
   whether gold is up or down.
2. **Gold Savings Plan:** 11 + 1 month plan, choose ₹5k/₹10k/₹25k, maturity summary, then a UPI QR for
   the first instalment, then confirmation.
3. **Explore & buy:** three pieces, then product and price breakdown (gold × today's rate + diamonds + making
   + 3% GST), then a UPI QR with the amount, then confirmation.

## Presenter keys
`Space` talk · `Enter` begin · `1/2/3` jump to a flow · `P` or click the QR to confirm payment ·
`R`/`Esc` reset · `L` language · `S` settings (switch entity: Molten Gold / Crystal Diamond / Classic) · `F` fullscreen

## Edit content
* `public/js/config.js`: products, prices, **savings-scheme terms (placeholder, replace with CKC's real
  scheme)**, UPI payee (**dummy VPA**, replace with the merchant VPA for real payments).
* `public/js/flows.js`: everything the concierge says. `[[cue]]` = bring in a panel on the next word,
  `{₹12,571|twelve thousand…}` = show one thing and say another, `*words*` = emphasis (bigger pulse).
* `.env` optional overrides: `VOICE_ID`, `TTS_MODEL`, `CHAT_MODEL`, `STT_MODEL`.

## Files
```
server.js                 static server + /api (gold-rate, speak, transcribe, route)
public/index.html         layout
public/styles.css         design
public/js/app.js          orchestration: state, flows runner, mic, captions, settings, keys
public/js/voice.js        script parser, word-synced Speaker, Listener (VAD)
public/js/flows.js        conversation scripts
public/js/panels.js       right-hand cards
public/js/stage/          Three.js stage + entities (goldOrb, crystal, classic)
public/legacy/            previous version (reference)
```

Dev: `?shot=menu|rate|plan|summary|gallery|price|upi|success` renders a screen without audio.
`?nobloom` disables bloom.
