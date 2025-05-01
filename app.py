import os
import sys
import argparse
from flask import Flask, send_from_directory, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Конфигурация
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return send_from_directory('templates', 'explorer.html')

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.route('/uploads/<path:path>')
def send_upload(path):
    return send_from_directory(UPLOAD_FOLDER, path)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Файл не найден'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'Файл не выбран'})
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        return jsonify({'success': True, 'message': 'Файл успешно загружен'})
    
    return jsonify({'success': False, 'message': 'Недопустимый тип файла'})

@app.route('/api/files')
def list_files():
    try:
        files = os.listdir(UPLOAD_FOLDER)
        return jsonify({'success': True, 'files': files})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user', required=True, help='Имя пользователя')
    args = parser.parse_args()

    # Создаем необходимые директории
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)

    # Запускаем сервер
    app.run(host='127.0.0.1', port=5000) 