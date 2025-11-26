/* * ВЕСЬ КОД ИЗ ОРИГИНАЛЬНОГО <script> ВЫНЕСЕН СЮДА 
 * И ЗАПУСКАЕТСЯ ТОЛЬКО ПОСЛЕ РЕНДЕРИНГА ZTMF
 */

// Получение элементов DOM (гарантированно сработает после рендеринга)
let urlsTextarea;
let checkButton;
let progressBar;
let resultsDiv;
let statsDiv;

let totalLinks = 0;
let checkedLinks = 0;
let workingLinks = 0;
let brokenLinks = 0;

// Инициализация элементов DOM (вызывается после рендеринга страницы)
function initializeDomElements() {
    urlsTextarea = document.getElementById('urls');
    checkButton = document.getElementById('checkButton');
    progressBar = document.getElementById('progressBar');
    resultsDiv = document.getElementById('results');
    statsDiv = document.getElementById('stats');
}


// Глобальная функция, привязанная к кнопке (onClick)
window.startChecking = function() {
    if (!urlsTextarea) initializeDomElements(); // Повторная инициализация на случай ошибки

    const urls = urlsTextarea.value.split('\n').filter(url => url.trim());
    if (urls.length === 0) {
        alert('Пожалуйста, введите хотя бы один URL');
        return;
    }

    // Сброс статистики
    totalLinks = urls.length;
    checkedLinks = 0;
    workingLinks = 0;
    brokenLinks = 0;
    resultsDiv.innerHTML = '';
    updateStats();
    checkButton.disabled = true;

    // Проверка каждой ссылки (можно ограничить количество одновременных запросов, но оставим как в оригинале)
    urls.forEach((url, index) => {
        checkLink(url.trim(), index);
    });
}

function checkLink(url, index) {
    const linkItem = document.createElement('div');
    linkItem.className = 'link-item loading';
    linkItem.innerHTML = `
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${url}</span>
        <span class="status loading">Проверка...</span>
    `;
    resultsDiv.appendChild(linkItem);

    // !!! ВАЖНОЕ ПРИМЕЧАНИЕ О CORS !!!
    // Использование 'https://cors-anywhere.herokuapp.com/' для обхода CORS.
    // Этот прокси может быть нестабилен, медленен или блокировать запросы. 
    // Вам потребуется более надежный собственный прокси-сервер.
    const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
    
    fetch(proxyUrl, {
        method: 'HEAD', // HEAD запрос быстрее, так как не скачивает тело ответа
        // Заголовок для обхода ограничений cors-anywhere
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        checkedLinks++;
        if (response.ok) {
            workingLinks++;
            linkItem.className = 'link-item good';
            linkItem.querySelector('.status').className = 'status good';
            linkItem.querySelector('.status').textContent = 'OK';
        } else {
            brokenLinks++;
            linkItem.className = 'link-item bad';
            linkItem.querySelector('.status').className = 'status bad';
            linkItem.querySelector('.status').textContent = `Ошибка ${response.status}`;
        }
        updateProgress();
    })
    .catch(error => {
        checkedLinks++;
        brokenLinks++;
        linkItem.className = 'link-item bad';
        linkItem.querySelector('.status').className = 'status bad';
        linkItem.querySelector('.status').textContent = 'Ошибка сети / CORS';
        updateProgress();
    });
}

function updateProgress() {
    if (!progressBar) return;
    const progress = (checkedLinks / totalLinks) * 100;
    progressBar.style.width = `${progress}%`;
    updateStats();

    if (checkedLinks === totalLinks) {
        checkButton.disabled = false;
    }
}

function updateStats() {
    if (statsDiv) {
        statsDiv.textContent = `Всего ссылок: ${totalLinks} | Рабочих: ${workingLinks} | Битых: ${brokenLinks} | В процессе: ${totalLinks - checkedLinks}`;
    }
}

// Слушатель события, которое должно быть добавлено в lumo.js (см. предыдущее обсуждение)
document.addEventListener('lumo:contentRendered', (e) => {
    // Проверяем, что это именно наша страница
    const isCheckerPage = e.detail.url.endsWith('checker.ztmf') || e.detail.pageName === 'Проверка битых ссылок';
    
    if (isCheckerPage) {
        // Инициализируем элементы при загрузке страницы
        initializeDomElements();
        // Сбрасываем прогресс и статистику для чистого вида
        totalLinks = 0; checkedLinks = 0; workingLinks = 0; brokenLinks = 0;
        if (resultsDiv) resultsDiv.innerHTML = '';
        if (progressBar) progressBar.style.width = '0%';
        if (checkButton) checkButton.disabled = false;
        updateStats();
    }
});