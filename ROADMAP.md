# Roadmap after Milestone 1

1. **Physical validation and calibration.** Test on a real acoustic violin with several microphones and rooms. Record failure cases with consent, tune thresholds, and add anonymized local regression fixtures. This is the first gate before expanding features.
2. **Musical practice quality.** Add a non-advancing intonation hold mode, adjustable A4 reference, and more informative flat/sharp coaching. Preserve unlimited repetition.
3. **Sight reading.** Introduce short local exercises with note duration and rests, then separately offer rhythm practice. Do not merge note and rhythm grading until each works well.
4. **Adaptive aids.** Let learners gradually hide note labels and adjust difficulty based on local practice history, without accounts or engagement pressure.
5. **Device reach.** Validate Android and Chromebook capture behavior and responsive notation before offering an installable offline PWA.

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
