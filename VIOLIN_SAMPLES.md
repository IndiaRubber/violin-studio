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
