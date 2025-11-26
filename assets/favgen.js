/* * Логика для страницы "Генератор Favicon и PWA иконок" (favicon_generator.ztmf).
 * Запускается через хук 'lumo:contentRendered'.
 */

// Глобальные переменные состояния
let imageBase64 = null;
const sizesToGenerate = [
    { size: 16, name: 'favicon-16x16.png', type: 'image/png' },
    { size: 32, name: 'favicon-32x32.png', type: 'image/png' },
    { size: 48, name: 'favicon-48x48.png', type: 'image/png' },
    { size: 180, name: 'apple-touch-icon.png', type: 'image/png' },
    { size: 192, name: 'android-chrome-192x192.png', type: 'image/png' },
    { size: 512, name: 'android-chrome-512x512.png', type: 'image/png' },
];

// Элементы DOM
let imageInput, uploadArea, generateButton, previewContainer, htmlCode, manifestCode;

// Инициализация элементов DOM и привязка событий
function initializeDomElements() {
    imageInput = document.getElementById('imageInput');
    uploadArea = document.getElementById('uploadArea');
    generateButton = document.getElementById('generateButton');
    previewContainer = document.getElementById('previewContainer');
    htmlCode = document.getElementById('htmlCode');
    manifestCode = document.getElementById('manifestCode');

    if (imageInput && uploadArea) {
        // 1. Привязка клика к input
        imageInput.addEventListener('change', (e) => handleImageUpload(e.target.files[0]));
        uploadArea.addEventListener('click', () => imageInput.click());
        
        // 2. Drag and Drop логика
        uploadArea.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            uploadArea.style.borderColor = 'var(--primary)'; 
            uploadArea.style.background = 'var(--bg-element)';
        });
        uploadArea.addEventListener('dragleave', (e) => { 
            e.preventDefault(); 
            uploadArea.style.borderColor = 'var(--text-muted)';
            uploadArea.style.background = 'transparent'; 
        });
        uploadArea.addEventListener('drop', (e) => { 
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--text-muted)';
            uploadArea.style.background = 'transparent';
            if (e.dataTransfer.files.length) {
                handleImageUpload(e.dataTransfer.files[0]);
            }
        });
    }
}

// Обработка загруженного файла
function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Пожалуйста, загрузите файл изображения (PNG или SVG).');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        imageBase64 = e.target.result;
        showPreview(imageBase64);
        generateCode();
        generateButton.disabled = false;
        generateButton.textContent = 'Скачать Favicon & PWA иконки';
    };
    reader.readAsDataURL(file);
}

// Отображение превью загруженного изображения и его ресайз
function showPreview(dataUrl) {
    if (!previewContainer) return;

    previewContainer.innerHTML = ''; // Очистка старых превью
    
    // Плейсхолдер скрывается, если есть контент, но мы его очистили, поэтому вернем
    const placeholder = document.getElementById('previewPlaceholder');
    if (placeholder) placeholder.style.display = 'none';

    const img = new Image();
    img.onload = () => {
        sizesToGenerate.slice(0, 6).forEach(size => { // Показываем 6 самых важных превью
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size.size;
            canvas.height = size.size;

            ctx.drawImage(img, 0, 0, size.size, size.size);

            const iconPreview = document.createElement('div');
            iconPreview.className = 'icon-preview';
            iconPreview.innerHTML = `
                <img src="${canvas.toDataURL(size.type)}" alt="${size.name}">
                <p style="font-size: 0.8rem; color: var(--text-main); margin: 0; font-weight: 500;">${size.size}x${size.size}</p>
                <p style="font-size: 0.7rem; color: var(--text-muted); margin: 0;">${size.name}</p>
            `;
            previewContainer.appendChild(iconPreview);
        });
    };
    img.src = dataUrl;
}

// Глобальная функция для скачивания всех файлов
window.generateFavicons = function() {
    if (!imageBase64 || !generateButton) {
        alert('Сначала загрузите изображение.');
        return;
    }

    generateButton.textContent = 'Генерация... Пожалуйста, разрешите несколько скачиваний.';
    generateButton.disabled = true;

    const imageLoadPromise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = imageBase64;
    });

    imageLoadPromise.then((img) => {
        sizesToGenerate.forEach(size => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = size.size;
            canvas.height = size.size;

            ctx.drawImage(img, 0, 0, size.size, size.size);

            // Создаем Blob и запускаем скачивание
            canvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.download = size.name;
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }, size.type);
        });

        // Возвращаем кнопку в исходное состояние
        setTimeout(() => {
            generateButton.textContent = 'Скачать Favicon & PWA иконки';
            generateButton.disabled = false;
        }, 3000); // Даем время браузеру обработать скачивание
    });
}

// Генерация кода (HTML и JSON)
function generateCode() {
    if (!htmlCode || !manifestCode) return;

    // 1. Manifest.json
    const manifest = {
        "name": "Мое приложение",
        "short_name": "Приложение",
        "icons": [
            {
                "src": "android-chrome-192x192.png",
                "sizes": "192x192",
                "type": "image/png"
            },
            {
                "src": "android-chrome-512x512.png",
                "sizes": "512x512",
                "type": "image/png"
            }
        ],
        "theme_color": "#ffffff",
        "background_color": "#ffffff",
        "display": "standalone"
    };

    manifestCode.textContent = JSON.stringify(manifest, null, 2);

    // 2. HTML код
    const html = `<link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">

<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">

<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#ffffff">`;

    htmlCode.textContent = html;
}

// Глобальная функция для копирования кода в буфер обмена (УЛУЧШЕНИЕ)
window.copyToClipboard = function(elementId) {
    const codeElement = document.getElementById(elementId);
    if (!codeElement) return;

    navigator.clipboard.writeText(codeElement.textContent)
        .then(() => {
            const originalText = codeElement.nextElementSibling.textContent;
            codeElement.nextElementSibling.textContent = 'Скопировано!';
            setTimeout(() => {
                codeElement.nextElementSibling.textContent = originalText;
            }, 1500);
        })
        .catch(err => {
            alert('Ошибка при копировании. Пожалуйста, скопируйте вручную.');
            console.error(err);
        });
}

// Слушатель события, которое должно быть добавлено в lumo.js
document.addEventListener('lumo:contentRendered', (e) => {
    // Проверяем, что это именно наша страница
    const isFaviconPage = e.detail.url.endsWith('favicon_generator.ztmf') || e.detail.pageName === 'Генератор Favicon и PWA иконок';
    
    if (isFaviconPage) {
        initializeDomElements();
        
        // Сброс состояния
        imageBase64 = null;
        if (generateButton) {
            generateButton.disabled = true;
            generateButton.textContent = 'Скачать Favicon & PWA иконки';
        }
        if (previewContainer) {
            previewContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);" id="previewPlaceholder">Загрузите изображение для просмотра.</p>`;
        }
        if (htmlCode) htmlCode.textContent = 'Код будет сгенерирован после загрузки изображения.';
        if (manifestCode) manifestCode.textContent = 'Код будет сгенерирован после загрузки изображения.';
    }
});