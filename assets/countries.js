// Извлекаем логику загрузки таблицы в отдельную функцию
async function fetchAndPopulateCountries() {
    try {
        // ВАЖНО: Проверьте правильность пути к XML. 
        // Если index.html находится в корне, а assets/loaded.xml – в корне, 
        // путь должен быть относительным от index.html, например, '/assets/loaded.xml'
        const response = await fetch('./loaded.xml');
        if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
        
        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const countries = xmlDoc.getElementsByTagName("country");
        // Элемент #countriesTableBody теперь гарантированно существует
        const tbody = document.getElementById("countriesTableBody");
        
        if (!tbody) return; // На всякий случай

        // Удаляем старые строки (если страница перезагружается)
        tbody.innerHTML = ''; 

        for (let country of countries) {
            const tr = document.createElement("tr");
            
            const fields = [
                "name", "fullname", "english", "alpha2", "alpha3", 
                "iso", "location", "location-precise"
            ];
            
            for (let field of fields) {
                const td = document.createElement("td");
                // Используйте ?.textContent для безопасного доступа
                const value = country.getElementsByTagName(field)[0]?.textContent || "-";
                td.textContent = value;
                tr.appendChild(td);
            }
            
            tbody.appendChild(tr);
        }
        
        // Скрываем индикатор загрузки и показываем таблицу
        const loadingEl = document.querySelector('.table-container .loading');
        const tableEl = document.querySelector('#countriesTableBody').closest('table');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (tableEl) tableEl.style.display = 'table';
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        const loadingEl = document.querySelector('.table-container .loading');
        if (loadingEl) loadingEl.textContent = 'Ошибка загрузки данных';
    }
}


// Слушатель события, которое мы добавили в lumo.js
document.addEventListener('lumo:contentRendered', (e) => {
    // Проверяем, что это наш ZTMF-файл (например, по названию или URL)
    const isCountriesPage = e.detail.url.endsWith('country.ztmf') || e.detail.pageName === 'Список стран';
    
    if (isCountriesPage) {
        // Запускаем логику загрузки только для этой страницы
        fetchAndPopulateCountries();
    }
});