# Violin Studio

A local, microphone based violin practice companion. Open Strings Practice checks sustained pitch while reading a treble clef staff. The independent Instrument Tuner provides continuous violin-string or chromatic feedback without scoring.

## Requirements and setup

- Windows with current Chrome or Edge, a microphone, and Node.js 22.12+ (Node 26 tested).
- From `A:\ViolinStudio`, run `npm ci`, then `npm run dev`.
- Open the localhost URL printed by Vite. Choose **Open Strings Practice**, then **Start Listening**. Microphone permission is requested at that point.
- Choose **Instrument Tuner** directly from Home to tune without an exercise. Select a violin string or Chromatic mode, set the A4 reference (415–466 Hz; default 440 Hz), then start listening. The tuner shows detected pitch, signed cents, and a flat/in-tune/sharp meter. In violin mode the meter is relative to the manually selected string; chromatic mode uses the nearest equal-tempered note. The in-tune zone is ±10 cents. A4 is stored locally and also sets the practice exercise's target frequencies.
- Use **Stop Listening** or **Exercises** to release the microphone. For a local production build, use `npm run build` followed by `npm run preview`.

The application has no account, backend, telemetry, or runtime web service. The production build is an installable PWA. Open it once online and wait for **Available offline** before disconnecting; **Preparing offline access…** means the initial cache is still being created. On Android Chrome, open the HTTPS site and use **Install app** from the browser menu. Browser microphone access requires a secure context, which includes HTTPS and `localhost`. Installation and real Android microphone behavior have not yet been physically verified.

## Checks

`npm test` runs musical logic, tuner calculations, synthetic signal, progression, and audio cleanup tests. `npm run build` type checks and builds the production assets. `npm run test:e2e` runs development Edge browser checks using injected synthetic microphone streams. Set `PW_CHANNEL=chrome` to run the browser suites with an installed Google Chrome instead (for example on Linux). After a build, `npm run test:pwa` checks the manifest, icons, precache, offline launch, navigation, update waiting, and narrow viewport in Edge. Edge must be installed locally for browser tests.

The signal fixtures include sine and harmonic rich tones at 44.1 and 48 kHz, near target intonation, silence, noise, and a strong second harmonic. These characterize the Pitchy based pipeline but cannot establish performance on an acoustic violin. Follow [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md) before treating live note recognition as validated.

## Current behavior and limits

Open Strings Practice shows G3, D4, A4, and E5 as whole notes in 4/4, one per measure. In the default **Sustain whole notes** mode each note has two phases: first find the pitch (unlimited time, ±25 cents, 350 ms stable), then hold it for four quarter-note beats at the selected tempo (40–120 BPM, default 60; a whole note lasts 240 / BPM seconds). During the hold, drift within ±35 cents and interruptions up to 450 ms are tolerated; a longer interruption, or more than a quarter of the note spent unsteady, returns only the current note to the find phase. Completion needs a fresh in-tune reading, so silence or a stale estimate cannot finish a note. **Quick check** mode keeps the original 350 ms recognition. **Hear note** plays a short synthesized reference tone; the microphone result is ignored while it plays and for 400 ms afterwards. Students can choose all strings or one string, restart the note or exercise, change tempo, and hide note names. Mode, tempo, and the note-name setting are stored locally. All thresholds are in `src/config.ts`. The next note requires a brief release or a distinct pitch change. The exercise is deterministic and can be repeated freely.

Pitch accuracy depends on microphone placement, room noise, and bowing. A single frequency estimate cannot diagnose fingering, posture, bow grip, or cause of an intonation error. The UI shows uncertainty and waits instead of advancing. Note names can be hidden, but the staff remains visible.

The tuner uses the same detector with a continuous tracking profile and a separate responsive display smoother. Its supported range is 130–1200 Hz; the exercise keeps its 160–800 Hz conservative profile. A reliable estimate outside the tuner range is labeled unsupported. Bowed notes provide more analysis frames; short pizzicato notes may decay before a reliable estimate appears. Harmonics can cause octave mistakes despite outlier rejection. Violin-mode guidance treats a pitch within about 300 cents of the selected string as a potentially detuned string; it cannot identify the physical string. This is equal-tempered tuning relative to the selected A4; pure fifths can differ slightly. Compare the tuner with a conventional chromatic tuner on a real violin using [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md) before relying on it for setup.

For production hosting and update procedures, see [DEPLOYMENT.md](DEPLOYMENT.md). Known follow-ups are tracked in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
