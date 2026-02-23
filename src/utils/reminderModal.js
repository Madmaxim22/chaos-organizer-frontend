/**
 * Модальное окно установки напоминания: календарь, время, текст.
 * @returns {Promise<{ text: string, triggerAt: Date } | null>} данные напоминания или null при отмене
 */
export function showReminderModal() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);
  const defaultTime = '12:00';

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'reminder-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'reminder-modal-title');

    const remove = () => {
      overlay.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
    };

    overlay.innerHTML = `
      <div class="reminder-modal" onclick="event.stopPropagation()">
        <h2 id="reminder-modal-title" class="reminder-modal-title">Новое напоминание</h2>
        <div class="reminder-modal-body">
          <label class="reminder-modal-label">
            <span>Дата</span>
            <input type="date" class="reminder-modal-date" value="${defaultDate}" min="${today}" />
          </label>
          <label class="reminder-modal-label">
            <span>Время</span>
            <input type="time" class="reminder-modal-time" value="${defaultTime}" />
          </label>
          <label class="reminder-modal-label reminder-modal-label-text">
            <span>Текст напоминания</span>
            <textarea class="reminder-modal-text" placeholder="Например: Позвонить маме" rows="3"></textarea>
          </label>
        </div>
        <div class="reminder-modal-actions">
          <button type="button" class="reminder-modal-btn reminder-modal-cancel">Отмена</button>
          <button type="button" class="reminder-modal-btn reminder-modal-submit primary-button">Установить</button>
        </div>
      </div>
    `;

    const dateInput = overlay.querySelector('.reminder-modal-date');
    const timeInput = overlay.querySelector('.reminder-modal-time');
    const textInput = overlay.querySelector('.reminder-modal-text');
    const submitBtn = overlay.querySelector('.reminder-modal-submit');
    const cancelBtn = overlay.querySelector('.reminder-modal-cancel');

    const submit = () => {
      const text = (textInput.value || '').trim() || 'Напоминание';
      const dateStr = dateInput.value;
      const timeStr = timeInput.value;
      if (!dateStr || !timeStr) {
        return;
      }
      const triggerAt = new Date(`${dateStr}T${timeStr}`);
      if (Number.isNaN(triggerAt.getTime())) {
        return;
      }
      remove();
      resolve({
        text, triggerAt
      });
    };

    const cancel = () => {
      remove();
      resolve(null);
    };

    function onKeydown(e) {
      if (e.key === 'Escape') cancel();
    }

    submitBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', cancel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cancel();
    });
    document.addEventListener('keydown', onKeydown);

    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
    textInput.focus();
  });
}
