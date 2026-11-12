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
