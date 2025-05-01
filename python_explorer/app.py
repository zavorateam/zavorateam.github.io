from flask import Flask, render_template, request, redirect, url_for, flash, send_from_directory, jsonify, session
import os
from werkzeug.utils import secure_filename
from PIL import Image, UnidentifiedImageError
import re
import shutil
from typing import List, Dict, Tuple, Optional
from functools import lru_cache
import datetime
import uuid
import logging
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

app = Flask(__name__)
app.secret_key = "secret_key"

# Настройка логирования
logging.basicConfig(
    filename='app.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Настройка Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# База данных пользователей
def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  username TEXT UNIQUE NOT NULL,
                  password_hash TEXT NOT NULL,
                  ip_address TEXT,
                  serial_number TEXT,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

class User(UserMixin):
    def __init__(self, user_id, username):
        self.id = user_id
        self.username = username

@login_manager.user_loader
def load_user(user_id):
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('SELECT id, username FROM users WHERE id = ?', (user_id,))
    user_data = c.fetchone()
    conn.close()
    if user_data:
        return User(user_data[0], user_data[1])
    return None

# Конфигурация папок
UPLOAD_FOLDER = 'uploads'
TEMP_FOLDER = 'temp_uploads'
COLLECTIONS_FOLDER = 'collections'
USER_FOLDERS = 'user_folders'

# Создание необходимых директорий
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TEMP_FOLDER, exist_ok=True)
os.makedirs(COLLECTIONS_FOLDER, exist_ok=True)
os.makedirs(USER_FOLDERS, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
DEFAULT_PHOTO_HEIGHT = 230
PHOTOS_PER_PAGE = 18
COLLECTION_TILE_SIZE = (300, 300)
COLLECTION_GROUPS_FILE = 'collection_groups.txt'  # Store group information

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['TEMP_FOLDER'] = TEMP_FOLDER
app.config['COLLECTIONS_FOLDER'] = COLLECTIONS_FOLDER
app.config['USER_FOLDERS'] = USER_FOLDERS


# --- Helper Functions ---

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@lru_cache(maxsize=1024)
def get_image_dimensions(path: str) -> Tuple[Optional[int], Optional[int]]:
    """Gets image dimensions, handling potential errors, with caching."""
    try:
        with Image.open(path) as img:
            width, height = img.size
            return width, height
    except (UnidentifiedImageError, FileNotFoundError, OSError):
        return None, None


def process_image_dimensions(width: Optional[int], height: Optional[int]) -> Tuple[Optional[int], Optional[int]]:
    """Scales image dimensions if height exceeds 400px."""
    if height is not None and height > 400:
        return width // 4 if width is not None else None, height // 4
    return width, height


def extract_tags(filename: str) -> List[str]:
    """Extracts tags from a filename, removing the extension and splitting by underscores."""
    return filename.rsplit('.', 1)[0].split('_')[1:]


def get_photo_collections(filename: str) -> List[str]:
    """Gets the collections a photo belongs to."""
    collections = [
        dirname for dirname in os.listdir(app.config['COLLECTIONS_FOLDER'])
        if os.path.isdir(os.path.join(app.config['COLLECTIONS_FOLDER'], dirname)) and
           os.path.exists(os.path.join(app.config['COLLECTIONS_FOLDER'], dirname, filename))
    ]
    return collections


def get_photos_from_directory(directory: str) -> List[Dict]:
    """Gets all photos from a directory."""
    photos = []
    try:
        for filename in os.listdir(directory):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                filepath = os.path.join(directory, filename)
                try:
                    with Image.open(filepath) as img:
                        width, height = img.size
                        photos.append({
                            'name': filename,
                            'path': filepath,
                            'size': os.path.getsize(filepath),
                            'width': width,
                            'height': height
                        })
                except Exception as e:
                    logging.error(f"Error getting image dimensions for {filepath}: {e}")
                    photos.append({
                        'name': filename,
                        'path': filepath,
                        'size': os.path.getsize(filepath),
                        'width': None,
                        'height': None
                    })
    except Exception as e:
        logging.error(f"Error getting photos from directory {directory}: {e}")
    return photos


def get_photos(directory: str) -> List[Dict]:
    """Gets photo data from a directory, cached and optimized, handling exceptions."""
    try:
        return get_photos_from_directory(directory)
    except Exception as e:
        logging.error(f"Error getting photos from {directory}: {e}")
        return []


# --- Collection Group Management ---

def get_collection_groups() -> Dict[str, List[str]]:
    """Gets collection groups from the file."""
    groups = {}
    try:
        user_folder = get_user_folder(current_user.id)
        groups_file = os.path.join(user_folder, COLLECTION_GROUPS_FILE)
        if os.path.exists(groups_file):
            with open(groups_file, 'r') as f:
                for line in f:
                    group_name, collection_names_str = line.strip().split(':', 1)
                    collection_names = collection_names_str.split(',') if collection_names_str else []
                    groups[group_name] = collection_names
    except Exception as e:
        logging.error(f"Error reading collection groups: {e}")

    return groups

def save_collection_groups(groups: Dict[str, List[str]]):
    """Saves collection groups to the file."""
    try:
        user_folder = get_user_folder(current_user.id)
        groups_file = os.path.join(user_folder, COLLECTION_GROUPS_FILE)
        with open(groups_file, 'w') as f:
            for group_name, collection_names in groups.items():
                f.write(f"{group_name}:{','.join(collection_names)}\n")
    except Exception as e:
        logging.error(f"Error saving collection groups: {e}")

def get_collections(groups: Dict[str, List[str]]) -> List[Dict]:
    """Gets collection data, with group information."""
    collections = []
    try:
        user_folder = get_user_folder(current_user.id)
        collections_folder = os.path.join(user_folder, 'collections')
        os.makedirs(collections_folder, exist_ok=True)
        
        for dirname in os.listdir(collections_folder):
            dirpath = os.path.join(collections_folder, dirname)
            if os.path.isdir(dirpath):
                photos = get_photos_from_directory(dirpath)
                total_size = sum(os.path.getsize(photo['path']) for photo in photos)
                total_size_mb = round(total_size / (1024 * 1024), 2)

                group_name = None
                for grp, collection_list in groups.items():
                    if dirname in collection_list:
                        group_name = grp
                        break
                
                collections.append({
                    "name": dirname,
                    "count": len(photos),
                    "photos": photos,
                    "size": f"{total_size_mb} MB",
                    "group": group_name
                })
    except Exception as e:
        logging.error(f"Error getting collections: {e}")
    
    return collections


def calculate_average_width(photos: List[Dict]) -> int:
    """Calculates the average width of photos."""
    if not photos:
        return 200  # Default width
        
    total_width = 0
    count = 0
    
    for photo in photos:
        try:
            with Image.open(photo['path']) as img:
                total_width += img.width
                count += 1
        except Exception as e:
            logging.error(f"Error calculating width for {photo['path']}: {e}")
            
    return total_width // count if count > 0 else 200


def populate_temp_folder(page: int, upload_folder: str, temp_folder: str, photos_per_page: int):
    """Populates the temporary folder with photos for the current and next page."""
    start = (page - 1) * photos_per_page
    end = start + (2 * photos_per_page)  # Load photos for the current AND next page
    photos = sorted(os.listdir(upload_folder))  # Sort photos alphabetically
    photos_to_copy = photos[start:end]

    # Clear the temp folder
    for filename in os.listdir(temp_folder):
        file_path = os.path.join(temp_folder, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print('Failed to delete %s. Reason: %s' % (file_path, e))

    # Copy photos to the temp folder
    for filename in photos_to_copy:
        source_path = os.path.join(upload_folder, filename)
        dest_path = os.path.join(temp_folder, filename)
        shutil.copy2(source_path, dest_path)  # Copy with metadata
        now = datetime.datetime.now()
        print(f"\033[33 {now} -- \033[37 Copied {filename} to temporary folder.")

@app.route('/', defaults={'page': 1})
@app.route('/page/<int:page>')
@login_required
def index(page: int):
    user_folder = get_user_folder(current_user.id)
    user_upload_folder = os.path.join(user_folder, 'uploads')
    user_temp_folder = os.path.join(user_folder, 'temp')
    user_collections_folder = os.path.join(user_folder, 'collections')

    populate_temp_folder(page, user_upload_folder, user_temp_folder, PHOTOS_PER_PAGE)

    temp_photos = get_photos_from_directory(user_temp_folder)
    total_count = len(get_photos_from_directory(user_upload_folder))
    total_size_mb = round(sum(os.path.getsize(photo['path']) for photo in get_photos_from_directory(user_upload_folder)) / (1024 * 1024), 2)
    average_width = calculate_average_width(temp_photos)


    collection_groups = get_collection_groups()
    collections = get_collections(collection_groups)
    total_count_right = sum(len(col['photos']) for col in collections)
    total_size_right_mb = round(sum(os.path.getsize(photo['path']) for col in collections for photo in col['photos']) / (1024 * 1024), 2)

    for photo in temp_photos:
        if photo.get('width') and photo.get('height'):
            photo['tile_size'] = photo['height'] if photo['height'] > photo['width'] else average_width
        else:
            photo['tile_size'] = DEFAULT_PHOTO_HEIGHT

    return render_template(
        'index.html',
        photos=temp_photos,
        total_count_left=total_count,
        total_size_left=f"{total_size_mb} MB",
        collection_groups=collection_groups,
        collections=collections,
        total_count_right=total_count_right,
        total_size_right=f"{total_size_right_mb} MB",
        page=page,
        total_count=total_count,
        average_width=average_width,
        default_photo_height=DEFAULT_PHOTO_HEIGHT,
        collection_tile_size=COLLECTION_TILE_SIZE
    )


def validate_collection_name(collection_name: str) -> Optional[str]:
    """Проверяет валидность имени коллекции."""
    if not collection_name:
        return "Имя коллекции не может быть пустым"
    if not re.match("^[a-zA-Z0-9_]+$", collection_name):
        return "Имя коллекции может содержать только буквы, цифры и символ подчеркивания"
    if len(collection_name) > 50:
        return "Имя коллекции не может быть длиннее 50 символов"
    if collection_name.lower() in ["uploads", "collections", "admin", "static"]:
        return "Это имя зарезервировано"
    return None


@app.route('/create_collection', methods=['POST'])
@login_required
def create_collection():
    try:
        collection_name = request.form.get('collection_name')
        group_name = request.form.get('group_name')
        
        if not collection_name:
            return jsonify({'status': 'error', 'message': 'Не указано название коллекции'}), 400
            
        if (error := validate_collection_name(collection_name)):
            return jsonify({'status': 'error', 'message': error}), 400

        user_folder = get_user_folder(current_user.id)
        collection_path = os.path.join(user_folder, 'collections', collection_name)
        
        if os.path.exists(collection_path):
            return jsonify({'status': 'error', 'message': 'Коллекция с таким именем уже существует'}), 400

        os.makedirs(collection_path)
        
        # Если указана группа, добавляем коллекцию в группу
        if group_name:
            groups = get_collection_groups()
            if group_name not in groups:
                groups[group_name] = []
            groups[group_name].append(collection_name)
            save_collection_groups(groups)
        
        logging.info(f'User {current_user.username} created collection {collection_name}')
        return jsonify({
            'status': 'success',
            'message': 'Коллекция успешно создана',
            'collection': {
                'name': collection_name,
                'group': group_name,
                'count': 0,
                'size': '0 MB'
            }
        })
    except Exception as e:
        logging.error(f"Error creating collection: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/create_collection_group', methods=['POST'])
@login_required
def create_collection_group():
    try:
        group_name = request.form.get('group_name')
        if not group_name:
            flash('Не указано название группы', 'error')
            return redirect(url_for('index'))
            
        groups = get_collection_groups()
        if group_name in groups:
            flash('Группа с таким именем уже существует', 'error')
        else:
            groups[group_name] = []  # Создаем новую группу с пустым списком коллекций
            save_collection_groups(groups)
            flash(f'Группа "{group_name}" успешно создана', 'success')
            logging.info(f'User {current_user.username} created group {group_name}')

        return redirect(url_for('index'))
    except Exception as e:
        logging.error(f"Error creating collection group: {str(e)}")
        flash(f'Ошибка при создании группы: {str(e)}', 'error')
        return redirect(url_for('index'))


@app.route('/move_photo_to_collection', methods=['POST'])
@login_required
def move_photo_to_collection():
    try:
        photo_path = request.form.get('photo_path')
        collection_name = request.form.get('collection_name')
        
        if not photo_path or not collection_name:
            return jsonify({'status': 'error', 'message': 'Не указаны необходимые параметры'}), 400
            
        user_folder = get_user_folder(current_user.id)
        source_path = os.path.join(user_folder, photo_path)
        target_folder = os.path.join(user_folder, 'collections', collection_name)
        
        if not os.path.exists(source_path):
            return jsonify({'status': 'error', 'message': 'Фото не найдено'}), 404
            
        os.makedirs(target_folder, exist_ok=True)
        target_path = os.path.join(target_folder, os.path.basename(photo_path))
        
        shutil.move(source_path, target_path)
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.error(f"Error in move_photo_to_collection: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/delete_collection', methods=['POST'])
def delete_collection():
    collection_name = request.form['collection_name']
    collection_path = os.path.join(app.config['COLLECTIONS_FOLDER'], collection_name)

    if not os.path.exists(collection_path):
        return {'status': 'error', 'message': 'Collection does not exist'}

    try:
        shutil.rmtree(collection_path)
        # Remove collection from its group
        collection_groups = get_collection_groups()
        for group_name, collection_names in collection_groups.items():
            if collection_name in collection_names:
                collection_names.remove(collection_name)
        save_collection_groups(collection_groups)
        return {'status': 'success'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


@app.route('/open_collection_folder', methods=['POST'])
def open_collection_folder():
    collection_name = request.form['collection_name']
    collection_path = os.path.join(app.config['COLLECTIONS_FOLDER'], collection_name)

    if not os.path.exists(collection_path):
        return {'status': 'error', 'message': 'Collection does not exist'}

    try:
        os.startfile(collection_path)
        return {'status': 'success'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

@app.route('/reload_all_photos')
def reload_all_photos():
    """Reloads all photos from the main folder into the temporary folder."""
    # Clear the temporary folder
    temp_folder = app.config['TEMP_FOLDER']
    for filename in os.listdir(temp_folder):
        file_path = os.path.join(temp_folder, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f'Failed to delete {file_path}. Reason: {e}')

    # Copy all photos from the upload folder to the temp folder
    upload_folder = app.config['UPLOAD_FOLDER']
    for filename in os.listdir(upload_folder):
        source_path = os.path.join(upload_folder, filename)
        dest_path = os.path.join(temp_folder, filename)
        try:
            shutil.copy2(source_path, dest_path)
        except Exception as e:
            print(f'Failed to copy {filename} to temp folder. Reason: {e}')

    flash('All photos reloaded successfully!', 'success')
    return redirect(url_for('index'))


@app.route('/remove_photo', methods=['POST'])
def remove_photo():
    photo_path = request.form['photo_path']

    if not os.path.exists(photo_path):
        return {'status': 'error', 'message': 'Photo does not exist'}

    try:
        os.remove(photo_path)
        return {'status': 'success'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


@app.route('/upload_file', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        flash('Файл не выбран', 'error')
        return redirect(request.url)
    
    file = request.files['file']
    if file.filename == '':
        flash('Файл не выбран', 'error')
        return redirect(request.url)
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        user_folder = get_user_folder(current_user.id)
        uploads_folder = os.path.join(user_folder, 'uploads')
        os.makedirs(uploads_folder, exist_ok=True)  # Создаем папку uploads если её нет
        file_path = os.path.join(uploads_folder, filename)
        file.save(file_path)
        logging.info(f'User {current_user.username} uploaded file {filename}')
        flash('Файл успешно загружен', 'success')
    else:
        flash('Недопустимый тип файла', 'error')
    
    return redirect(url_for('index'))


@app.route('/upload_directory', methods=['POST'])
def upload_directory():
    directory_path = request.form['directory']
    try:
        for filename in os.listdir(directory_path):
            filepath = os.path.join(directory_path, filename)
            if os.path.isfile(filepath) and allowed_file(filename):
                #Copies files to the main UPLOAD_FOLDER
                destination_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                shutil.copy2(filepath, destination_path)
        flash('Directory uploaded successfully', 'success')
    except Exception as e:
        flash(f'Error uploading directory: {e}', 'error')
    return redirect(url_for('index'))


@app.route('/uploads/<filename>')
@login_required
def send_file(filename: str):
    user_folder = get_user_folder(current_user.id)
    uploads_folder = os.path.join(user_folder, 'uploads')
    return send_from_directory(uploads_folder, filename)


@app.route('/collection_photos/<collection_name>/<filename>')
@login_required
def send_collection_photo(collection_name: str, filename: str):
    user_folder = get_user_folder(current_user.id)
    collection_path = os.path.join(user_folder, 'collections', collection_name)
    return send_from_directory(collection_path, filename)


@app.route('/get_photos')
@login_required
def get_photos_route():
    try:
        user_folder = get_user_folder(current_user.id)
        uploads_folder = os.path.join(user_folder, 'uploads')
        os.makedirs(uploads_folder, exist_ok=True)
        
        photos = get_photos_from_directory(uploads_folder)
        total_size = sum(os.path.getsize(photo['path']) for photo in photos)
        total_size_mb = round(total_size / (1024 * 1024), 2)
        
        return jsonify({
            'photos': photos,
            'total_count_left': len(photos),
            'total_size_left': total_size_mb,
            'average_width': 200  # Можно добавить расчет средней ширины
        })
    except Exception as e:
        logging.error(f"Error in get_photos_route: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/get_collection_photos/<collection_name>')
@login_required
def get_collection_photos(collection_name):
    try:
        user_folder = get_user_folder(current_user.id)
        collection_path = os.path.join(user_folder, 'collections', collection_name)
        
        if not os.path.exists(collection_path):
            return jsonify({'status': 'error', 'message': 'Коллекция не найдена'}), 404
            
        photos = get_photos_from_directory(collection_path)
        return jsonify({'status': 'success', 'photos': photos})
    except Exception as e:
        logging.error(f"Error in get_collection_photos: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


def get_user_folder(user_id):
    """Возвращает путь к папке пользователя"""
    return os.path.join(app.config['USER_FOLDERS'], str(user_id))

def create_user_folders(user_id):
    """Создает необходимые папки для пользователя"""
    user_folder = get_user_folder(user_id)
    os.makedirs(user_folder, exist_ok=True)
    os.makedirs(os.path.join(user_folder, 'uploads'), exist_ok=True)
    os.makedirs(os.path.join(user_folder, 'collections'), exist_ok=True)
    os.makedirs(os.path.join(user_folder, 'temp'), exist_ok=True)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        serial_number = request.form.get('serial_number')
        ip_address = request.remote_addr

        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        
        # Проверка существующего пользователя
        c.execute('SELECT id FROM users WHERE username = ?', (username,))
        if c.fetchone():
            flash('Пользователь с таким именем уже существует', 'error')
            conn.close()
            return redirect(url_for('register'))

        # Создание нового пользователя
        password_hash = generate_password_hash(password)
        c.execute('INSERT INTO users (username, password_hash, ip_address, serial_number) VALUES (?, ?, ?, ?)',
                 (username, password_hash, ip_address, serial_number))
        user_id = c.lastrowid
        conn.commit()
        conn.close()

        # Создание папок для пользователя
        create_user_folders(user_id)
        
        flash('Регистрация успешна! Теперь вы можете войти.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        ip_address = request.remote_addr

        conn = sqlite3.connect('users.db')
        c = conn.cursor()
        c.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
        user_data = c.fetchone()
        conn.close()

        if user_data and check_password_hash(user_data[1], password):
            user = User(user_data[0], username)
            login_user(user)
            logging.info(f'User {username} logged in from IP {ip_address}')
            return redirect(url_for('index'))
        
        flash('Неверное имя пользователя или пароль', 'error')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logging.info(f'User {current_user.username} logged out')
    logout_user()
    return redirect(url_for('login'))

@app.route('/collection_groups')
@login_required
def get_collection_groups_route():
    try:
        groups = get_collection_groups()
        return jsonify(groups)
    except Exception as e:
        logging.error(f"Error in get_collection_groups_route: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/collections')
@login_required
def get_collections_route():
    try:
        groups = get_collection_groups()
        collections = get_collections(groups)
        return jsonify({
            'status': 'success',
            'collections': collections,
            'groups': groups
        })
    except Exception as e:
        logging.error(f"Error in get_collections_route: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/delete_photo', methods=['DELETE'])
@login_required
def delete_photo():
    try:
        photo_path = request.args.get('photoPath')
        if not photo_path:
            return jsonify({'status': 'error', 'message': 'Не указан путь к фото'}), 400
            
        user_folder = get_user_folder(current_user.id)
        full_path = os.path.join(user_folder, photo_path)
        
        if not os.path.exists(full_path):
            return jsonify({'status': 'error', 'message': 'Фото не найдено'}), 404
            
        os.remove(full_path)
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.error(f"Error in delete_photo: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)