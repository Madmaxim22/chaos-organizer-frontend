/**
 * UI записи аудио и видео: кнопки, индикаторы, модальное окно превью.
 */
export default class RecordingUI {
  /**
   * @param {import('./InputPanel.js').default} inputPanel - родительская панель ввода
   * @param {Object} elements - ссылки на DOM-элементы
   * @param {HTMLElement} elements.recordAudioBtn
   * @param {HTMLElement} elements.recordVideoBtn
   * @param {HTMLElement} elements.audioRecordingIndicator
   * @param {HTMLElement} [elements.audioRecordingStopBtn]
   * @param {HTMLElement} elements.videoRecordingIndicator
   * @param {HTMLElement} elements.videoRecordingModal
   * @param {HTMLVideoElement} elements.videoRecordingPreview
   * @param {HTMLElement} elements.videoRecordingStopBtn
   * @param {import('../../services/mediaRecorder.js').default} mediaRecorder
   */
  constructor(inputPanel, elements, mediaRecorder) {
    this.inputPanel = inputPanel;
    this.recordAudioBtn = elements.recordAudioBtn;
    this.recordVideoBtn = elements.recordVideoBtn;
    this.audioRecordingIndicator = elements.audioRecordingIndicator;
    this.audioRecordingStopBtn = elements.audioRecordingStopBtn;
    this.videoRecordingIndicator = elements.videoRecordingIndicator;
    this.videoRecordingModal = elements.videoRecordingModal;
    this.videoRecordingPreview = elements.videoRecordingPreview;
    this.videoRecordingStopBtn = elements.videoRecordingStopBtn;
    this.mediaRecorder = mediaRecorder;
    this.isRecordingAudio = false;
    this.isRecordingVideo = false;
    this.recordingTimerInterval = null;
    this.recordingStartTime = null;
    this.audioTimerEl = this.audioRecordingIndicator?.querySelector('.recording-timer');
    this.videoTimerEl = this.videoRecordingModal?.querySelector('.recording-timer');
  }

  /** Форматирует секунды в строку m:ss */
  formatRecordingTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  startRecordingTimer(type) {
    this.recordingStartTime = Date.now();
    this.recordingTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      const text = this.formatRecordingTime(elapsed);
      if (type === 'audio' && this.audioTimerEl) this.audioTimerEl.textContent = text;
      if (type === 'video' && this.videoTimerEl) this.videoTimerEl.textContent = text;
    }, 1000);
  }

  stopRecordingTimer() {
    if (this.recordingTimerInterval) {
      clearInterval(this.recordingTimerInterval);
      this.recordingTimerInterval = null;
    }
    if (this.audioTimerEl) this.audioTimerEl.textContent = '0:00';
    if (this.videoTimerEl) this.videoTimerEl.textContent = '0:00';
  }

  toggleAudioRecording() {
    if (!this.isRecordingAudio) {
      this.mediaRecorder.startAudioRecording({
        onStart: () => {
          this.isRecordingAudio = true;
          this.audioRecordingIndicator.style.display = 'flex';
          this.startRecordingTimer('audio');
        },
        onStop: (result) => {
          this.handleRecordingResult(result, 'audio');
          this.resetAudioRecording();
        },
        onError: (err) => {
          console.error('Audio recording error:', err);
          this.resetAudioRecording();
        },
      });
    } else {
      // Остановка только через красную кнопку у индикатора, не из бургер-меню
      return;
    }
  }

  toggleVideoRecording() {
    if (!this.isRecordingVideo) {
      this.mediaRecorder.startVideoRecording({
        onStart: () => {
          this.isRecordingVideo = true;
          this.videoRecordingIndicator.style.display = 'flex';
          const textEl = this.recordVideoBtn.querySelector('.btn-text');
          if (textEl) textEl.textContent = 'Остановить запись';
          this.showVideoRecordingModal();
          this.startRecordingTimer('video');
        },
        onStop: (result) => {
          this.handleRecordingResult(result, 'video');
        },
        onError: (err) => {
          console.error('Video recording error:', err);
          this.resetVideoRecording();
        },
      });
    } else {
      this.stopVideoRecordingFromModal();
    }
  }

  showVideoRecordingModal() {
    const stream = this.mediaRecorder.getStream();
    if (!this.videoRecordingModal || !this.videoRecordingPreview || !stream) return;
    this.videoRecordingPreview.srcObject = stream;
    this.videoRecordingPreview.play().catch(() => {});
    this.videoRecordingModal.classList.add('is-open');
    this.videoRecordingModal.setAttribute('aria-hidden', 'false');
  }

  hideVideoRecordingModal() {
    if (!this.videoRecordingModal || !this.videoRecordingPreview) return;
    this.videoRecordingPreview.srcObject = null;
    this.videoRecordingModal.classList.remove('is-open');
    this.videoRecordingModal.setAttribute('aria-hidden', 'true');
  }

  stopVideoRecordingFromModal() {
    if (!this.isRecordingVideo) return;
    this.mediaRecorder.stopRecording();
    this.resetVideoRecording();
  }

  /** Остановить запись аудио по нажатию кнопки «Стоп» у индикатора. */
  stopAudioRecordingFromButton() {
    if (!this.isRecordingAudio) return;
    this.mediaRecorder.stopRecording();
  }

  resetAudioRecording() {
    this.isRecordingAudio = false;
    this.audioRecordingIndicator.style.display = 'none';
    this.stopRecordingTimer();
  }

  resetVideoRecording() {
    this.isRecordingVideo = false;
    this.videoRecordingIndicator.style.display = 'none';
    const textEl = this.recordVideoBtn.querySelector('.btn-text');
    if (textEl) textEl.textContent = 'Запись видео';
    this.hideVideoRecordingModal();
    this.stopRecordingTimer();
  }

  handleRecordingResult(result, type) {
    const file = new File([ result.blob ], result.fileName, { type: result.type });
    const attachment = {
      id: Date.now().toString(),
      file,
      name: result.fileName,
      size: result.blob.size,
      type: result.type,
    };
    this.inputPanel.attachments.push(attachment);
    this.inputPanel.updateAttachmentsPreview();
  }
}
