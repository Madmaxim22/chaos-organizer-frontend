import './InputPanel.css';
import MediaRecorderService from '@/services/mediaRecorder.js';
import LocationService from '@/services/LocationService.js';
import EmojiPickerService from '@/services/EmojiPickerService.js';
import MessageSendModel from '@/model/MessageSendModel.js';
import { formatBytes } from '@/utils/format.js';
import { parseScheduleCommand } from '@/services/ReminderService.js';
import { encryptText, encryptFile } from '@/services/EncryptionService.js';
import { showPasswordModal } from '@/utils/passwordModal.js';
import { showReminderModal } from '@/utils/reminderModal.js';
import CommandPalette from './CommandPalette.js';
import DropOverlay from './DropOverlay.js';
import RecordingUI from './RecordingUI.js';
import {
  FileUrl, AudioUrl, VideoUrl, LockOffUrl, LockOnUrl, CloseUrl, StopUrl, GeoUrl,
  ReminderUrl, SmileUrl,
} from '@/assets/icons.js';

/**
 * Панель ввода сообщений с поддержкой файлов, записи аудио/видео, Drag & Drop.
 */
export default class InputPanel {
  /**
   * @param {Object} notification - компонент уведомлений
   * @param {MessagesManager} messagesManager - менеджер сообщений
   * @param {MessageComponent} messageComponent - компонент списка сообщений (для добавления нового)
   * @param {import('../../services/ReminderService.js').default} [reminderService] - сервис напоминаний
   */
  constructor(notification, messagesManager, messageComponent, reminderService) {
    this.minTextareaHeight = 39;
    this.maxTextareaHeight = 200;
    this.attachments = [];
    this.encryptMode = false;
    this.mediaRecorder = new MediaRecorderService();
    this.locationService = new LocationService();
    this.messagesManager = messagesManager;
    this.notification = notification;
    this.messageComponent = messageComponent;
    this.reminderService = reminderService;
    this.render();
    this.bindEvents();
  }

  /** Находит и сохраняет ссылки на элементы панели ввода (поля, кнопки, превью вложений). */
  render() {
    this.container = document.querySelector('#inputPanelContainer');
    this.messageInput = this.container.querySelector('.message-input');
    this.sendBtn = this.container.querySelector('.send-btn');
    this.attachmentsPreview = this.container.querySelector('#attachmentsPreview');
    this.attachmentsList = this.container.querySelector('#attachmentsList');
    this.audioRecordingIndicator = this.container.querySelector('#audioRecordingIndicator');
    this.audioRecordingStopBtn = this.container.querySelector('.audio-recording-stop-btn');
    this.videoRecordingIndicator = this.container.querySelector('#videoRecordingIndicator');
    this.burgerButton = this.container.querySelector('.burger-button');
    this.burgerDropdown = this.container.querySelector('.burger-dropdown');
    // Бургер-меню
    this.emojiFromBurgerBtn = this.container.querySelector('.emoji-from-burger-btn');
    this.attachFileBtn = this.container.querySelector('.attach-file-btn');
    this.recordAudioBtn = this.container.querySelector('.record-audio-btn');
    this.recordVideoBtn = this.container.querySelector('.record-video-btn');
    this.locationBtn = this.container.querySelector('.location-btn');
    this.scheduleBtn = this.container.querySelector('.schedule-btn');
    this.encryptBtn = this.container.querySelector('.encrypt-btn');

    // Полноэкранное окно для Drag and Drop (разметка в index.html)
    this.dropOverlay = document.getElementById('dropOverlay');

    // Модальное окно записи видео (превью текущей записи)
    this.videoRecordingModal = document.getElementById('videoRecordingModal');
    this.videoRecordingPreview = document.getElementById('videoRecordingPreview');
    this.videoRecordingStopBtn = document.querySelector('.video-recording-stop-btn');

    // Блок прогресса загрузки (статическая разметка в index.html, показываем при необходимости)
    this.uploadProgressBlock = this.container.querySelector('#uploadProgressBlock');
    this.uploadProgressFill = this.uploadProgressBlock?.querySelector('.upload-progress-fill');
    this.uploadProgressPercent = this.uploadProgressBlock?.querySelector('.upload-progress-percent');

    this.commandPalette = new CommandPalette(this, {
      commandPaletteEl: this.container.querySelector('#commandPalette'),
      listEl: this.container.querySelector('#commandPalette')?.querySelector('.command-palette-list'),
      messageInput: this.messageInput,
    });
    if (this.commandPalette.commandPalette && this.commandPalette.commandPaletteList) {
      this.commandPalette.bindEvents();
    }

    this.dropOverlayManager = new DropOverlay(this, {
      dropOverlayEl: this.dropOverlay,
      onFiles: (files) => this.handleFiles(files),
    });
    this.dropOverlayManager.bindGlobalDragDrop();

    this.recordingUI = new RecordingUI(
      this,
      {
        recordAudioBtn: this.recordAudioBtn,
        recordVideoBtn: this.recordVideoBtn,
        audioRecordingIndicator: this.audioRecordingIndicator,
        audioRecordingStopBtn: this.audioRecordingStopBtn,
        videoRecordingIndicator: this.videoRecordingIndicator,
        videoRecordingModal: this.videoRecordingModal,
        videoRecordingPreview: this.videoRecordingPreview,
        videoRecordingStopBtn: this.videoRecordingStopBtn,
      },
      this.mediaRecorder
    );

    this.emojiPickerContainer = this.container.querySelector('#emojiPickerContainer');
    this.emojiPickerBtn = this.container.querySelector('#emojiPickerBtn');
    this.emojiPickerService = new EmojiPickerService({
      container: this.emojiPickerContainer,
      targetInput: this.messageInput,
      triggerButton: [
        this.emojiPickerBtn, this.emojiFromBurgerBtn
      ].filter(Boolean),
    });
    this.emojiPickerService.init();

    this.injectBurgerIcons();
  }

  /** Подставляет SVG-иконки из assets в кнопки бургер-меню и в overlay перетаскивания. */
  injectBurgerIcons() {
    const setIcon = (el, url) => {
      if (el && url) el.innerHTML = `<img src="${url}" alt="" aria-hidden="true" class="icon-img">`;
    };
    setIcon(this.emojiFromBurgerBtn?.querySelector('.icon'), SmileUrl);
    setIcon(this.attachFileBtn?.querySelector('.icon'), FileUrl);
    setIcon(this.recordAudioBtn?.querySelector('.icon'), AudioUrl);
    setIcon(this.recordVideoBtn?.querySelector('.icon'), VideoUrl);
    setIcon(this.encryptBtn?.querySelector('.icon'), LockOffUrl);
    setIcon(this.audioRecordingStopBtn?.querySelector('.icon'), StopUrl);
    setIcon(this.videoRecordingStopBtn?.querySelector('.icon'), StopUrl);
    setIcon(this.locationBtn?.querySelector('.icon'), GeoUrl);
    setIcon(this.scheduleBtn?.querySelector('.icon'), ReminderUrl);
    const dropIcon = document.getElementById('dropOverlayIcon');
    if (dropIcon) {
      dropIcon.innerHTML = `<img src="${FileUrl}" alt="" aria-hidden="true" class="icon-img">`;
    }
    const emojiIcon = this.emojiPickerBtn?.querySelector('.emoji-picker-icon');
    if (emojiIcon && SmileUrl) {
      emojiIcon.innerHTML = `<img src="${SmileUrl}" alt="" aria-hidden="true" class="icon-img">`;
    }
  }

  /** Обновляет иконку кнопки «Шифровать» в зависимости от режима (LockOn — включено, LockOff — выключено). */
  updateEncryptButtonIcon() {
    const iconEl = this.encryptBtn?.querySelector('.icon');
    if (iconEl && LockOnUrl && LockOffUrl) {
      const url = this.encryptMode ? LockOnUrl : LockOffUrl;
      iconEl.innerHTML = `<img src="${url}" alt="" aria-hidden="true" class="icon-img">`;
    }
  }

  /** Привязывает обработчики: кнопки, Drag & Drop, клавиши (Ctrl+Enter), ввод в textarea. */
  bindEvents() {
    this.attachFileBtn.addEventListener('click', () => this.openFilePicker());
    this.recordAudioBtn.addEventListener('click', () => this.recordingUI.toggleAudioRecording());
    this.recordVideoBtn.addEventListener('click', () => this.recordingUI.toggleVideoRecording());

    if (this.recordingUI.audioRecordingStopBtn) {
      this.recordingUI.audioRecordingStopBtn.addEventListener('click', () =>
        this.recordingUI.stopAudioRecordingFromButton());
    }
    if (this.recordingUI.videoRecordingStopBtn) {
      this.recordingUI.videoRecordingStopBtn.addEventListener('click', () =>
        this.recordingUI.stopVideoRecordingFromModal());
    }
    if (this.recordingUI.videoRecordingModal) {
      const backdrop = this.recordingUI.videoRecordingModal.querySelector('.video-recording-modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => this.recordingUI.stopVideoRecordingFromModal());
      }
    }
    document.addEventListener('keydown', (e) => {
      const modalOpen = this.recordingUI.videoRecordingModal?.classList.contains('is-open');
      if (e.key === 'Escape' && modalOpen && this.recordingUI.isRecordingVideo) {
        this.recordingUI.stopVideoRecordingFromModal();
      }
    });
    this.locationBtn.addEventListener('click', () => this.sendLocation());
    this.scheduleBtn.addEventListener('click', () => this.openScheduleDialog());
    this.encryptBtn.addEventListener('click', () => this.encryptMessage());
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    if (this.emojiPickerBtn) {
      this.emojiPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emojiPickerService.toggle();
      });
    }
    if (this.emojiFromBurgerBtn) {
      this.emojiFromBurgerBtn.addEventListener('click', () => {
        this.emojiPickerService.toggle();
      });
    }

    this.burgerButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.burgerDropdown.classList.toggle('show');
    });
    this.burgerDropdown.addEventListener('click', (e) => {
      if (e.target.closest('.burger-item')) {
        this.burgerDropdown.classList.remove('show');
      }
    });

    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.container.classList.add('drag-over');
    });
    this.container.addEventListener('dragleave', () => {
      this.container.classList.remove('drag-over');
    });
    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      this.container.classList.remove('drag-over');
      this.handleFiles(Array.from(e.dataTransfer.files));
    });

    this.messageInput.addEventListener('keydown', (e) => {
      if (this.commandPalette.handleKeydown(e)) return;
      if (e.ctrlKey && e.key === 'Enter') {
        this.sendMessage();
      }
    });
    this.messageInput.addEventListener('input', () => {
      this.handleTextareaInput();
      this.commandPalette.updateFromInput();
    });
  }

  /** Открывает диалог выбора файлов; выбранные файлы добавляются во вложения. */
  openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      this.handleFiles(files);
    });
    input.click();
  }

  /** Добавляет массив файлов в this.attachments и обновляет превью. */
  handleFiles(files) {
    files.forEach(file => {
      this.attachments.push({
        id: Date.now().toString(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    });
    this.updateAttachmentsPreview();
  }

  /** Отрисовывает список вложений и кнопки удаления; скрывает блок, если вложений нет. */
  updateAttachmentsPreview() {
    if (this.attachments.length === 0) {
      this.attachmentsPreview.style.display = 'none';
      return;
    }
    this.attachmentsPreview.style.display = 'block';
    this.attachmentsList.innerHTML = this.attachments.map(att => {
      const sizeStr = formatBytes(att.size, { locale: 'en' });
      return `
      <div class="attachment-item">
        <span class="attachment-name">${att.name} (${sizeStr})</span>
        <button class="remove-attachment" data-id="${att.id}" type="button" aria-label="Удалить вложение">
          <img src="${CloseUrl}" alt="" class="remove-icon" aria-hidden="true">
        </button>
      </div>
    `;
    }).join('');
    this.attachmentsList.querySelectorAll('.remove-attachment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const button = e.target.closest('.remove-attachment');
        if (button) this.removeAttachment(button.getAttribute('data-id'), button);
      });
    });
  }

  /** Удаляет вложение по id из списка и из DOM. */
  removeAttachment(id, button) {
    this.attachments = this.attachments.filter(att => att.id !== id);
    button.closest('.attachment-item')?.remove();
    if(this.attachments.length === 0) {
      this.attachmentsPreview.style.display = 'none';
    };
  }

  /** Запрашивает геолокацию и отправляет её как сообщение (координаты + ссылка на карту). */
  async sendLocation() {
    try {
      const { latitude, longitude } = await this.locationService.getCurrentPosition();
      const content = this.locationService.formatLocationMessage(latitude, longitude);

      const message = new MessageSendModel({
        author: 'Пользователь',
        content,
        files: [],
      });

      const receivedMessage = await this.messagesManager.sendMessage(message);
      this.messageComponent.renderMessage(receivedMessage);
      this.notification.info('Успешно', 'Геолокация отправлена');
    } catch (error) {
      this.notification.error('Ошибка геолокации', error.message || 'Не удалось получить местоположение');
    }
  }

  /** Открывает модальное окно с календарём, временем и текстом для установки напоминания. */
  async openScheduleDialog() {
    this.burgerDropdown.classList.remove('show');
    if (!this.reminderService) {
      this.notification.warning('Напоминания недоступны', 'Сервис напоминаний не подключён.');
      return;
    }
    const result = await showReminderModal();
    if (!result) return;

    const { text, triggerAt } = result;
    if (triggerAt.getTime() <= Date.now()) {
      this.notification.warning('Напоминание в прошлом', 'Укажите будущую дату и время.');
      return;
    }

    try {
      await this.reminderService.requestPermission();
      await this.reminderService.createReminder({
        text, triggerAt
      });
      const timeStr = triggerAt.toLocaleString('ru-RU', {
        dateStyle: 'short', timeStyle: 'short'
      });
      this.notification.info('Напоминание установлено', `${timeStr} — ${text}`);
    } catch (err) {
      console.error('Reminder create failed:', err);
      this.notification.error('Ошибка', 'Не удалось создать напоминание.');
    }
  }

  /** Переключает режим «отправить зашифрованным». При отправке будет запрошен пароль. */
  encryptMessage() {
    this.encryptMode = !this.encryptMode;
    this.encryptBtn?.classList.toggle('active', this.encryptMode);
    this.encryptBtn?.setAttribute('title', this.encryptMode ? 'Отключить шифрование' : 'Зашифровать сообщение');
    this.updateEncryptButtonIcon();
  }

  /** Показывает блок прогресса загрузки и обновляет процент. */
  showUploadProgress(percent) {
    if (!this.uploadProgressBlock) return;
    this.uploadProgressBlock.style.display = 'flex';
    if (this.uploadProgressFill) this.uploadProgressFill.style.width = `${Math.min(100, percent)}%`;
    if (this.uploadProgressPercent) this.uploadProgressPercent.textContent = `${percent}%`;
  }

  /** Скрывает блок прогресса загрузки. */
  hideUploadProgress() {
    if (!this.uploadProgressBlock) return;
    this.uploadProgressBlock.style.display = 'none';
    if (this.uploadProgressFill) this.uploadProgressFill.style.width = '0%';
    if (this.uploadProgressPercent) this.uploadProgressPercent.textContent = '0%';
  }

  /** Отправляет сообщение (текст + вложения) через MessagesManager, добавляет в список, очищает поле. */
  async sendMessage() {
    const text = this.messageInput.value.trim();
    if (!text && this.attachments.length === 0) {
      this.notification.warning('Предупреждение', 'Введите текст или прикрепите файл');
      return;
    }

    const scheduleData = parseScheduleCommand(text);
    if (scheduleData && this.reminderService) {
      try {
        await this.reminderService.requestPermission();
        await this.reminderService.createReminder({
          text: scheduleData.text,
          triggerAt: scheduleData.triggerAt,
        });
        this.messageInput.value = '';
        this.resetTextareaHeight();
        const at = scheduleData.triggerAt.toLocaleString('ru-RU');
        this.notification.info('Напоминание установлено', `${at} — ${scheduleData.text}`);
      } catch (err) {
        console.error('Reminder create failed:', err);
        this.notification.error('Ошибка', 'Не удалось создать напоминание.');
      }
      return;
    }

    let content = text;
    let files = this.attachments.map(att => att.file);
    let encrypted = false;

    if (this.encryptMode) {
      const password = await showPasswordModal('Введите пароль для шифрования');
      if (!password) {
        this.notification.warning('Отменено', 'Пароль не введён');
        return;
      }
      try {
        content = encryptText(content, password);
        const encryptedFiles = [];
        for (const att of this.attachments) {
          const encFile = await encryptFile(att.file, password);
          encryptedFiles.push(encFile);
        }
        files = encryptedFiles;
        encrypted = true;
      } catch (err) {
        console.error('Encryption failed:', err);
        this.notification.error('Ошибка шифрования', err?.message || 'Не удалось зашифровать');
        return;
      }
    }

    const message = new MessageSendModel({
      author: 'Пользователь',
      content,
      files,
      encrypted,
    });

    const hasFiles = this.attachments.length > 0;
    const onProgress = hasFiles ? (percent) => this.showUploadProgress(percent) : undefined;

    try {
      if (hasFiles) this.showUploadProgress(0);
      const received = await this.messagesManager.sendMessage(message, { onProgress });
      this.hideUploadProgress();
      if (received.botReply) {
        this.messageComponent.renderMessage(received.message);
        this.messageComponent.renderMessage(received.botReply);
      } else {
        this.messageComponent.renderMessage(received);
      }
      this.notification.info('Успешно', 'Сообщение отправлено');

      // Очистка после успешной отправки
      this.messageInput.value = '';
      this.resetTextareaHeight();
      this.attachments = [];
      this.encryptMode = false;
      this.encryptBtn?.classList.remove('active');
      this.encryptBtn?.setAttribute('title', 'Зашифровать сообщение');
      this.updateEncryptButtonIcon();
      this.updateAttachmentsPreview();
    } catch (error) {
      this.hideUploadProgress();
      console.error('Ошибка отправки сообщения:', error);
      this.notification.error('Ошибка отправки', 'Не удалось отправить сообщение на сервер.');
    }
  }

  /** Автоподстройка высоты textarea при вводе (в пределах min/max). */
  handleTextareaInput() {
    // Сбрасываем высоту, чтобы получить реальную высоту содержимого
    this.messageInput.style.height = this.minTextareaHeight + 'px';
    // Вычисляем новую высоту с учетом ограничений
    const newHeight = Math.min(
      Math.max(this.messageInput.scrollHeight, this.minTextareaHeight),
      this.maxTextareaHeight
    );
    this.messageInput.style.height = newHeight + 'px';
  }

  /** Сбрасывает высоту textarea до минимальной (после очистки поля). */
  resetTextareaHeight() {
    if (this.messageInput) {
      this.messageInput.style.height = this.minTextareaHeight + 'px';
    }
  }
}