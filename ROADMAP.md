# Roadmap after Milestone 1

Milestone 2A (sustained whole notes, tempo, reference tone, practice controls) and Milestone 2B (exercise library, half notes, key signatures, D and G major scales, first melodies) are implemented; see README. It does not change the order below: physical validation remains the first gate.

1. **Physical validation and calibration.** Test on a real acoustic violin with several microphones and rooms. Record failure cases with consent, tune thresholds, and add anonymized local regression fixtures. This is the first gate before expanding features.
2. **Musical practice quality.** Add a non-advancing intonation hold mode, adjustable A4 reference, and more informative flat/sharp coaching. Preserve unlimited repetition.
3. **Sight reading.** Introduce short local exercises with note duration and rests, then separately offer rhythm practice. Do not merge note and rhythm grading until each works well.
4. **Adaptive aids.** Let learners gradually hide note labels and adjust difficulty based on local practice history, without accounts or engagement pressure.
5. **Device reach.** Validate Android and Chromebook capture behavior and responsive notation before offering an installable offline PWA.

## Proposed Milestone 1.5: Instrument Tuner

After the Milestone 1 software checkpoint and before implementing pizzicato practice, add a tuner reachable directly from the main navigation, independently of exercises. It is a continuous listening tool with no exercise progression or scoring.

Provide a violin mode for G3, D4, A4, and E5, with manual string selection and optional automatic string recognition. Provide a chromatic mode for arbitrary notes. Show live frequency, detected note name and octave, signed cents deviation, and a clear flat/sharp meter with an in-tune zone. Let the player adjust concert pitch, initially A4 = 440 Hz. Silence and uncertain detections should have explicit states and must not leave a stale pitch on screen.

Reuse the existing microphone lifecycle, pitch filtering, and musical calculation modules. Keep one microphone session active at a time when switching between the tuner and exercises. Evaluate bowed and plucked strings where practical, with appropriate handling of a pluck's brief decay. Guard against strong harmonics and octave misidentification; do not present an uncertain fundamental as confidently in tune.

Proposed acceptance requirements:

- Reach the tuner from the main screen without starting an exercise; leaving it releases the microphone, and switching modes never opens a second simultaneous session.
- In violin mode, select each open string manually and read its live pitch and signed cents error against the selected target. If automatic recognition is offered, require a reliable match before changing the target.
- In chromatic mode, identify notes and octaves across a documented supported range, with deviation relative to the nearest note at the selected concert pitch.
- Adjust A4 from the 440 Hz default and verify that target frequencies and cents readings update consistently.
- Show flat, in-tune, and sharp states with both text and a visual meter; show silence and uncertain input without a misleading retained reading.
- Validate synthetic bowed and plucked signals, harmonic-rich and octave-error cases, silence, noise, and microphone cleanup; then test all four open strings on a real violin before acceptance.

## Proposed Milestone 2: Pizzicato Practice Mode — Left-Hand Development

After real-violin validation of Milestone 1, offer beginning students first-position pitch and sight-reading practice by plucking instead of bowing. Start with individual notes on the D and A strings. Display conventional staff notation with optional finger-placement hints, then let students hide the hints as they improve. Support short ordered exercises first and randomized sequences later.

Pizzicato produces a short, decaying tone. Investigate onset detection, short-window fundamental-frequency estimation, and a separate acceptance profile; simply reducing the bowing mode's 350 ms hold is insufficient. Reject unrelated sounds, excessive noise, and uncertain estimates. Require a distinct pluck before another target can advance, including when two targets have the same pitch. Share note definitions and musical evaluation logic with bowing practice where practical, using configurable recognition strategies within one exercise engine.

Proposed acceptance requirements:

- Correctly notate and identify a small, defined set of first-position D- and A-string notes, with optional finger hints that can be hidden.
- Accept a confidently pitched, in-tune pluck despite its natural decay; show the detected note and signed intonation feedback without requiring a sustained bow tone.
- Reject silence, unrelated transients, noisy or uncertain plucks, wrong notes, and octave errors without advancing.
- Advance at most once per pluck; require a new onset or credible release before a repeated target.
- Test ordered and randomized exercises with deterministic synthetic plucks, then manually validate with a real violin across different microphones and rooms.
- Describe feedback as pitch evidence only. Audio cannot verify which finger the student used.
