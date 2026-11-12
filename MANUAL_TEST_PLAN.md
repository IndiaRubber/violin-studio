# Real violin manual test plan

Use a Windows Chrome or Edge browser at localhost and an acoustic violin. Note the browser, input device, sample rate if known, room, microphone distance, and whether another app applies noise suppression. Open developer diagnostics during each trial. Record observed raw/smoothed frequency, clarity, RMS, and match state. Do not infer physical technique from these readings.

1. Start the exercise. Confirm permission is requested only after **Start Listening**. Deny permission, retry after allowing it, and test with no microphone connected.
2. Play G3, D4, A4, and E5 in order at normal bow volume. Confirm staff placement (G3 on the space below two ledger lines, D4 below staff, A4 within staff, E5 on top space), target highlight, detected octave, and advancement after a steady in tune note. The current target must advance once only.
3. Sustain each string longer than one second. Confirm no duplicate advancement. Pause briefly between notes, then change strings without a pause; both should permit the next target.
4. Deliberately play roughly 15–20 cents flat, then sharp, where practical using fingered reference tones or controlled detuning. Confirm the signed cents meter direction and no advancement beyond ±25 cents. Retune afterward.
5. Test very soft and strong bowing, a noisy bow attack, unstable pitch, and sudden string changes. Watch for false octaves and premature success. A low or uncertain signal should say so and not advance.
6. Test silence and environmental noise (speech, fan, nearby music). Confirm the microphone does not advance on noise or stale pitch.
7. Stop listening and exit to Exercises. Confirm the browser microphone indicator clears. Unplug the input device mid exercise and confirm a recoverable error.
8. Resize to a narrow viewport. Confirm the notation, labels, meter, controls, and diagnostics remain usable without clipping.

Log each false positive, false negative, and delayed response with target note, detected note, cents, clarity, and RMS. Pitchy and current thresholds have only been tested with synthetic signals; acoustic violin behavior remains unverified until this plan is performed.

## Instrument Tuner acceptance

Use a conventional chromatic tuner as a reference. Tune the same real violin with both devices in the same room. Record microphone distance and device, A4 setting, detected frequency, note and octave, signed cents, clarity, and RMS. Allow for small differences from equal temperament when comparing pure violin fifths.

1. Open **Instrument Tuner** directly from Home. Confirm no microphone permission request occurs until **Start Listening**. Select G3, D4, A4, and E5 manually; bow each open string and compare the detected note and cents direction with the reference tuner.
2. Deliberately tune each string slightly flat and sharp. Confirm the meter moves in the correct direction, the in-tune indicator appears only near center (±10 cents), and changing A4 from 440 to 442 Hz shifts the reading as expected without restarting capture.
3. Select Chromatic mode. Play several notes and octaves within the tuner's 130–1200 Hz range, including B5 near 988 Hz and semitone neighbors. Check nearest note and octave against the reference tuner. Verify a reliable signal beyond this range is labeled unsupported, while silence and low-confidence noise have distinct states.
4. Pluck each open string, then bow it. Record how quickly a reliable reading appears and whether the plucked note decays before detection. Do not interpret a missed short pluck as verified pizzicato support.
5. Test silence, soft playing, bow attacks, vibrato, room noise, and strong upper harmonics. Confirm uncertain readings and isolated octave errors do not remain on screen as a confident pitch.
6. Stop listening, leave the tuner, and open Open Strings Practice. Confirm the browser microphone indicator clears on leaving the tuner, and only one input session is active. Also test permission denial, unplugging the input device, and leaving while permission is pending.
7. With a stable bowed note, move the pitch gradually using a tuning peg and compare the display's continuity with the reference tuner. Add modest vibrato and deliberate sudden note changes. Watch for display freezes, octave jumps, stale in-tune labels, and excessive spoken screen-reader updates.
8. Change A4 to 415, 432, 442, and 466 Hz in turn. Return Home and open practice; confirm the target frequencies match the selected reference. Reload and confirm the setting persists. Enter an out-of-range value and confirm a clear validation message appears.
