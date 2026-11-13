# Known nonblocking follow-ups

- A transient octave misidentification can appear on the first detected frame after silence. The present PWA work does not change pitch analysis; capture a real-violin reproduction before adjusting the tuner filter.
- A suspended AudioContext can temporarily leave stale tuner feedback visible. Verify this on the target Android device during app switching, screen lock, and resume before changing audio lifecycle behavior.

- Milestone 2A hold thresholds (±35 cents drift, 450 ms grace, 25% fault budget) were chosen from synthetic tests and reasoning about beginner bowing, not from recorded violin practice. Calibrate them during physical testing.
- Reference-tone suppression is time-based. If a device delays speaker output or the room echoes for more than about 400 ms after the tone, tune `REFERENCE_TONE.settleMs`. Playing the reference during a hold intentionally restarts that note.
- Reference-tone loudness and routing (speaker versus earpiece while the microphone is open) have not been verified on Android hardware. Low notes such as G3 are quieter on small phone speakers; the tone adds soft overtones to help.
- A browser tab in the background throttles the audio poll to about once a second, so any hold in progress resets. This is deliberate.
- The browser suites run with Edge by default; this milestone was verified with Google Chrome for Testing 153 on Linux (`PW_CHANNEL=chrome`), not Edge.

Acoustic violin input and native Android installation have not yet been tested. These are manual acceptance tasks, not completed validations.
