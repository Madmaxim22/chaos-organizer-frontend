/**
 * Сервис для записи видео через MediaRecorder API.
 * В проекте используется mediaRecorder.js (MediaRecorderService) для записи аудио и видео.
 */
export default class VideoRecordingService {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.stream = null;
    this.onRecordingStart = null;
    this.onRecordingStop = null;
    this.onError = null;
  }

  async startVideoRecording(options = {}) {
    this.onRecordingStart = options.onStart;
    this.onRecordingStop = options.onStop;
    this.onError = options.onError;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user'
        },
      });
      const mimeType = 'video/webm;codecs=vp9,opus';
      try {
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      } catch (e) {
        this.mediaRecorder = new MediaRecorder(this.stream);
      }
      this.chunks = [];
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        if (this.onRecordingStop) this.onRecordingStop({
          blob, url, fileName: `recording-${Date.now()}.webm`, type: 'video/webm', duration: Date.now() - this.startTime
        });
        this.stream?.getTracks().forEach(t => t.stop());
        this.stream = null;
      };
      this.startTime = Date.now();
      this.mediaRecorder.start();
      if (this.onRecordingStart) this.onRecordingStart();
    } catch (err) {
      console.error('Ошибка доступа к камере:', err);
      if (this.onError) this.onError(err);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === 'recording';
  }
}
