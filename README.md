# Violin Studio

A local, microphone based violin practice prototype. Milestone 1 contains one exercise: play the four open strings G3, D4, A4, and E5 while reading a treble clef staff. It checks sustained pitch, not rhythm or physical technique.

## Requirements and setup

- Windows with current Chrome or Edge, a microphone, and Node.js 22.12+ (Node 26 tested).
- From `A:\ViolinStudio`, run `npm ci`, then `npm run dev`.
- Open the localhost URL printed by Vite. Choose **Open Strings Practice**, then **Start Listening**. Microphone permission is requested at that point.
- Use **Stop Listening** or **Exercises** to release the microphone. To run without a development server, use `npm run build` followed by `npm run preview`.

The application has no account, backend, telemetry, or runtime web service. All assets are local after dependencies are installed. It is not yet a PWA; run it from a local server while offline. Browser microphone access requires a secure context, which includes `localhost`.

## Checks

`npm test` runs musical logic, synthetic signal, progression, and audio cleanup tests. `npm run build` type checks and builds the production assets. `npm run test:e2e` runs Edge browser checks for notation, permission denial, and progression using an injected synthetic microphone stream; Edge must be installed locally.

The signal fixtures include sine and harmonic rich tones at 44.1 and 48 kHz, near target intonation, silence, noise, and a strong second harmonic. These characterize the Pitchy based pipeline but cannot establish performance on an acoustic violin. Follow [MANUAL_TEST_PLAN.md](MANUAL_TEST_PLAN.md) before treating live note recognition as validated.

## Current behavior and limits

The target tolerance is ±25 cents, with 350 ms of stable matching audio. Both, plus signal thresholds, are set in `src/config.ts`. The next note requires a brief release or a distinct pitch change. The exercise is deterministic and can be repeated freely.

Pitch accuracy depends on microphone placement, room noise, and bowing. A single frequency estimate cannot diagnose fingering, posture, bow grip, or cause of an intonation error. The UI shows uncertainty and waits instead of advancing. Note names can be hidden, but the staff remains visible.
