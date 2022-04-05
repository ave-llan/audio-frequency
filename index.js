
class FrequencyData {
  /**
   * @param {{
   *     data: !Array<!Uint8Array>
   *     minFrequency: number,
   *     maxFrequency: number,
   *     frequencyBandSize: number,
   *     frequencyBinCount: number,
   *     sampleTimeLength: number,
   *     duration: number,
   *     }} params
   */
  constructor({
    data,
    minFrequency,
    maxFrequency,
    frequencyBandSize,
    frequencyBinCount,
    sampleTimeLength,
    duration,
  }) {
    this.data = data
    this.minFrequency = minFrequency
    this.maxFrequency =    maxFrequency
    this.frequencyBandSize = frequencyBandSize
    this.frequencyBinCount = frequencyBinCount
    this.sampleTimeLength = sampleTimeLength
    this.duration = duration
  }

  /**
   * @param {number} binIndex
   * @return {number} Frequency at the given bin index.
   */
  frequencyAtBin(binIndex) {
    return this.minFrequency + (this.frequencyBandSize * binIndex)
  }

  /**
   * @param {number} binIndex
   * @return {number} Timestamp (in seconds) at the given sample index.
   */
  timeAtSample(sampleIndex) {
    return sampleIndex * this.sampleTimeLength
  }
}

class AudioData {
  /**
   * @param {!AudioBuffer} decodedData
   */
  constructor(audioBuffer) {
    this.buffer = audioBuffer
    this.length = audioBuffer.length 
    this.duration = audioBuffer.duration
    this.sampleRate = audioBuffer.sampleRate
    this.numberOfChannels = audioBuffer.numberOfChannels
  }

  /**
   * @param {string} audioFile path to audio file
   * @return {!AudioData}
   */
  static async fromFile(audioFile) {
    const response = await fetch(audioFile)
    const arrayBuffer = await response.arrayBuffer()

    const audioContext = new AudioContext()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    return new AudioData(audioBuffer)
  }

  /**
   * Returns audio frequency data for the given audio file.
   * @param {{
   *     sampleTimeLength: number,
   *     fftSize: number,
   *     maxFrequency: number,
   *     }=} options
   *           sampleTimeLength Interval in seconds at which to start each sample.
   *               The duration of the audio file / sampleTimeLength = the number
   *               of samples.
   *           fftSize Integer, representing the window size of the FFT, given in
   *               number of samples. Must be a power of 2 between 2^5 and 2^15.
   *           maxFrequency Maximum frequency in hz to include in the results.
   *               Actual max will be
   *               min(audioFile sample rate / 2, maxFrequency).
   *           smoothingTimeConstant A value from 0 -> 1 where 0 represents no
   *               time averaging with the last analysis frame.
   * @return {!Promise<!Array<!Uint8Array>>}  an array of frequency samples;
   *     each sample is a normalized array of decibel values between 0 and 255.
   *     The frequencies are spread linearly from 0 to 1/2 of the sample rate.
   */
  getFrequencyData({
    sampleTimeLength = 1/60,
    fftSize = 2 ** 11,
    maxFrequency = 44100 / 2,
    smoothingTimeConstant = 0.5,
  } = {}) {
    const offlineContext = new OfflineAudioContext(
      this.numberOfChannels,
      this.length,
      this.sampleRate)
    const audioBufferSource = offlineContext.createBufferSource()
    audioBufferSource.buffer = this.buffer

    const analyser = offlineContext.createAnalyser()
    audioBufferSource.connect(analyser)
    const numSamples = Math.floor(
      audioBufferSource.buffer.duration / sampleTimeLength)
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = smoothingTimeConstant

    // Prep frequencyData array
    maxFrequency = Math.min(this.sampleRate / 2, maxFrequency)
    const frequencyData = new Array(numSamples)
    const frequencyBandSize = (this.sampleRate / 2) /
      analyser.frequencyBinCount
    const frequencyBinCount = Math.min(
      analyser.frequencyBinCount,
      Math.ceil(maxFrequency / frequencyBandSize))
    for (let i = 0; i < numSamples; i++) {
      frequencyData[i] = new Uint8Array(frequencyBinCount)
    }
    return new Promise((resolve) => {
      for (let frameIndex = 0; frameIndex < numSamples; frameIndex++) {
        offlineContext.suspend(sampleTimeLength * frameIndex).then(() => {
          analyser.getByteFrequencyData(frequencyData[frameIndex])
          offlineContext.resume()
          // After populating last data, resolve promise.
          if (frameIndex + 1 === numSamples) {
            resolve(new FrequencyData({
              data         : frequencyData,
              minFrequency : 0,
              maxFrequency,
              frequencyBandSize,
              frequencyBinCount,
              sampleTimeLength,
            }))
          }
        })
      }
      offlineContext.startRendering()
      audioBufferSource.start()
    })  
  }
}

/**
 * Returns audio frequency data for the given audio file.
 * @param {string} audioFile Path to audio file.
 * @param {{
 *     sampleTimeLength: number,
 *     fftSize: number,
 *     maxFrequency: number,
 *     }=} options
 *           sampleTimeLength Interval in seconds at which to start each sample.
 *               The duration of the audio file / sampleTimeLength = the number
 *               of samples.
 *           fftSize Integer, representing the window size of the FFT, given in
 *               number of samples. Must be a power of 2 between 2^5 and 2^15.
 *           maxFrequency Maximum frequency in hz to include in the results.
 *               Actual max will be
 *               min(audioFile sample rate / 2, maxFrequency).
 *           smoothingTimeConstant A value from 0 -> 1 where 0 represents no
 *               time averaging with the last analysis frame.
 * @return {!Promise<!Array<!Uint8Array>>}  an array of frequency samples;
 *     each sample is a normalized array of decibel values between 0 and 255.
 *     The frequencies are spread linearly from 0 to 1/2 of the sample rate.
 */
async function getAudioFrequencyData(audioFile,
  {
    sampleTimeLength = 1/60,
    fftSize = 2 ** 11,
    maxFrequency = 44100 / 2,
    smoothingTimeConstant = 0.5,
  } = {}) {
  const audioData = await AudioData.fromFile(audioFile)
  const frequencyData = await audioData.getFrequencyData({sampleTimeLength, fftSize, maxFrequency, smoothingTimeConstant})
  return frequencyData.data
}

export {AudioData, getAudioFrequencyData}
