# Known nonblocking follow-ups

- A transient octave misidentification can appear on the first detected frame after silence. The present PWA work does not change pitch analysis; capture a real-violin reproduction before adjusting the tuner filter.
- A suspended AudioContext can temporarily leave stale tuner feedback visible. Verify this on the target Android device during app switching, screen lock, and resume before changing audio lifecycle behavior.

Acoustic violin input and native Android installation have not yet been tested. These are manual acceptance tasks, not completed validations.
