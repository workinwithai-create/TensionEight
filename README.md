# TensionEight

Eight-bar tension builder desk for bedroom producers and AI-music finishers.

A stuck 8-bar loop needs a reason to leave. TensionEight seats live FluidR3 chairs that raise density, walk the bass, swell the strings, and roll the snare so the next section has to happen. Export the WAV + MIDI and drop them on bar 1 of your DAW.

Distinct from StackFour (stacking), CallEight (call-response), LiftTwo (short climb), WalkBass (bass only).

Live samples only. FluidR3 piano, upright, nylon, trumpet, violin, and acoustic kit from the PreEight bank pinned to commit `d58301e4a494555f411a2afbc448b724136eee76`. No oscillators. Audio never leaves the tab.

This desk is free.

## Why this exists

79% of producers struggle to finish tracks. The most common stall is the 8-bar loop that feels complete but has no exit. TensionEight gives the loop an exit by building measurable tension that demands resolution.

## Controls

- BPM 60–180
- Key selector (transposes the voicings)
- 4-chord entry (Am F C G etc.)
- Recipe (build, snare-roll, bass-climb, pad-swell, stop-hit)
- Chair mutes (live, next step)
- Bars 4 or 8

Settings persist in localStorage.

## Samples

Pinned commit SHA only.

- PreEight bank @d58301e4a494555f411a2afbc448b724136eee76

Branch tips are not allowed.

## Export

Default bounce is 48 kHz. At 92 BPM and 8 bars the loop file is exactly 1,001,739 samples (`Math.round(8 * 4 * 60 / 92 * 48000)`), first downbeat at sample 0. The offline render decodes the already-loaded ArrayBuffers. It does not re-download. MIDI writes one track per chair with tempo and 4/4 set.

Files: `tensioneight-<recipe>-<bpm>bpm-<key>.wav` and the matching `.mid`.

## Acceptance checks

1) Export at 92 BPM, 8 bars, 48 kHz: exactly 1,001,739 samples, first transient within 1 ms of sample 0.  
2) Import the WAV at bar 1 of a 92 BPM DAW session and loop it 4 times. No clicks at the seam, no drift.  
3) Play, switch to another tab for 30 seconds, and come back. The app is stopped cleanly, with no burst of stacked notes.  
4) Change recipe, mutes, and BPM while playing. Each change is heard within one bar, with no restart.  
5) Block the sample host in devtools and reload. The UI names the missing instruments.  
6) Hold the longest pad at the slowest preset tempo. It sustains to the end of the note.  
7) Grep the code: no @main or @gh-pages, no Math.random in the export path, and no voice name that doesn't match its sample.

## Pricing recommendation

**One-time $12–19 on Gumroad or Lemon Squeezy.**

This is a finite finishing tool, not a daily driver. One-time matches the "get unstuck once" job. Subscription only makes sense inside the Forge Pass bundle. Sell on Gumroad (simple, music-producer friendly) or Lemon Squeezy (better for EU VAT). Promote on r/WeAreTheMusicMakers, X, and Product Hunt. Do not put it on Plugin Boutique or the App Store.

## License

MIT. workinwithai-create.

Deploy target: Vercel team `release-forge`.
