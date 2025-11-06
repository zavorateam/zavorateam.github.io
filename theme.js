// Общая система управления темой для всех страниц
(function() {
    // Получаем тему из localStorage или системных настроек
    function getInitialTheme() {
        const savedTheme = localStorage.getItem('zavoraTheme');
        if (savedTheme) {
            return savedTheme;
        }
        // Проверяем системные настройки
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    // Применяем тему
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('zavoraTheme', theme);
        // Отправляем событие для других страниц
        window.dispatchEvent(new CustomEvent('zavoraThemeChange', { detail: theme }));
    }

    // Инициализация при загрузке
    function initTheme() {
        const theme = getInitialTheme();
        applyTheme(theme);

        // Добавляем кнопку переключения темы, если её ещё нет
        if (!document.querySelector('.theme-toggle')) {
            const button = document.createElement('button');
            button.className = 'theme-toggle';
            button.setAttribute('aria-label', 'Переключить тему');
            button.innerHTML = '🌓';
            document.body.appendChild(button);
        }

        // Обработчик клика по кнопке
        document.querySelector('.theme-toggle').addEventListener('click', () => {
            const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            applyTheme(newTheme);
        });

        // Слушаем изменения темы в других вкладках
        window.addEventListener('storage', (e) => {
            if (e.key === 'zavoraTheme') {
                applyTheme(e.newValue);
            }
        });

        // Слушаем изменения системной темы
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
                if (!localStorage.getItem('zavoraTheme')) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }

    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
})();