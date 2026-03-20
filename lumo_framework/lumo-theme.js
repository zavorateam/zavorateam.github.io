// lumo-theme-handler.js

class LumoTheme {
    constructor(position = 'bottom-right') {
      this.position = position || 'bottom-right';
      this.switchEl = null;
      this.themeKey = 'lumo-theme';
      // Чтение темы из localStorage по правильному ключу 'lumo-theme'
      this.current = localStorage.getItem(this.themeKey) || 'light';
      this._onClick = this.toggle.bind(this);
    }

    _iconFor(theme) {
      // SVG для луны (темная тема)
      const moonSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-moon">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;

      // SVG для солнца (светлая тема)
      const sunSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sun">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
      
      return theme === 'dark' ? moonSVG : sunSVG;
    }
    
    _titleFor(theme) { return theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'; }

    // Добавлен CSS для кнопки, чтобы она отображалась корректно
    _injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .lumo-theme-switch {
                position: fixed;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: var(--green-main, #28a745); /* Используем вашу переменную */
                color: white;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                transition: all 0.3s ease;
                padding: 0;
            }
            .lumo-theme-switch:hover {
                transform: scale(1.05);
                background: var(--green-hover, #218838); /* Используем вашу переменную */
            }
            
            /* Позиционирование кнопки */
            .lumo-theme-pos-bottom-right { bottom: 2rem; right: 2rem; }
            .lumo-theme-pos-top-right { top: 2rem; right: 2rem; }
            .lumo-theme-pos-bottom-left { bottom: 2rem; left: 2rem; }
            .lumo-theme-pos-top-left { top: 2rem; left: 2rem; }
        `;
        document.head.appendChild(style);
    }
    
    mount() {
      this._injectStyles(); // Вставляем стили
      
      const btn = document.createElement('button');
      btn.className = 'lumo-theme-switch';
      btn.setAttribute('aria-label', 'Toggle theme');
      // Использование innerHTML для вставки SVG
      btn.innerHTML = this._iconFor(this.current); 
      btn.title = this._titleFor(this.current);

      const posClass = `lumo-theme-pos-${this.position.replace(/\s+/g,'-').toLowerCase()}`;
      btn.classList.add(posClass);

      document.body.appendChild(btn);
      this.switchEl = btn;
      this.applyTheme(this.current);
      btn.addEventListener('click', this._onClick);
    }

    toggle() {
      this.current = this.current === 'light' ? 'dark' : 'light';
      this.applyTheme(this.current);
      if (this.switchEl) {
        // Использование innerHTML для вставки SVG
        this.switchEl.innerHTML = this._iconFor(this.current); 
        this.switchEl.title = this._titleFor(this.current);
      }
      localStorage.setItem(this.themeKey, this.current);
    }

    applyTheme(theme) {
      // Применение data-theme и class dark-mode, как вы просили
      document.body.dataset.theme = theme;
      document.body.classList.toggle('dark-mode', theme === 'dark');
      
      // Дополнительная логика для установки CSS-переменных, как в вашем классе
      // (Обратите внимание: ваши исходные стили используют :root и body.dark-mode)
      if (theme === 'light') {
        document.documentElement.style.setProperty('--bg-color', '#ffffff');
        document.documentElement.style.setProperty('--text-color', 'rgba(18,18,18,1)');
        document.documentElement.style.setProperty('--header-color', 'rgba(133, 133, 133, 1)');
      } else {
        document.documentElement.style.setProperty('--bg-color', 'rgba(18,18,18,1)');
        document.documentElement.style.setProperty('--text-color', 'rgba(230, 230, 230, 1)');
        document.documentElement.style.setProperty('--header-color', 'rgba(230, 230, 230, 1)');
      }
      document.documentElement.classList.toggle('lumo-dark', theme === 'dark');
    }

    destroy() {
      if (this.switchEl) {
        this.switchEl.removeEventListener('click', this._onClick);
        if (this.switchEl.parentNode) this.switchEl.parentNode.removeChild(this.switchEl);
        this.switchEl = null;
      }
      return Promise.resolve();
    }
}

// Запуск темы при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    // Создаем экземпляр LumoTheme и монтируем его
    const themeSwitcher = new LumoTheme('bottom-right');
    themeSwitcher.mount();
});