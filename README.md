# audio-frequency
Uses the Web Audio API to get frequency data for an entire audio file as fast as possible,
without the need for playback in real time.

# Sample usage

```js
import {getAudioFrequencyData} from 'audio-frequency';

// Get frequency data with default settings.
const frequencyData1 = getAudioFrequencyData('./sound_file.wav');

// Get frequency data with custom settings.
const frequencyData2 = getAudioFrequencyData('./sound_file.wav',
    {sampleTimeLength: 1/120, fftSize: 2 ** 11});
```