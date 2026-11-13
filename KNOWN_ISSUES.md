# Known nonblocking follow-ups

- A transient octave misidentification can appear on the first detected frame after silence. The present PWA work does not change pitch analysis; capture a real-violin reproduction before adjusting the tuner filter.
- A suspended AudioContext can temporarily leave stale tuner feedback visible. Verify this on the target Android device during app switching, screen lock, and resume before changing audio lifecycle behavior.

- Milestone 2A hold thresholds (±35 cents drift, 450 ms grace, 25% fault budget) were chosen from synthetic tests and reasoning about beginner bowing, not from recorded violin practice. Calibrate them during physical testing.
- Reference-tone suppression is time-based. If a device delays speaker output or the room echoes for more than about 400 ms after the tone, tune `REFERENCE_TONE.settleMs`. Playing the reference during a hold intentionally restarts that note.
- Reference-tone loudness and routing (speaker versus earpiece while the microphone is open) have not been verified on Android hardware. Low notes such as G3 are quieter on small phone speakers; the tone adds soft overtones to help.
- A browser tab in the background throttles the audio poll to about once a second, so any hold in progress resets. This is deliberate.
- The browser suites run with Edge by default; this milestone was verified with Google Chrome for Testing 153 on Linux (`PW_CHANNEL=chrome`), not Edge.

- Milestone 2B: the 450 ms minimum fault budget for short notes and the half-note durations at 80 BPM have only been exercised with synthetic tones. Real bow changes and string crossings may need different values.
- Only 4/4 time and whole and half notes are supported; only C, G, and D major key signatures are defined. Adding a key or duration requires extending `src/notation.ts` and the validator.
- Suggested fingerings are first-position only. The app hears pitch, not which string or finger was used.
- Measure paging uses estimated minimum widths; very unusual measures (many accidentals) could be tighter than ideal.
- Exercise 08 melodies are original and intentionally simple; they have not been reviewed by a violin teacher.

- Milestone 2C: the pitch trail and Auto string selection were exercised only with synthetic oscillator input. Real bowing, vibrato, and string noise may make the trail busier; the 250 ms liveness and 200 ms gap rules may need tuning on Android hardware.
- Auto mode follows the nearest open string within 300 cents, so a badly detuned string (more than about a minor third away) can be identified as its neighbour; use Manual for very out-of-tune strings.
- The trail is drawn on a canvas; screen readers get the text readouts and a summary label, not the history.

Acoustic violin input and native Android installation have not yet been tested. These are manual acceptance tasks, not completed validations.
