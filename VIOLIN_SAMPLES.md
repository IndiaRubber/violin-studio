# Tuner violin reference recordings

The four bowed open-string excerpts come from the [University of Iowa Electronic Music Studios Musical Instrument Samples](https://theremin.music.uiowa.edu/MISviolin.html). Iowa's [published usage terms](https://theremin.music.uiowa.edu/MIS.html) state that the recordings may be downloaded and used for any projects without restrictions. The original recordings and all other notes in the source collection are **not** shipped. VSCO 2 Community Edition was considered as a CC0 alternative, but the four selected Iowa passages measured steady enough for this use.

| String | Original source filename | Source excerpt (seconds) | Measured pitch | Steady-region span | Output RMS |
| --- | --- | ---: | ---: | ---: | ---: |
| G3 | `Violin.arco.mf.sulG.G3B3.aiff` | 2.75–4.35 | 195.61 Hz | 3.83 cents | 0.0487 |
| D4 | `Violin.arco.mf.sulD.D4A4.aiff` | 4.70–6.30 | 291.51 Hz | 1.89 cents | 0.0483 |
| A4 | `Violin.arco.mf.sulA.A4B4.aiff` | 5.45–7.05 | 438.18 Hz | 2.81 cents | 0.0482 |
| E5 | `Violin.arco.mf.sulE.E5B5.aiff` | 4.00–5.60 | 659.11 Hz | 0.97 cents | 0.0484 |

Each original filename is available from the Iowa violin page under **Arco, mf**. Its download URL is `https://theremin.music.uiowa.edu/sound%20files/MIS/Strings/violin/<original filename>`. The original 16-bit, 44.1 kHz mono AIFF chromatic-scale recordings were trimmed to the 1.60-second passages above, downsampled to 32 kHz mono PCM WAV, given a 40 ms fade-in and 150 ms fade-out, and gain-matched to about 0.05 RMS without compression. The exact preparation recipe is `scripts/prepare-violin-samples.mjs` (requires FFmpeg and locally downloaded original files). The four shipped WAVs are **409,912 bytes total** (100.1 KiB each).

Pitch was measured with Pitchy's fundamental estimator across 23 overlapping 4096-sample windows in the unfaded steady portion of each final WAV; the median is stored in `src/violin-samples.ts`. Web Audio plays each sample at `targetHz / measuredHz`, so changing concert A4 from 440 to 442 Hz changes the reference consistently. These measurements characterize the edited recordings; speaker response, microphone leakage, and comparison with a real violin still require listening tests. A steady clip has little pitch drift but does not have the precision of a laboratory reference oscillator; Tone remains the default.

## Fingered D- and A-string references

The added files use the same [Iowa terms](https://theremin.music.uiowa.edu/MIS.html) and the explicitly string-labelled **Arco, mf** recordings on the [pre-2012 violin page](https://theremin.music.uiowa.edu/MISviolin.html). In the original filenames, `sulD` and `sulA` identify the string actually played. These are separate stopped-string excerpts, not pitch-shifted open strings. The sources contain chromatic notes; the table records the exact 1.60-second region selected for each output. The three original AIFFs are not bundled.

| Output | Played string / note | Original AIFF | Source seconds | Measured Hz | Steady span (cents) | Output RMS |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `d-e4.wav` | D / E4 | `Violin.arco.mf.sulD.D4A4.aiff` | 21.65–23.25 | 323.52 | 3.21 | 0.0485 |
| `d-f4.wav` | D / F4 | same | 41.10–42.70 | 353.46 | 3.03 | 0.0489 |
| `d-fs4.wav` | D / F♯4 | same | 51.30–52.90 | 371.53 | 1.10 | 0.0479 |
| `d-g4.wav` | D / G4 | same | 61.10–62.70 | 388.03 | 2.86 | 0.0484 |
| `d-a4.wav` | D / fourth-finger A4 | same | 90.10–91.70 | 435.87 | 3.87 | 0.0483 |
| `a-b4.wav` | A / B4 | `Violin.arco.mf.sulA.A4B4.aiff` | 23.40–25.00 | 487.39 | 2.52 | 0.0486 |
| `a-c5.wav` | A / C5 | `Violin.arco.mf.sulA.C5C6.aiff` | 4.30–5.90 | 512.65 | 1.43 | 0.0484 |
| `a-cs5.wav` | A / C♯5 | same | 25.60–27.20 | 565.93 | 3.13 | 0.0483 |
| `a-d5.wav` | A / D5 | same | 34.80–36.40 | 581.81 | 1.98 | 0.0483 |

Each source URL is `https://theremin.music.uiowa.edu/sound%20files/MIS/Strings/violin/<original AIFF filename>`. `scripts/probe-violin-samples.mjs` locates sustained source regions; `scripts/prepare-violin-samples.mjs <source-directory> --fingered` reproduces the edits with FFmpeg. The edits match the open-string preparation: 32 kHz mono 16-bit PCM WAV, 40 ms fade-in, 150 ms fade-out, and gain matching toward 0.05 RMS with a peak cap. Pitch was remeasured on the **final** files with 23 overlapping Pitchy windows, excluding fades; no clip spanned more than 3.87 cents in those windows. The nine additional files total **922,302 bytes** (102,478 bytes each), making all thirteen bundled references **1,332,214 bytes**. Source pitches differ from equal temperament; Web Audio corrects each by `targetHz / measuredHz` at playback. Listen against a trusted tuner on the target phone before treating these as validated acoustic references.

Exercise and Fingerboard Trainer playback picks a clip only when both the written pitch and the suggested string match. Open A4 uses `a4.wav`; D-string fourth-finger A4 uses `d-a4.wav`. When a matching stopped-string clip is absent (including G-string fingered notes and A-string fourth-finger E5), or fails to load/decode, the synthesized Tone plays and the interface says why. The tuner's separate Tone/Violin setting and four open-string choices are unchanged.
