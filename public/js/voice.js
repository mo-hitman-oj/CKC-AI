// Voice engine.
//  • parseScript: turns a concierge line into { spoken text, caption tokens, cue positions }
//      [[cue]]            fire cue when the next word is spoken (e.g. slide in a panel)
//      {display|spoken}   show one thing, say another (₹12,541 ↔ "twelve thousand…") — emphasised
//      *words*            emphasised (stronger entity pulse, highlighted caption)
//  • Speaker: fetches ElevenLabs audio + per-word timings from the server, plays it through
//    an analyser, and fires onWord / cues exactly when each word starts.
//  • Listener: mic capture with simple voice-activity auto-stop.

export class AbortError extends Error { constructor() { super('aborted'); this.name = 'AbortError'; } }

const TRAIL = '([^\\s\\[{*]*)';
const TOKEN_RE = new RegExp(`\\[\\[(\\w+)\\]\\]|\\{([^|}]+)\\|([^}]+)\\}${TRAIL}|\\*([^*]+)\\*${TRAIL}|(\\S+)`, 'g');

export function parseScript(script) {
  const tokens = [];
  const cues = {};
  const spokenWords = [];
  let pending = [];
  const push = (display, spoken, em) => {
    const words = spoken.split(/\s+/).filter(Boolean);
    const start = spokenWords.length;
    if (pending.length) { (cues[start] ||= []).push(...pending); pending = []; }
    spokenWords.push(...words);
    tokens.push({ display, start, count: words.length, em });
  };
  for (const m of script.matchAll(TOKEN_RE)) {
    if (m[1]) pending.push(m[1]);
    else if (m[2]) push(m[2] + m[4], m[3] + m[4], true);
    else if (m[5]) m[5].split(/\s+/).forEach((w, i, a) => push(i === a.length - 1 ? w + m[6] : w, i === a.length - 1 ? w + m[6] : w, true));
    else push(m[7], m[7], /\d/.test(m[7]));
  }
  if (pending.length) (cues[spokenWords.length] ||= []).push(...pending); // trailing cues fire at end
  return { spoken: spokenWords.join(' '), tokens, cues, wordCount: spokenWords.length };
}

let ctx = null;
export function audioContext() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function bandsOf(analyser, buf, freq) {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  analyser.getByteFrequencyData(freq);
  const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += freq[i]; return s / ((b - a) * 255); };
  const n = freq.length;
  return {
    level: Math.min(1, rms * 4.2),
    bass: avg(1, Math.floor(n * 0.04)),
    mid: avg(Math.floor(n * 0.04), Math.floor(n * 0.2)),
    treble: avg(Math.floor(n * 0.2), Math.floor(n * 0.5)),
  };
}

export class Speaker {
  constructor({ onStart, onWord, onEnd } = {}) {
    Object.assign(this, { onStart, onWord, onEnd });
    this.cache = new Map();
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.playing = false;
    this.lang = 'en';
  }

  // Fetch (or reuse) audio + timings for a script. Safe to call ahead of time to pre-warm.
  prepare(script, lang = this.lang) {
    const parsed = parseScript(script);
    const key = lang + '|' + parsed.spoken;
    if (!this.cache.has(key)) {
      const p = fetch('/api/speak', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: parsed.spoken, lang }),
      }).then(r => r.json()).then(j => {
        if (j.error) throw new Error(j.error);
        return j;
      });
      p.catch(() => this.cache.delete(key));
      this.cache.set(key, p);
    }
    return this.cache.get(key).then(tts => ({ parsed, tts }));
  }

  #wire() {
    if (this.analyser) return;
    const ac = audioContext();
    this.analyser = ac.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.5;
    ac.createMediaElementSource(this.audio).connect(this.analyser);
    this.analyser.connect(ac.destination);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
  }

  signal() {
    if (!this.playing || !this.analyser) return null;
    return bandsOf(this.analyser, this.buf, this.freq);
  }

  // Speak a script. cues: { name: fn }. Resolves when finished; rejects AbortError if stopped.
  async say(script, cues = {}, abort) {
    this.stop();
    const { parsed, tts } = await this.prepare(script);
    if (abort?.aborted) throw new AbortError();
    this.#wire();
    audioContext();

    // Map our spoken-word indices to ElevenLabs word timings (identical split in the normal case).
    const ww = tts.words;
    const times = Array.from({ length: parsed.wordCount }, (_, i) =>
      ww.length === parsed.wordCount ? ww[i].start
        : ww[Math.min(ww.length - 1, Math.floor(i * ww.length / parsed.wordCount))]?.start ?? 0);
    const emAt = new Set();
    parsed.tokens.forEach(t => { if (t.em) for (let k = 0; k < t.count; k++) emAt.add(t.start + k); });

    return new Promise((resolve, reject) => {
      const a = this.audio;
      let next = 0;
      let done = false;
      const fireCues = i => (parsed.cues[i] || []).forEach(name => { try { cues[name]?.(); } catch (e) { console.error(e); } });
      const finish = (err) => {
        if (done) return;
        done = true;
        this.playing = false;
        cancelAnimationFrame(this.raf);
        a.onended = a.onerror = null;
        this._cancel = this._skip = null;
        if (!err) { while (next < parsed.wordCount) fireCues(next++); fireCues(parsed.wordCount); }
        this.onEnd?.(parsed, !!err);
        err ? reject(err) : resolve();
      };
      this._cancel = () => finish(new AbortError());
      this._skip = () => { a.pause(); finish(); };
      abort?.addEventListener('abort', this._cancel, { once: true });

      const tick = () => {
        const t = a.currentTime + 0.03; // tiny lead so visuals land with the sound
        while (next < parsed.wordCount && times[next] <= t) {
          fireCues(next);
          this.onWord?.(next, parsed, emAt.has(next));
          next++;
        }
        this.raf = requestAnimationFrame(tick);
      };
      a.onended = () => finish();
      a.onerror = () => finish(new Error('audio playback failed'));
      a.src = tts.audio;
      this.playing = true;
      this.onStart?.(parsed);
      a.play().then(() => { this.raf = requestAnimationFrame(tick); }).catch(e => finish(e));
    });
  }

  // Abort: the pending say() rejects with AbortError.
  stop() {
    if (this._cancel) { this.audio.pause(); this._cancel(); }
  }

  // Barge-in: cut the audio but let say() resolve normally (remaining cues still fire).
  skip() { this._skip?.(); }
}

export class Listener {
  constructor({ onLevel } = {}) { this.onLevel = onLevel; this.active = false; }

  async #ensure() {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ac = audioContext();
    this.analyser = ac.createAnalyser();
    this.analyser.fftSize = 1024;
    ac.createMediaStreamSource(this.stream).connect(this.analyser);
    // Keep the graph pulled (some browsers feed silence to an analyser that isn't connected onward). Muted.
    const mute = ac.createGain();
    mute.gain.value = 0;
    this.analyser.connect(mute).connect(ac.destination);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
  }

  // Records until the speaker pauses (~1.1s of quiet after speech), 12s max, or stop() is called.
  async listen() {
    await this.#ensure();
    this.active = true;
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const started = performance.now();
    let heard = false, quietSince = 0, noise = 0.012, peak = 0;

    return new Promise(resolve => {
      const end = () => { if (rec.state !== 'inactive') rec.stop(); };
      this._stop = end;
      rec.onstop = () => {
        this.active = false;
        cancelAnimationFrame(this.raf);
        this.onLevel?.(null);
        resolve(heard ? new Blob(chunks, { type: rec.mimeType }) : null); // never send silence (STT hallucinates on it)
      };
      rec.start(100);
      const tick = () => {
        const s = bandsOf(this.analyser, this.buf, this.freq);
        this.onLevel?.(s);
        const now = performance.now();
        const rms = s.level / 4.2;
        if (now - started < 300) noise = Math.min(0.045, Math.max(noise, rms * 1.6)); // calibrate to the room (capped)
        // If we can't meter the mic (suspended audio graph, or a device that meters as pure zero),
        // don't give up: record a fixed window and let the transcriber decide.
        peak = Math.max(peak, rms);
        if (this.analyser.context.state !== 'running' || (now - started > 1500 && peak === 0)) {
          if (now - started > 5500) { heard = true; return end(); }
          this.raf = requestAnimationFrame(tick);
          return;
        }
        if (rms > Math.max(0.02, noise)) { heard = true; quietSince = 0; }
        else if (heard) { quietSince ||= now; if (now - quietSince > 1100) return end(); }
        if (now - started > 12000 || (!heard && now - started > 7000)) return end();
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  stop() { this._stop?.(); }
}
