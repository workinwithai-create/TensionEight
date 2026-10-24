const SHA = "d58301e4a494555f411a2afbc448b724136eee76";
const CDN = `https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@${SHA}/public/samples`;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;
const SAMPLE_RATE = 48000;

const state = {
  bpm: 98,
  key: "A minor",
  bars: 8,
  chords: ["Am","F","C","G"],
  recipe: "build",
  mutes: { drums:false, piano:false, bass:false, guitar:false, violin:false, trumpet:false },
  playing: false
};

const recipes = [
  { id:"build", name:"Build", blurb:"Density climbs. Hats open, bass walks, strings swell." },
  { id:"snare-roll", name:"Snare roll", blurb:"Sixteenths into the last bar. Crash on the and." },
  { id:"bass-climb", name:"Bass climb", blurb:"Upright walks 5-6-7 into the root." },
  { id:"pad-swell", name:"Pad swell", blurb:"Violin holds and rises a fourth." },
  { id:"stop-hit", name:"Stop hit", blurb:"Air until beat 4 of the last bar." }
];

const samples = {
  kick: `${CDN}/drums/kick.mp3`,
  snare: `${CDN}/drums/snare.mp3`,
  hat: `${CDN}/drums/hihat.mp3`,
  crash: `${CDN}/drums/crash.mp3`,
  pianoC3: `${CDN}/piano/C3.mp3`,
  pianoC4: `${CDN}/piano/C4.mp3`,
  pianoA3: `${CDN}/piano/A3.mp3`,
  bassE1: `${CDN}/bass/E1.mp3`,
  bassA1: `${CDN}/bass/A1.mp3`,
  bassC2: `${CDN}/bass/C2.mp3`,
  guitarE3: `${CDN}/guitar/E3.mp3`,
  guitarA3: `${CDN}/guitar/A3.mp3`,
  violinA4: `${CDN}/violin/A4.mp3`,
  violinE4: `${CDN}/violin/E4.mp3`,
  trumpetC4: `${CDN}/trumpet/C4.mp3`,
  trumpetG4: `${CDN}/trumpet/G4.mp3`
};

let ctx, master, compressor, chairGains = {}, buffers = {}, rawBuffers = {}, activeSources = [], nextStepTime, step, timerId, rafId;

function midiToNote(m) {
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  return names[m%12] + Math.floor(m/12);
}

async function loadSamples() {
  const entries = Object.entries(samples);
  let loaded = 0;
  const status = document.getElementById("status");
  for (const [name, url] of entries) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(name);
      const ab = await res.arrayBuffer();
      rawBuffers[name] = ab.slice(0);
      buffers[name] = await ctx.decodeAudioData(ab.slice(0));
      loaded++;
      status.textContent = `Loading samples ${loaded}/${entries.length}`;
    } catch (e) {
      status.textContent = `Missing instrument: ${name}`;
      throw e;
    }
  }
  status.textContent = "Ready · tap Play";
}

function setupAudio() {
  if (ctx) return;
  ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  master = ctx.createGain();
  master.gain.value = 0.7;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 6;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  master.connect(compressor);
  compressor.connect(ctx.destination);
  for (const c of Object.keys(state.mutes)) {
    const g = ctx.createGain();
    g.gain.value = state.mutes[c] ? 0 : 0.8;
    g.connect(master);
    chairGains[c] = g;
  }
}

function noteOn(bufferName, time, chair, velocity=0.7, duration=0.2) {
  if (!buffers[bufferName] || state.mutes[chair]) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[bufferName];
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(velocity, time + 0.01);
  g.gain.setValueAtTime(velocity, time + duration - 0.015);
  g.gain.linearRampToValueAtTime(0, time + duration);
  src.connect(g);
  g.connect(chairGains[chair]);
  src.start(time);
  src.stop(time + duration + 0.05);
  activeSources.push(src);
  src.onended = () => { activeSources = activeSources.filter(s => s !== src); };
}

function scheduleStep(stepNum, time) {
  const bars = state.bars;
  const totalSteps = bars * 16;
  const bar = Math.floor(stepNum / 16);
  const beat = Math.floor((stepNum % 16) / 4);
  const sixteenth = stepNum % 4;
  const chordIdx = Math.min(bar, state.chords.length - 1);
  const tension = bar / (bars - 1 || 1); // 0 to 1

  // Drums
  if (!state.mutes.drums) {
    if (sixteenth === 0) noteOn("kick", time, "drums", 0.9, 0.15);
    if (sixteenth === 2 && (beat === 1 || beat === 3 || tension > 0.6)) noteOn("snare", time, "drums", 0.7, 0.12);
    if (tension > 0.4 || state.recipe === "snare-roll") noteOn("hat", time, "drums", 0.4 + tension*0.3, 0.08);
    if (state.recipe === "snare-roll" && bar >= bars-2 && sixteenth % 2 === 0) noteOn("snare", time, "drums", 0.5, 0.08);
    if (bar === bars-1 && beat === 3 && sixteenth === 2) noteOn("crash", time, "drums", 0.6, 0.4);
  }

  // Bass – climb with tension
  if (!state.mutes.bass) {
    const root = 33 + Math.floor(tension * 5); // E1-ish climb
    const buf = tension < 0.4 ? "bassE1" : tension < 0.7 ? "bassA1" : "bassC2";
    if (sixteenth === 0 || (state.recipe === "bass-climb" && sixteenth === 2 && bar > 3))
      noteOn(buf, time, "bass", 0.75, 0.25);
  }

  // Piano chords
  if (!state.mutes.piano && sixteenth === 0) {
    noteOn("pianoC3", time, "piano", 0.5, 0.4);
    noteOn("pianoC4", time, "piano", 0.45, 0.4);
  }

  // Guitar
  if (!state.mutes.guitar && sixteenth === 0 && tension > 0.2)
    noteOn("guitarE3", time, "guitar", 0.5, 0.35);

  // Violin swell
  if (!state.mutes.violin && tension > 0.5 && sixteenth === 0)
    noteOn("violinA4", time, "violin", 0.4 + tension*0.3, 0.5);

  // Trumpet stab near end
  if (!state.mutes.trumpet && bar >= bars-2 && sixteenth === 0 && beat % 2 === 0)
    noteOn("trumpetC4", time, "trumpet", 0.55, 0.2);
}

function scheduler() {
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (state.bars * 16);
  }
}

function start() {
  if (state.playing) return;
  setupAudio();
  if (ctx.state === "suspended") ctx.resume();
  state.playing = true;
  nextStepTime = ctx.currentTime + 0.1;
  step = 0;
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  rafId = requestAnimationFrame(updatePlayhead);
  document.getElementById("status").textContent = "Playing";
}

function stop() {
  state.playing = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  activeSources.forEach(s => { try { s.stop(); } catch(e){} });
  activeSources = [];
  if (rafId) cancelAnimationFrame(rafId);
  document.getElementById("playhead").style.width = "0%";
  document.getElementById("status").textContent = "Stopped";
}

function updatePlayhead() {
  if (!state.playing || !ctx) return;
  const elapsed = ctx.currentTime - (nextStepTime - (step * (60/state.bpm/4)));
  const total = state.bars * 4 * 60 / state.bpm;
  const pct = Math.min(100, (elapsed / total) * 100);
  document.getElementById("playhead").style.width = pct + "%";
  rafId = requestAnimationFrame(updatePlayhead);
}

function saveState() {
  localStorage.setItem("tensioneight", JSON.stringify({
    bpm: state.bpm, key: state.key, bars: state.bars, chords: state.chords.join(" "), recipe: state.recipe
  }));
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("tensioneight") || "{}");
    if (s.bpm) state.bpm = s.bpm;
    if (s.key) state.key = s.key;
    if (s.bars) state.bars = s.bars;
    if (s.chords) state.chords = s.chords.split(/\s+/);
    if (s.recipe) state.recipe = s.recipe;
  } catch(e) {}
}

function wireUI() {
  document.getElementById("startBtn").onclick = async () => {
    setupAudio();
    await ctx.resume();
    document.getElementById("tap").style.display = "none";
    await loadSamples();
  };
  document.getElementById("play").onclick = start;
  document.getElementById("stop").onclick = stop;
  document.getElementById("bpm").onchange = e => { state.bpm = +e.target.value; saveState(); };
  document.getElementById("key").onchange = e => { state.key = e.target.value; saveState(); };
  document.getElementById("bars").onchange = e => { state.bars = +e.target.value; saveState(); };
  document.getElementById("chords").onchange = e => { state.chords = e.target.value.trim().split(/\s+/); saveState(); };

  const chairsEl = document.getElementById("chairs");
  Object.keys(state.mutes).forEach(c => {
    const div = document.createElement("div");
    div.className = "chair";
    div.innerHTML = `<label><input type="checkbox" ${state.mutes[c]?"":"checked"} data-chair="${c}"> ${c}</label>`;
    chairsEl.appendChild(div);
  });
  chairsEl.onchange = e => {
    if (e.target.dataset.chair) {
      state.mutes[e.target.dataset.chair] = !e.target.checked;
      if (chairGains[e.target.dataset.chair]) chairGains[e.target.dataset.chair].gain.value = e.target.checked ? 0.8 : 0;
    }
  };

  const recEl = document.getElementById("recipes");
  recipes.forEach(r => {
    const b = document.createElement("button");
    b.textContent = r.name;
    b.title = r.blurb;
    b.onclick = () => { state.recipe = r.id; saveState(); };
    recEl.appendChild(b);
  });

  document.getElementById("exportWav").onclick = exportWav;
  document.getElementById("exportMid").onclick = exportMidi;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.playing) stop();
  });
}

async function exportWav() {
  const bars = state.bars;
  const bpm = state.bpm;
  const length = Math.round(bars * 4 * 60 / bpm * SAMPLE_RATE);
  const offline = new OfflineAudioContext(2, length + SAMPLE_RATE, SAMPLE_RATE); // extra for tail
  // re-decode raw
  const offBuffers = {};
  for (const [n, ab] of Object.entries(rawBuffers)) {
    offBuffers[n] = await offline.decodeAudioData(ab.slice(0));
  }
  const offMaster = offline.createGain();
  offMaster.gain.value = 0.6;
  const offComp = offline.createDynamicsCompressor();
  offComp.threshold.value = -10;
  offMaster.connect(offComp);
  offComp.connect(offline.destination);

  // simple render of the sequence
  let t = 0;
  const stepDur = 60 / bpm / 4;
  for (let s = 0; s < bars * 16; s++) {
    // mirror scheduleStep logic lightly
    if (s % 4 === 0) {
      const src = offline.createBufferSource();
      src.buffer = offBuffers.kick;
      src.connect(offMaster);
      src.start(t);
    }
    t += stepDur;
  }
  const rendered = await offline.startRendering();
  // fold tail
  const loopSamples = length;
  const data = rendered.getChannelData(0);
  for (let i = 0; i < Math.min(SAMPLE_RATE, data.length - loopSamples); i++) {
    data[i] += data[loopSamples + i] * 0.5;
  }
  // peak limit to -1dBFS
  let peak = 0;
  for (let i = 0; i < loopSamples; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak > 0 ? 0.891 / peak : 1; // -1 dBFS
  // write WAV (simplified 16-bit for demo; full 24-bit would be longer)
  const wav = encodeWav(rendered, loopSamples, gain);
  download(wav, `tensioneight-${state.recipe}-${bpm}bpm-${state.key.replace(/\s/g,"")}.wav`);
}

function encodeWav(buffer, samples, gain) {
  // minimal 16-bit stereo WAV
  const numCh = 2;
  const byteRate = SAMPLE_RATE * numCh * 2;
  const blockAlign = numCh * 2;
  const dataSize = samples * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (o,s) => { for(let i=0;i<s.length;i++) view.setUint8(o+i, s.charCodeAt(i)); };
  writeStr(0, "RIFF"); view.setUint32(4, 36+dataSize, true); writeStr(8, "WAVE");
  writeStr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true);
  writeStr(36, "data"); view.setUint32(40, dataSize, true);
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.getChannelData(1);
  let off = 44;
  for (let i = 0; i < samples; i++) {
    const s0 = Math.max(-1, Math.min(1, ch0[i] * gain));
    const s1 = Math.max(-1, Math.min(1, ch1[i] * gain));
    view.setInt16(off, s0 * 0x7FFF, true); off += 2;
    view.setInt16(off, s1 * 0x7FFF, true); off += 2;
  }
  return new Blob([buf], {type:"audio/wav"});
}

function exportMidi() {
  // stub multi-track MIDI
  const midi = new Uint8Array([0x4D,0x54,0x68,0x64,0x00,0x00,0x00,0x06,0x00,0x01,0x00,0x02,0x00,0x60]); // header
  download(new Blob([midi], {type:"audio/midi"}), `tensioneight-${state.recipe}-${state.bpm}bpm-${state.key.replace(/\s/g,"")}.mid`);
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

loadState();
wireUI();
document.getElementById("bpm").value = state.bpm;
document.getElementById("key").value = state.key;
document.getElementById("bars").value = state.bars;
document.getElementById("chords").value = state.chords.join(" ");
