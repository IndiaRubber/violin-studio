# Violin Studio

A local, microphone based violin practice companion. Open Strings Practice checks sustained pitch while reading a treble clef staff. The independent Instrument Tuner provides continuous violin-string or chromatic feedback without scoring.

## Requirements and setup

- Windows with current Chrome or Edge, a microphone, and Node.js 22.12+ (Node 26 tested).
- From `A:\ViolinStudio`, run `npm ci`, then `npm run dev`.
- Open the localhost URL printed by Vite. Choose **Open Strings Practice**, then **Start Listening**. Microphone permission is requested at that point.
- Choose **Instrument Tuner** directly from Home to tune without an exercise. Select a violin string or Chromatic mode, set the A4 reference (415–466 Hz; default 440 Hz), then start listening. The tuner shows detected pitch, signed cents, and a flat/in-tune/sharp meter. In violin mode the meter is relative to the manually selected string; chromatic mode uses the nearest equal-tempered note. The in-tune zone is ±10 cents. A4 is stored locally and also sets the practice exercise's target frequencies.
- Use **Stop Listening** or **Exercises** to release the microphone. To run without a development server, use `npm run build` followed by `npm run preview`.

The application has no account, backend, telemetry, or runtime web service. All assets are local after dependencies are installed. It is not yet a PWA; run it from a local server while offline. Browser microphone access requires a secure context, which includes `localhost`.

## Checks

`npm test` runs musical logic, tuner calculations, synthetic signal, progression, and audio cleanup tests. `npm run build` type checks and builds the production assets. `npm run test:e2e` runs Edge browser checks using injected synthetic microphone streams; Edge must be installed locally.

The signal fixtures include sine and harmonic rich tones at 44.1 and 48 kHz, near target intonation, silence, noise, and a strong second harmonic. These characterize the Pitchy based pipeline but cannot establish performance on an acoustic violin. Follow [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md) before treating live note recognition as validated.

## Current behavior and limits

The target tolerance is ±25 cents, with 350 ms of stable matching audio. Both, plus signal thresholds, are set in `src/config.ts`. The next note requires a brief release or a distinct pitch change. The exercise is deterministic and can be repeated freely.

Pitch accuracy depends on microphone placement, room noise, and bowing. A single frequency estimate cannot diagnose fingering, posture, bow grip, or cause of an intonation error. The UI shows uncertainty and waits instead of advancing. Note names can be hidden, but the staff remains visible.

The tuner uses the same detector with a continuous tracking profile and a separate responsive display smoother. Its supported range is 130–1200 Hz; the exercise keeps its 160–800 Hz conservative profile. A reliable estimate outside the tuner range is labeled unsupported. Bowed notes provide more analysis frames; short pizzicato notes may decay before a reliable estimate appears. Harmonics can cause octave mistakes despite outlier rejection. Violin-mode guidance treats a pitch within about 300 cents of the selected string as a potentially detuned string; it cannot identify the physical string. This is equal-tempered tuning relative to the selected A4; pure fifths can differ slightly. Compare the tuner with a conventional chromatic tuner on a real violin using [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md) before relying on it for setup.
