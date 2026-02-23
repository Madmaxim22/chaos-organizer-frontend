/**
 * Модальное окно ввода пароля. Возвращает Promise<string | null> (пароль или null при отмене).
 * @param {string} [title='Введите пароль'] - заголовок
 * @returns {Promise<string|null>}
 */
export function showPasswordModal(title = 'Введите пароль') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'password-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'password-modal-title');

    const remove = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };

    overlay.innerHTML = `
      <div class="password-modal">
        <h2 id="password-modal-title" class="password-modal-title">${title}</h2>
        <input type="password" class="password-modal-input" placeholder="Пароль" autocomplete="off" />
        <div class="password-modal-actions">
          <button type="button" class="password-modal-btn password-modal-cancel">Отмена</button>
          <button type="button" class="password-modal-btn password-modal-submit">ОК</button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .password-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .password-modal {
        background: var(--bg-color, #fff);
        padding: 1.25rem;
        border-radius: 8px;
        min-width: 280px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      }
      .password-modal-title { margin: 0 0 1rem; font-size: 1rem; }
      .password-modal-input {
        width: 100%;
        padding: 0.5rem;
        margin-bottom: 1rem;
        box-sizing: border-box;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      .password-modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
      .password-modal-btn { padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; border: 1px solid #ccc; }
      .password-modal-submit { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
.password-modal-submit:hover { background: var(--primary-hover); border-color: var(--primary-hover); }
    `;
    overlay.appendChild(style);

    const input = overlay.querySelector('.password-modal-input');
    const submitBtn = overlay.querySelector('.password-modal-submit');
    const cancelBtn = overlay.querySelector('.password-modal-cancel');

    const submit = () => {
      const value = input.value.trim();
      remove();
      resolve(value || null);
    };

    const cancel = () => {
      remove();
      resolve(null);
    };

    submitBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', cancel);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cancel();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') cancel();
    });

    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
    input.focus();
  });
}
