function updateCurrentTime() {
    const now = new Date();
    const el = document.getElementById('currentTime');
    if (el) {
        el.textContent = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

function getMinutes(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function getTrainMarqueeText(train) {
    return train.stopsText || 'Остановки по всем пунктам.';
}

function getRandomPlatform() {
    const arr = [3, 4, 6];
    return arr[Math.floor(Math.random() * arr.length)];
}

function getScheduleFileName() {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const now = new Date();
    return `../electrichki_files/days/data-${days[now.getDay()]}.json`;
}

async function updateSchedule() {
    try {
        const fileName = getScheduleFileName();
        const response = await fetch(fileName);
        let trains = await response.json();
        
        // Фильтруем только те, что отправятся позже текущего времени
        const now = new Date();
        const nowMinutes = getMinutes(now);
        trains = trains.filter(train => {
            const [h, m] = train.departure.split(':');
            const depMinutes = parseInt(h, 10) * 60 + parseInt(m, 10);
            return depMinutes >= nowMinutes;
        });
        trains = trains.slice(0, 6);

        const tbody = document.getElementById('scheduleBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        trains.forEach((train, idx) => {
            const row = document.createElement('tr');
            row.className = 'train-row';

            const numberCell = document.createElement('td');
            numberCell.className = 'train-number';
            numberCell.innerHTML = Array.isArray(train.number)
                ? train.number.map(num => `<span>${num}</span>`).join('')
                : `<span>${train.number}</span>`;

            const destinationCell = document.createElement('td');
            destinationCell.className = 'destination';
            destinationCell.textContent = train.destination;

            const departureCell = document.createElement('td');
            departureCell.textContent = train.departure;

            const platformCell = document.createElement('td');
            platformCell.className = 'platform';
            let platform = train.arrivalStationName || train.arrivalStationLatinName || '';
            if (!platform || platform === '') {
                platform = getRandomPlatform();
            }
            platformCell.textContent = platform;

            const delayCell = document.createElement('td');
            delayCell.className = 'delay';
            delayCell.textContent = train.delay ? `+${train.delay} мин` : '';

            row.appendChild(numberCell);
            row.appendChild(destinationCell);
            row.appendChild(departureCell);
            row.appendChild(platformCell);
            row.appendChild(delayCell);

            tbody.appendChild(row);

            // Бегущая строка под поездом
            const marqueeRow = document.createElement('tr');
            marqueeRow.className = 'marquee-row-train';
            const marqueeTd = document.createElement('td');
            marqueeTd.colSpan = 5;
            marqueeTd.style.position = 'relative';

            const marqueeText = document.createElement('div');
            marqueeText.className = 'marquee-text-train';
            marqueeText.textContent = getTrainMarqueeText(train);
            marqueeText.style.animationDelay = `${Math.random() * 6}s`;

            marqueeTd.appendChild(marqueeText);
            marqueeRow.appendChild(marqueeTd);
            tbody.appendChild(marqueeRow);

            // Разделитель, если не последний поезд
            if (idx < trains.length - 1) {
                const dividerRow = document.createElement('tr');
                dividerRow.className = 'divider-row';
                const dividerTd = document.createElement('td');
                dividerTd.colSpan = 5;
                dividerRow.appendChild(dividerTd);
                tbody.appendChild(dividerRow);
            }
        });
    } catch (error) {
        console.error('Ошибка при обновлении расписания:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    updateSchedule();
    setInterval(updateSchedule, 90000);
}); 