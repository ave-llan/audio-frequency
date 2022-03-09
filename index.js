/**
 * Returns audio frequency data for the given audio file.
 * @param {string} audioFile
 * @return {!Promise<!Array<!Uint8Array>>}  an array of frequency samples;
 *     each sample is a normalized array of decibel values between 0 and 255.
 *     The frequencies are spread linearly from 0 to 1/2 of the sample rate.
 */
async function getAudioFrequencyData(audioFile) {
  const sampleTimeLength = 1/60;
  const audioContext = new AudioContext();
  return fetch(audioFile).then((response) => response.arrayBuffer)
      .then(async (buffer) => {
        const decodedData = await audioContext.decodeAudioData(buffer,
            (decodedData) => decodedData);
        const offlineContext = new OfflineAudioContext(
            decodedData.numberOfChannels,
            decodedData.length,
            decodedData.sampleRate);
        const audioBufferSource = offlineContext.createBufferSource();
        audioBufferSource.buffer = decodedData;

        const analyser = offlineContext.createAnalyser();
        audioBufferSource.connect(analyser);
        const fftSize = 2 ** 11;
        const numSamples = Math.floor(
            audioBufferSource.buffer.duration / sampleTimeLength);
        analyser.fftSize = fftSize;

        // Prep frequenyData array
        const frequencyData = new Array(numSamples);
        const frequencyBinCount = analyser.frequencyBinCount;
        for (let i = 0; i < numSamples; i++) {
          frequencyData[i] = new Uint8Array(frequencyBinCount);
        }

        // Fill array
        (sampleIndex) => {
          analyser.getByteFrequencyData(frequencyData[sampleIndex]);
        };

        return new Promise((resolve) => {
          for (let frameIndex = 0; frameIndex < numSamples; frameIndex++) {
            offlineContext.suspend(sampleTimeLength * frameIndex).then(() => {
              analyser.getByteFrequencyData(frequencyData[frameIndex]);
              offlineContext.resume();
              // After populating last data, resolve promise.
              if (frameIndex + 1 === numSamples) {
                resolve(frequencyData);
              }
            });
          }
          offlineContext.startRendering();
          audioBufferSource.start();
        });
      });
}

export {getAudioFrequencyData};
