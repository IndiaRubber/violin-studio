# Real violin manual test plan

## Daily Practice and recorder: Android acceptance pending

1. On Android Chrome, open the HTTPS app and leave Home untouched. It should not request a wake lock. Enter a lesson and the Fingerboard Trainer, leave the phone untouched long enough to test screen sleep, then return Home. Repeat with active tuner listening and recording. Toggle **Keep screen awake during practice** off and on, background/restore the app, and try battery saver. The status must never claim an active lock after denial or release.
2. Check and undo each warmup. Confirm the displayed time is the actual completion time and the suggested minutes are not recorded as elapsed practice. Finish one lesson twice; verify two separate history rows. Cross local midnight if practical and confirm the new day groups separately. Reload and use airplane mode to confirm local history persists.
3. Tap **Record Performance**. Verify camera and microphone permission occurs only after this action, the front-facing preview is correctly oriented, and both violin and bow fit. Cancel and check both browser capture indicators clear. Retry, start the visible three-second countdown, then confirm the large preview disappears and the score can be read and paged while video and audio capture continue. Stop early and repeat for the full 60-second automatic stop.
4. Play back each take and check orientation, audio level, synchronization, and full one-minute integrity. Save, reload, reopen from history, download a file and play it outside the app, then delete the saved take. Test denied permission, interrupted capture, insufficient storage, and offline relaunch. If saving fails, confirm Download remains available and no recording history entry is added.
5. Start a scored lesson microphone, then choose **Record Performance**. Confirm the scored mic session closes before camera capture begins and no notes advance during recording. Return to the lesson and verify normal scoring still works. Test at 390 × 844 portrait and 844 × 390 landscape with touch controls.

Browser tests mock media and do not establish Android camera orientation, acoustic audio quality, storage persistence under device pressure, real wake-lock behavior, or reliable one-minute recording. Perform these steps on the target phone before acceptance.

## Exercise Hear note: Tone / Violin (acoustic and Android checks pending)

1. On Android Chrome, compare Tone and Violin in **09A Close Pair on D**, **09B Low Second Turn**, and **09C Crossing Echoes**. Listen for a clear bowed reference on the suggested D or A string, including F natural versus F♯ and C natural versus C♯. Compare pitch against a trusted chromatic tuner at A4 = 440 and 442 Hz; recordings are corrected from their measured source pitches.
2. In **05E Add the Fourth Finger**, compare the D-string fourth-finger A4 with the following open A4. The references should sound like two distinct recordings of the same pitch. The microphone cannot confirm which string or finger was used.
3. Select Violin in one exercise, open another exercise and the Fingerboard Trainer, and reload. Confirm that choice persists there while the tuner retains its own Tone/Violin choice. Try an unsupported G-string fingered note and confirm Tone is identified as the fallback.
4. While listening in Guided and Quick Check, play a reference through the phone speaker near the microphone. Confirm no match, hold time, or advancement accrues during sample loading, playback, fallback, or settling. Then play the note yourself and confirm recognition resumes. Cancel during loading, switch target, restart, and leave the screen; no old sound should start later.
5. After **Available offline** appears, turn on airplane mode, relaunch, and make the first Violin playback of a D- or A-string fingered note. Check that it plays from cache. At 360px portrait, verify the selector and practice controls remain reachable.

These steps require a real violin and Android audio hardware; synthetic browser tests cannot establish acoustic reference quality or speaker-to-microphone leakage on the device.

## Guided score and fingerboard tunes

1. On a phone, open **09A Close Pair on D** from the trainer or library. Confirm that the staff and fingerboard highlight the same note and that the board can be hidden.
2. In Guided mode, bow a half note and the last whole note. Confirm that the hold line starts only when the pitch steadies, has two or four ticks respectively, and resets under the next note. Drift slightly sharp and flat and check that the trace rises and dips.
3. While the score is in view, use both restart icons. Confirm that they leave the page in place and keep the microphone open if it was already listening. Quick check should have no hold line.

## Milestone 2E: Fingerboard Trainer (Android and real violin unverified)

1. On Android Chrome, open the HTTPS preview while online and wait for **Available offline**. Open Fingerboard Trainer, then switch to airplane mode and reopen. Confirm all three modes, the staff, and Hear note still work.
2. In Guided Fingerboard Walk, choose D high 2. Bow D4–E4–F♯4–G4–A4 and descend. Verify the current target is amber, completed positions turn green, the detected note and signed cents make sense, and a wrong or uncertain pitch does not advance. Compare the visible whole-step and half-step gaps. High 2 puts F♯ close to G. Low 2 puts F natural close to E. Repeat with D low 2 (F natural), A high/low 2 (C♯/C natural), and G high/low 2 (B/B♭). Try D+A combined.
3. In Find the Note, compare Full labels, Partial hint, and Memory. Confirm the target position is not highlighted before Reveal current position, and a completed note becomes visible. Hide note names and suggested finger details independently.
4. In Staff + Fingerboard, read each D/A note on the treble staff, then play it. Confirm staff completion and chart green state advance together. Hide the suggested position and fingering to practise reading alone.
5. Play Hear note while listening and make a matching acoustic sound into the mic. Confirm playback and settling never advance the exercise. Stop playback, restart, change modes, and exit during a tone; check sound and microphone stop. Compare A4 = 440 and 442 in the tuner, then return to the trainer.
6. At 360px and 390px portrait widths, confirm all four string columns, row labels, meter, and controls fit without horizontal scrolling. Try touch, keyboard, and reduced-motion settings. E-string high pitches should say **Out of range**, and the full E walk should be disabled.

Record device, microphone placement, A4 setting, measured pitch, and any missed or false detections. Browser tests use synthetic oscillator input; they do not validate acoustic violin or Android microphone performance.

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
10. Confirm the staff, hold line, and fixed microphone and restart icons are visible together on the phone while practising.

## Milestone 2B: exercise library and scales (not yet performed on a violin)

1. Open the home screen. Confirm ten exercises (01–08C), each with key, note values, tempo, and difficulty. Confirm the tuner is still available.
2. Open **06 D Major Scale**. Confirm two sharps (F♯, C♯) after the clef, 4/4, ♩ = 80, half notes two per measure, and a final whole-note D4. On a phone, confirm the note track slides under the fixed clef without scrolling the page, and that the final D4 and its complete hold lane come into view. Stop bowing partway through a later hold and confirm only the current note’s hold resets.
3. Play the scale up and down on a violin in Guided mode. Each note should start counting only once steady, hold for two beats (about 1.5 s at 80 BPM), then advance. Note any note that resets despite reasonable playing; record diagnostics (hold fault time).
4. Open **07 G Major Scale**. Confirm one sharp (F♯), ledger lines below G3, A3, B3, and C4, and that the low notes on the G string are detected without octave errors.
5. Open **04 D-String Walk** and **05 A-String Walk**. Confirm the ♯ sign printed before F♯4 and C♯5, and suggested fingering D0, D1, D↑2, D3 (A0, A1, A↑2, A3). Toggle the fingering hints off and on.
6. Open **03 First Finger**. Confirm that repeated E4–E4 (and B4–B4) needs a brief bow lift between them.
7. Set note names to **After playing** and then **Hidden**; confirm the target shows "?" and names appear only on completed notes (After playing).
8. Play one of the 08 melodies and finish it. Confirm the completion summary lists notes practised, tempo, and how many notes needed another try, and offers Practice again, Next exercise, and Back.
9. Change the A4 reference in the tuner (e.g. 442) and confirm scale targets and reference tones move accordingly.
10. Turn on airplane mode after the app has loaded once; confirm every exercise opens.

## Milestone 2D: finger patterns (real violin and Android still unverified)

1. On Android Chrome at the HTTPS site, install or open the app, wait for **Available offline**, then repeat these checks in airplane mode. Open each Finger Patterns lesson; confirm treble staff, active note, complete 4/4 measures, readable controls at 360px portrait, and no horizontal clipping.
2. In **Move One Finger**, hear the high and low groups. Confirm F♯ has a sharp and F natural has a courtesy natural on the staff; E and G do not change. Bow E–F♯–G–F♯–E, then E–F–G–F–E in Guided mode. Compare the sound and finger spacing with a teacher or conventional tuner. The app hears pitch only; its fingering is a suggestion.
3. Play **Hear pattern** while listening and deliberately play matching notes into the microphone, including the gaps between demonstration notes. Confirm no note advances during playback or the settling period. Restart during playback and leave the lesson during playback; confirm sound stops and no stale note is credited.
4. In **Move the Shape**, play D–E–F♯–G on D, then A–B–C♯–D on A. Check that the optional text and strip describe fingers 2 and 3 close on both strings. Follow **Try D Major Scale**, show the optional groups, and confirm the scale notation, tempo, and key signature are unchanged.
5. In **Spot It Before You Play**, find the close pair in the staff before **Show answer**. Check that no pattern or fingering hint reveals it prematurely. Reveal the answer, play the short excerpt in Guided mode, then use **Repeat with cue hidden**. At 360px, confirm the cue remains understandable as E–F♯–G moves across the score track.
6. Hide the pattern cue independently of note names and finger suggestions. Test silence, bow attacks, slightly flat/sharp notes, and a sustained wrong pitch. Confirm only a stable matching pitch advances; check that Stop and navigation release the microphone.

7. In **Low Second Finger on A**, hear and play B–C♯–D and B–C-natural–D up and back. Check the sharp and natural signs, the change from fingers 2–3 close to 1–2 close, and that B and D remain the same pitches.
8. In **Add the Fourth Finger**, play E–F♯–G–A using finger 4 on D, then the following open A. Compare them by ear. A continuous A sound must not complete both written A4 notes; separate the notes by a bow lift or clear interruption. The app cannot verify which string produced either A.
9. In **Change Shape at the Crossing**, read G major's F♯ key signature and play D–E–F♯–G on D, then A–B–C-natural–D on A. Check that the upcoming low-2 change is cued before the crossing. Follow the link to the unchanged G Major Scale.
10. In **Read the Shape Out of Order**, leave the pattern cue hidden and read G–E–F♯–G, then D–B–C–B. Reveal the cue only if needed; confirm the exercise follows the written order rather than a scale.
11. In **Spot the Change in a Tune**, use a 360px portrait view. Before listening or revealing the answer, turn to the second score page and back, and identify the crossing and close pair on each string. Check that fingering hints are hidden until **Show answer**. Play in Guided mode, complete the phrase, and repeat with the cue hidden. Confirm normal automatic score following resumes while listening.

Record browser/device, A4 setting, microphone placement, detected frequency, clarity, and any false acceptance or missed note. Automated browser tests use a synthetic microphone and do not validate real violin playing or Android audio hardware.

## Instrument Tuner acceptance

Use a conventional chromatic tuner as a reference. Tune the same real violin with both devices in the same room. Record microphone distance and device, A4 setting, detected frequency, note and octave, signed cents, clarity, and RMS. Allow for small differences from equal temperament when comparing pure violin fifths.

**Violin / Tone comparison:** On Android Chrome, choose each peg and compare Tone with Violin before starting the microphone. Check that the sound is comfortable, that G3, D4, A4, and E5 each have the expected pitch, and that the violin clips have comparable levels without clicks. Repeat at A4 = 442 Hz against a trusted tuner. Reload to check that Violin choice persists; Chromatic must still play Tone. Start listening, then play a reference with the phone speaker close to the microphone. Confirm the note and trail clear during sample loading, playback, and settling, then resume. Stop during loading and while sounding, change pegs, switch modes, and leave the tuner; no cancelled sound should start later. After **Available offline**, turn on airplane mode and repeat Violin playback. These checks require physical Android audio and have not been established by synthetic browser tests.

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

## Practice metronome

- On a phone, open a Guided lesson. Tap the metronome icon without starting the microphone. Check that it pulses and clicks steadily. Change the lesson tempo and confirm the BPM readout and beat change together.
- Start Listening with the click running. Let at least four clicks through without playing: the current note must not advance. Play the requested note across two clicks and check that the normal hold and progression work. Repeat at normal phone speaker volume in the Fingerboard Trainer.
- Turn off **Click sound** in the BPM settings. The pulse should keep going. In the trainer, check the 60 BPM default and try changing it. Start **Hear note** or **Hear pattern** while the click is running. Clicks should pause and return after the reference while the pulse continues.
- Stop the metronome, leave the exercise, and background the app with it running. Confirm no clicks continue. Try it after an offline restart.
