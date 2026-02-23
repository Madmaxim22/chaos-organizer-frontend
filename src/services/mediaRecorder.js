/**
 * Сервис для записи аудио и видео через MediaRecorder API
 */
export default class MediaRecorderService {
  /**
   * Создаёт сервис записи через MediaRecorder API (аудио/видео).
   */
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
    this.recordingType = null; // 'audio' или 'video'
    this.onRecordingStart = null;
    this.onRecordingStop = null;
    this.onError = null;
  }

  /**
   * Начать запись аудио
   * @param {Object} options
   * @param {Function} options.onStart - Колбек при старте записи
   * @param {Function} options.onStop - Колбек при остановке (возвращает Blob)
   * @param {Function} options.onError - Колбек при ошибке
   */
  async startAudioRecording(options = {}) {
    this.recordingType = 'audio';
    this.onRecordingStart = options.onStart;
    this.onRecordingStop = options.onStop;
    this.onError = options.onError;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.setupMediaRecorder(this.stream);
      this.mediaRecorder.start();
      if (this.onRecordingStart) this.onRecordingStart();
    } catch (err) {
      console.error('Ошибка доступа к микрофону:', err);
      if (this.onError) this.onError(err);
    }
  }

  /**
   * Начать запись видео (с аудио)
   * @param {Object} options
   */
  async startVideoRecording(options = {}) {
    this.recordingType = 'video';
    this.onRecordingStart = options.onStart;
    this.onRecordingStop = options.onStop;
    this.onError = options.onError;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });
      this.setupMediaRecorder(this.stream);
      this.mediaRecorder.start();
      if (this.onRecordingStart) this.onRecordingStart();
    } catch (err) {
      console.error('Ошибка доступа к камере:', err);
      if (this.onError) this.onError(err);
    }
  }

  /**
   * Настраивает MediaRecorder для текущего потока (аудио или видео).
   * @param {MediaStream} stream - поток с микрофона/камеры
   */
  setupMediaRecorder(stream) {
    const mimeType = this.recordingType === 'video'
      ? 'video/webm;codecs=vp9,opus'
      : 'audio/webm;codecs=opus';

    const options = { mimeType };
    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      // Fallback на default MIME type
      this.mediaRecorder = new MediaRecorder(stream);
    }

    this.chunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || 'audio/webm', });
      const url = URL.createObjectURL(blob);
      const fileName = `recording-${Date.now()}.${this.recordingType === 'video' ? 'webm' : 'webm'}`;

      if (this.onRecordingStop) {
        this.onRecordingStop({
          blob,
          url,
          fileName,
          type: this.recordingType === 'video' ? 'video/webm' : 'audio/webm',
          duration: Date.now() - this.startTime,
        });
      }

      // Остановка потока
      this.stopStream();
    };

    this.startTime = Date.now();
  }

  /** Останавливает текущую запись; по завершении вызывается onRecordingStop с blob. */
  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /** Приостанавливает запись. */
  pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  /** Возобновляет приостановленную запись. */
  resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  /** Останавливает все треки медиа-потока и сбрасывает stream. */
  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  /** Возвращает true, если запись идёт. */
  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === 'recording';
  }

  /** Возвращает состояние MediaRecorder: 'inactive' | 'recording' | 'paused'. */
  getRecordingState() {
    return this.mediaRecorder ? this.mediaRecorder.state : 'inactive';
  }

  /** Возвращает текущий медиа-поток (камера/микрофон) или null. */
  getStream() {
    return this.stream || null;
  }

  /**
   * Статический метод: записывает аудио заданное время и возвращает результат (blob, url, fileName).
   * @param {number} [duration=5000] - длительность в миллисекундах
   * @returns {Promise<{ blob: Blob, url: string, fileName: string, type: string, duration: number }>}
   */
  static async recordAudio(duration = 5000) {
    return new Promise((resolve, reject) => {
      const service = new MediaRecorderService();
      service.startAudioRecording({
        onStart: () => console.log('Запись аудио начата'),
        onStop: (result) => resolve(result),
        onError: reject,
      });
      setTimeout(() => service.stopRecording(), duration);
    });
  }

  /**
   * Статический метод: записывает видео заданное время и возвращает результат.
   * @param {number} [duration=5000] - длительность в миллисекундах
   * @returns {Promise<{ blob: Blob, url: string, fileName: string, type: string, duration: number }>}
   */
  static async recordVideo(duration = 5000) {
    return new Promise((resolve, reject) => {
      const service = new MediaRecorderService();
      service.startVideoRecording({
        onStart: () => console.log('Запись видео начата'),
        onStop: (result) => resolve(result),
        onError: reject,
      });
      setTimeout(() => service.stopRecording(), duration);
    });
  }
}
