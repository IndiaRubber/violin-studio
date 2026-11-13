# Real violin manual test plan

Use a Windows Chrome or Edge browser at localhost and an acoustic violin. Note the browser, input device, sample rate if known, room, microphone distance, and whether another app applies noise suppression. Open developer diagnostics during each trial. Record observed raw/smoothed frequency, clarity, RMS, and match state. Do not infer physical technique from these readings.

1. Start the exercise. Confirm permission is requested only after **Start Listening**. Deny permission, retry after allowing it, and test with no microphone connected.
2. Select **Quick check** mode for steps 2–6 (the Milestone 1 behaviour). Play G3, D4, A4, and E5 in order at normal bow volume. Confirm staff placement (G3 on the space below two ledger lines, D4 below staff, A4 within staff, E5 on top space), target highlight, detected octave, and advancement after a steady in tune note. The current target must advance once only.
3. Sustain each string longer than one second. Confirm no duplicate advancement. Pause briefly between notes, then change strings without a pause; both should permit the next target.
4. Deliberately play roughly 15–20 cents flat, then sharp, where practical using fingered reference tones or controlled detuning. Confirm the signed cents meter direction and no advancement beyond ±25 cents. Retune afterward.
5. Test very soft and strong bowing, a noisy bow attack, unstable pitch, and sudden string changes. Watch for false octaves and premature success. A low or uncertain signal should say so and not advance.
6. Test silence and environmental noise (speech, fan, nearby music). Confirm the microphone does not advance on noise or stale pitch.
7. Stop listening and exit to Exercises. Confirm the browser microphone indicator clears. Unplug the input device mid exercise and confirm a recoverable error.
8. Resize to a narrow viewport. Confirm the notation, labels, meter, controls, and diagnostics remain usable without clipping.

Log each false positive, false negative, and delayed response with target note, detected note, cents, clarity, and RMS. Pitchy and current thresholds have only been tested with synthetic signals; acoustic violin behavior remains unverified until this plan is performed.

## Milestone 2A: sustained whole notes (not yet performed on a violin)

Use Android Chrome at the production URL where possible, and a real violin. Keep developer diagnostics open; record phase/state, hold time, and hold fault time for each failure.

1. Open **Open Strings Practice**. Confirm four whole notes (open noteheads, no stems), one per measure, a 4/4 time signature, ♩ = 60, ledger lines under G3, and a final barline. Sustained mode and 60 BPM are the defaults.
2. Tap **Hear note** before starting the microphone. Confirm a soft, click-free G3 from the phone speaker, the "Playing the reference" banner, and that the volume is comfortable. Repeat for each string using **Strings**.
3. Start listening and tap **Hear note** while the violin is silent. Confirm the exercise does not advance or start a hold, and that listening resumes about half a second after the tone ends.
4. Play G3 out of tune, then bring it into tune. Confirm counting does not start until the pitch is steady and within ±25 cents, then beats 1–4 advance about once per second and the next note is highlighted after four beats.
5. During a hold, play with a normal beginner wobble, a brief bow change, and slight drift (≈20–30 cents). The count should continue. Stop bowing for about a second, or move clearly off pitch for about half a second; the current note should return to "find the note" without losing earlier notes.
6. Change tempo to 40, 80, and 120 BPM. Confirm the hold lasts about 6, 3, and 2 seconds. Changing tempo during a hold restarts only that note.
7. Select a single string (four identical whole notes). Confirm one continuous bow cannot complete more than one note; lifting the bow briefly allows the next.
8. Use **Restart note**, **Restart exercise**, **Quick check**, and **Show note names**. With names hidden, the target card shows "?" and the reference banner does not name the note.
9. Lock the screen or switch apps during a hold; on return the hold must not complete from stale input.
10. Confirm the staff, target, detected pitch, intonation meter, beat counter, and Start/Stop button are visible together on the phone while practising.

## Milestone 2B: exercise library and scales (not yet performed on a violin)

1. Open the home screen. Confirm ten exercises (01–08C), each with key, note values, tempo, and difficulty. Confirm the tuner is still available.
2. Open **06 D Major Scale**. Confirm two sharps (F♯, C♯) after the clef, 4/4 on the first page, ♩ = 80, half notes two per measure, and a final whole-note D4. On a phone, confirm a window such as "Measures 1–2 of 8" and that the page turns (without scrolling) when the current note reaches the next window.
3. Play the scale up and down on a violin in Guided mode. Each note should start counting only once steady, hold for two beats (about 1.5 s at 80 BPM), then advance. Note any note that resets despite reasonable playing; record diagnostics (hold fault time).
4. Open **07 G Major Scale**. Confirm one sharp (F♯), ledger lines below G3, A3, B3, and C4, and that the low notes on the G string are detected without octave errors.
5. Open **04 D-String Walk** and **05 A-String Walk**. Confirm the ♯ sign printed before F♯4 and C♯5, and suggested fingering D0, D1, D↑2, D3 (A0, A1, A↑2, A3). Toggle the fingering hints off and on.
6. Open **03 First Finger**. Confirm that repeated E4–E4 (and B4–B4) needs a brief bow lift between them.
7. Set note names to **After playing** and then **Hidden**; confirm the target shows "?" and names appear only on completed notes (After playing).
8. Play one of the 08 melodies and finish it. Confirm the completion summary lists notes practised, tempo, and how many notes needed another try, and offers Practice again, Next exercise, and Back.
9. Change the A4 reference in the tuner (e.g. 442) and confirm scale targets and reference tones move accordingly.
10. Turn on airplane mode after the app has loaded once; confirm every exercise opens.

## Instrument Tuner acceptance

Use a conventional chromatic tuner as a reference. Tune the same real violin with both devices in the same room. Record microphone distance and device, A4 setting, detected frequency, note and octave, signed cents, clarity, and RMS. Allow for small differences from equal temperament when comparing pure violin fifths.

1. Open **Instrument Tuner** directly from Home. Confirm no microphone permission request occurs until **Start Listening**. Select G3, D4, A4, and E5 manually; bow each open string and compare the detected note and cents direction with the reference tuner.
2. Deliberately tune each string slightly flat and sharp. Confirm the meter moves in the correct direction, the in-tune indicator appears only near center (±10 cents), and changing A4 from 440 to 442 Hz shifts the reading as expected without restarting capture.
3. Select Chromatic mode. Play several notes and octaves within the tuner's 130–1200 Hz range, including B5 near 988 Hz and semitone neighbors. Check nearest note and octave against the reference tuner. Verify a reliable signal beyond this range is labeled unsupported, while silence and low-confidence noise have distinct states.
4. Pluck each open string, then bow it. Record how quickly a reliable reading appears and whether the plucked note decays before detection. Do not interpret a missed short pluck as verified pizzicato support.
5. Test silence, soft playing, bow attacks, vibrato, room noise, and strong upper harmonics. Confirm uncertain readings and isolated octave errors do not remain on screen as a confident pitch.
6. Stop listening, leave the tuner, and open Open Strings Practice. Confirm the browser microphone indicator clears on leaving the tuner, and only one input session is active. Also test permission denial, unplugging the input device, and leaving while permission is pending.
7. With a stable bowed note, move the pitch gradually using a tuning peg and compare the display's continuity with the reference tuner. Add modest vibrato and deliberate sudden note changes. Watch for display freezes, octave jumps, stale in-tune labels, and excessive spoken screen-reader updates.
8. Milestone 2C trail: with a bowed open string, start sharp and turn the peg down to pitch. Confirm the trail starts right of the centre line, moves toward it, the label changes from Tune down to In tune inside the green band, and after you stop bowing the live marker becomes an empty ring while the trail fades within about three seconds. Repeat from flat (Tune up).
9. In Manual, select D and bow the A string: confirm “Target D · Hearing A4” and no new trail. Turn on Auto and bow each string: confirm the matching peg lights up. In Chromatic, confirm no peg is highlighted. Try the G, D, A, E buttons by touch and with a keyboard, and with the system “reduce motion” setting on.
10. Change A4 to 415, 432, 442, and 466 Hz in turn. Return Home and open practice; confirm the target frequencies match the selected reference. Reload and confirm the setting persists. Enter an out-of-range value and confirm a clear validation message appears.

## Android PWA acceptance (not yet performed)

1. On Android Chrome at the production HTTPS domain, open the app while online. Wait for **Available offline**, then use Chrome's **Install app** action. Launch the installed standalone app from its icon.
2. Turn on airplane mode and force-close/reopen the installed app. Confirm Home, the tuner, the treble-clef staff, and the open-string exercise render. With network off, grant microphone permission after **Start Listening** and verify live pitch processing; stop listening and confirm the microphone indicator clears.
3. Switch from tuner to practice, rotate the device, lock/unlock the screen, and return from another app. Check that no stale **In tune** or **Listening** state remains after input is lost, and no second microphone session starts.
4. Install one version, then release an update. Confirm the old version remains usable until **Update now** is chosen, the new version loads afterward, and it launches offline. Repeat after a rollback.
