const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.static('.'));

// Получение расписания электричек
app.get('/api/schedule', async (req, res) => {
    try {
        // Формируем дату в формате ГГГГ-ММ-ДД
        const today = new Date();
        const date = today.toISOString().split('T')[0];
        
        // Запрос к API ЦППК
        const response = await axios.get(`https://backend.cppktrain.ru/train-schedule/date-travel?date=${date}&fromStationId=2001940&toStationId=2001280`);
        
        // Преобразуем данные в нужный формат
        const trains = response.data.map(train => ({
            number: train.trainNumber,
            destination: train.finishStationName,
            departure: new Date(train.departureTime).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            platform: '1', // По умолчанию
            delay: train.deviation || null
        }));

        res.json(trains);
    } catch (error) {
        console.error('Ошибка при получении расписания:', error);
        res.status(500).json({ error: 'Ошибка при получении расписания' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
}); 