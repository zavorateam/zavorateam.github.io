document.addEventListener('DOMContentLoaded', function() {
    let averageWidth;

    // Function to fetch photos and related data
    function loadPhotos() {
        fetch('/get_photos')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('Received photos data:', data);
                if (data && Array.isArray(data.photos)) {
                    const photoList = document.getElementById('photo-list');
                    photoList.innerHTML = ''; // Clear existing photos

                    data.photos.forEach(photo => {
                        const photoTile = document.createElement('div');
                        photoTile.classList.add('photo-tile', 'draggable');
                        photoTile.dataset.photoPath = photo.path;
                        
                        if (photo.name) {
                            photoTile.style.backgroundImage = `url('/uploads/${photo.name}')`;
                        } else {
                            console.error('Photo name is missing:', photo);
                            return;
                        }
                        
                        photoTile.style.width = `${data.average_width || 200}px`;
                        photoTile.style.height = '210px';
                        photoTile.draggable = true;
                        photoTile.innerHTML = `
                            <i class="fas fa-arrows-alt drag-handle"></i>
                            <i class="fas fa-trash delete-button" style="position: absolute; top: 17px; right: 17px; cursor: pointer; color: red; z-index: 3;"></i>
                        `;
                        photoList.appendChild(photoTile);
                    });

                    // Update total counts and sizes
                    document.getElementById('total-count-left').textContent = data.total_count_left || 0;
                    document.getElementById('total-size-left').textContent = (data.total_size_left || 0) + ' MB';
                    averageWidth = data.average_width || 200;

                    // Initialize drag and drop
                    initializeDragAndDrop();
                    addDeleteButtonEventListeners();
                    attachCollectionEventListeners();
                    attachDoubleClickListeners();
                    loadCollectionGroups();
                    loadCollections();
                } else {
                    console.error('Invalid photos data format:', data);
                }
            })
            .catch(error => {
                console.error('Error fetching photos:', error);
                alert('Ошибка при загрузке фотографий. Пожалуйста, попробуйте перезагрузить страницу.');
            });
    }

    function addDeleteButtonEventListeners() {
        const deleteButtons = document.querySelectorAll('.delete-button');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                const photoTile = this.closest('.photo-tile');
                const photoPath = photoTile.dataset.photoPath;
                deletePhoto(photoPath, photoTile);
            });
        });
    }

    function deletePhoto(photoPath, photoTile) {
        if (confirm('Вы уверены, что хотите удалить это фото?')) {
            fetch(`/delete_photo?photoPath=${photoPath}`, {
                method: 'DELETE'
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert('Фото удалено!');
                        photoTile.remove();
                    } else {
                        alert('Ошибка при удалении фото: ' + data.message);
                    }
                })
                .catch(error => {
                    alert('Произошла ошибка при отправке запроса.');
                    console.error(error);
                });
        }
    }

    // DRAG AND DROP!!!
    let draggedItem = null; // Store the dragged item

    function initializeDragAndDrop() {
        const draggables = document.querySelectorAll('.photo-tile');
        const droppables = document.querySelectorAll('.collection');

        draggables.forEach(draggable => {
            draggable.setAttribute('draggable', 'true');
            draggable.addEventListener('dragstart', dragStart);
            draggable.addEventListener('dragend', dragEnd);
        });

        droppables.forEach(droppable => {
            droppable.addEventListener('dragenter', dragEnter);
            droppable.addEventListener('dragover', dragOver);
            droppable.addEventListener('dragleave', dragLeave);
            droppable.addEventListener('drop', drop);
        });
    }

    function dragStart(event) {
        draggedItem = event.target;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', event.target.dataset.photoPath);
        event.target.classList.add('dragging');
        event.target.style.opacity = '0.5';
        
        // Создаем прозрачный клон для перетаскивания
        const clone = event.target.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.top = '-9999px';
        clone.style.width = event.target.offsetWidth + 'px';
        clone.style.height = event.target.offsetHeight + 'px';
        document.body.appendChild(clone);
        event.dataTransfer.setDragImage(clone, event.target.offsetWidth / 2, event.target.offsetHeight / 2);
        setTimeout(() => document.body.removeChild(clone), 0);
    }

    function dragEnd(event) {
        event.target.classList.remove('dragging');
        event.target.style.opacity = '1';
        event.target.style.transform = '';
    }

    function dragEnter(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.target.classList.contains('collection')) {
            event.target.classList.add('drag-over');
        }
    }

    function dragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        if (event.target.classList.contains('collection')) {
            event.target.classList.add('drag-over');
        }
    }

    function dragLeave(event) {
        event.stopPropagation();
        if (event.target.classList.contains('collection')) {
            event.target.classList.remove('drag-over');
        }
    }

    function drop(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.target.classList.contains('collection')) {
            event.target.classList.remove('drag-over');
            const photoPath = event.dataTransfer.getData('text/plain');
            const collectionName = event.target.dataset.collectionName;
            
            if (photoPath && collectionName) {
                movePhotoToCollection(photoPath, collectionName);
            }
        }
    }

    function movePhotoToCollection(photoPath, collectionName) {
        fetch("/move_photo_to_collection", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `photo_path=${encodeURIComponent(photoPath)}&collection_name=${encodeURIComponent(collectionName)}`
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(`Фото успешно добавлено в коллекцию ${collectionName}`);
                location.reload();
            } else {
                alert("Ошибка при перемещении фото: " + data.message);
            }
        })
        .catch(error => {
            alert("Произошла ошибка при отправке запроса.");
            console.error(error);
        });
    }

    function openCollectionModal(collectionName) {
        const modal = document.getElementById('collectionModal');
        const modalTitle = document.getElementById('modal-title');
        const modalPhotos = document.getElementById('modal-photos');

        modalTitle.textContent = collectionName;
        modal.dataset.collectionName = collectionName;

        modalPhotos.innerHTML = ''; // Clear existing photos

        fetch(`/get_collection_photos/${collectionName}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data && data.status === 'success' && data.photos) {
                    const photos = data.photos;
                    if (photos.length > 0) {
                        photos.forEach(photo => {
                            const img = document.createElement('img');
                            img.src = `/collection_photos/${collectionName}/${photo.name}`;
                            img.alt = photo.name;
                            modalPhotos.appendChild(img);
                        });
                    } else {
                        modalPhotos.innerHTML = "<p>В коллекции пока нет фотографий.</p>";
                    }
                } else {
                    modalPhotos.innerHTML = "<p>Не удалось загрузить фотографии коллекции.</p>";
                    console.error("Ошибка при загрузке фотографий коллекции:", data);
                }
            })
            .catch(error => {
                modalPhotos.innerHTML = "<p>Ошибка при загрузке фотографий коллекции.</p>";
                console.error("AJAX error:", error);
            });

        modal.style.display = 'block';
    }

    // Attach event listeners to collection elements
    function attachCollectionEventListeners() {
        const collectionElements = document.querySelectorAll('.collection');
        collectionElements.forEach(collection => {
            collection.addEventListener('click', function() {
                const collectionName = this.dataset.collectionName;
                openCollectionModal(collectionName);
            });
        });
    }

        // Attach double click listeners to photo tiles
    function attachDoubleClickListeners() {
        const photoTiles = document.querySelectorAll('.photo-tile');
        photoTiles.forEach(photoTile => {
            photoTile.addEventListener('dblclick', function() {
                const photoPath = this.dataset.photoPath;
                deletePhoto(photoPath, this);
            });
        });
    }
    function loadCollectionGroups() {
        fetch('/collection_groups')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(groups => {
                const selectElement = document.getElementById('collection_group');
                selectElement.innerHTML = '<option value="">Без группы</option>';

                for (const groupName in groups) {
                    if (groups.hasOwnProperty(groupName)) {
                        const option = document.createElement('option');
                        option.value = groupName;
                        option.textContent = groupName;
                        selectElement.appendChild(option);
                    }
                }
            })
            .catch(error => {
                console.error('Error loading collection groups:', error);
                alert('Ошибка при загрузке групп коллекций. Пожалуйста, попробуйте перезагрузить страницу.');
            });
    }
    // Function to close the collection modal
    document.querySelector(".close").addEventListener('click', function() {
        document.getElementById("collectionModal").style.display = 'none';
    });

    // Function to delete the collection
    window.deleteCollection = function() {
        const collectionName = document.getElementById("collectionModal").dataset.collectionName;

        if (confirm("Вы уверены, что хотите удалить коллекцию '" + collectionName + "'?")) {
            fetch("/delete_collection", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `collection_name=${encodeURIComponent(collectionName)}`
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        alert("Коллекция удалена!");
                        location.reload();
                    } else {
                        alert("Ошибка при удалении коллекции: " + data.message);
                    }
                })
                .catch(error => {
                    alert("Произошла ошибка при отправке запроса.");
                    console.error(error);
                });
        }
    }
        // Keydown event listener for Shift+V
    document.addEventListener('keydown', function(event) {
        if (event.shiftKey && event.key === 'V') {
            location.reload();
        }
    });

    async function createCollection() {
        const collectionName = document.getElementById('collection_name').value;
        const groupName = document.getElementById('collection_group').value;

        try {
            const formData = new FormData();
            formData.append('collection_name', collectionName);
            if (groupName) {
                formData.append('group_name', groupName);
            }

            const response = await fetch('/create_collection', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                // Закрываем модальное окно
                const modal = document.getElementById('createCollectionModal');
                modal.style.display = 'none';
                
                // Обновляем список коллекций
                await loadCollections();
                
                // Показываем уведомление
                showNotification(data.message, 'success');
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Ошибка при создании коллекции', 'error');
        }
    }

    async function loadCollections() {
        try {
            const response = await fetch('/get_collections');
            const data = await response.json();
            
            if (data.status === 'success') {
                const collectionsContainer = document.getElementById('collections-container');
                collectionsContainer.innerHTML = '';
                
                // Группируем коллекции по группам
                const groupedCollections = {};
                data.collections.forEach(collection => {
                    const group = collection.group || 'Без группы';
                    if (!groupedCollections[group]) {
                        groupedCollections[group] = [];
                    }
                    groupedCollections[group].push(collection);
                });
                
                // Создаем элементы для каждой группы
                for (const [groupName, collections] of Object.entries(groupedCollections)) {
                    const groupElement = document.createElement('div');
                    groupElement.className = 'collection-group';
                    groupElement.innerHTML = `
                        <h3>${groupName}</h3>
                        <div class="collections-grid">
                            ${collections.map(collection => `
                                <div class="collection-item" onclick="openCollection('${collection.name}')">
                                    <div class="collection-info">
                                        <h4>${collection.name}</h4>
                                        <p>${collection.count} фото</p>
                                        <p>${collection.size}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                    collectionsContainer.appendChild(groupElement);
                }
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Ошибка при загрузке коллекций', 'error');
        }
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Load photos on page load
    loadPhotos();

    // Attach event listeners to collection elements
    attachCollectionEventListeners();
    // Attach double click listeners to photo tiles
    attachDoubleClickListeners();

});