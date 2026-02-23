/**
 * Полноэкранный overlay для приёма перетаскиваемых файлов (глобальный Drag and Drop).
 */
export default class DropOverlay {
  /**
   * @param {import('./InputPanel.js').default} inputPanel - родительская панель ввода
   * @param {{ dropOverlayEl: HTMLElement | null, onFiles: (files: File[]) => void }} options
   */
  constructor(inputPanel, options) {
    this.inputPanel = inputPanel;
    this.dropOverlay = options.dropOverlayEl;
    this.onFiles = options.onFiles;
  }

  show() {
    if (this.dropOverlay) {
      this.dropOverlay.classList.add('drop-overlay-visible');
      this.dropOverlay.setAttribute('aria-hidden', 'false');
    }
  }

  hide() {
    if (this.dropOverlay) {
      this.dropOverlay.classList.remove('drop-overlay-visible');
      this.dropOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  bindGlobalDragDrop() {
    document.body.addEventListener('dragenter', (e) => this._onGlobalDragEnter(e));
    document.body.addEventListener('dragleave', (e) => this._onGlobalDragLeave(e));
    document.body.addEventListener('dragover', (e) => this._onGlobalDragOver(e));
    document.body.addEventListener('drop', (e) => this._onGlobalDrop(e));

    if (this.dropOverlay) {
      const dropBox = this.dropOverlay.querySelector('.drop-overlay-box');
      const backdrop = this.dropOverlay.querySelector('.drop-overlay-backdrop');
      if (dropBox) {
        dropBox.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropBox.classList.remove('drag-over-box');
          this.onFiles(Array.from(e.dataTransfer.files));
          this.hide();
        });
        dropBox.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropBox.classList.add('drag-over-box');
          e.dataTransfer.dropEffect = 'copy';
        });
        dropBox.addEventListener('dragleave', (e) => {
          if (!dropBox.contains(e.relatedTarget)) {
            dropBox.classList.remove('drag-over-box');
          }
        });
      }
      if (backdrop) {
        backdrop.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.onFiles(Array.from(e.dataTransfer.files));
          this.hide();
        });
        backdrop.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        });
      }
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.dropOverlay?.classList.contains('drop-overlay-visible')) {
          this.hide();
        }
      });
    }
  }

  _onGlobalDragEnter(e) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    this.show();
  }

  _onGlobalDragLeave(e) {
    if (!e.dataTransfer.types.includes('Files')) return;
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !document.body.contains(relatedTarget)) {
      this.hide();
    }
  }

  _onGlobalDragOver(e) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  _onGlobalDrop(e) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    this.hide();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      this.onFiles(files);
    }
  }
}
