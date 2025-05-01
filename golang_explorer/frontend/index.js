document.addEventListener('DOMContentLoaded', function() {
    let averageWidth;

    // Function to fetch photos and related data
    function loadPhotos() {
        fetch('/photos')
            .then(response => response.json())
            .then(data => {
                if (data && Array.isArray(data.photos)) {
                    const photoList = document.getElementById('photo-list');
                    photoList.innerHTML = ''; // Clear existing photos

                    data.photos.forEach(photo => {
                        const photoTile = document.createElement('div');
                        photoTile.classList.add('photo-tile', 'draggable');
                        photoTile.dataset.photoPath = photo.path;
                        photoTile.style.backgroundImage = `url('/uploads/${photo.name}')`;
                        photoTile.style.width = `${data.average_width}px`;
                        photoTile.style.height = '210px';
                        photoTile.draggable = true; // Make it draggable
                        photoTile.innerHTML = `
              <i class="fas fa-arrows-alt drag-handle"></i>
              <i class="fas fa-trash delete-button" style="position: absolute; top: 17px; right: 17px; cursor: pointer; color: red; z-index: 3;"></i>
            `;
                        photoList.appendChild(photoTile);
                    });

                    // Update total counts and sizes
                    document.getElementById('total-count-left').textContent = data.total_count_left;
                    document.getElementById('total-size-left').textContent = data.total_size_left + ' MB';
                    averageWidth = data.average_width; // Assign averageWidth

                    // Initialize drag and drop
                    initializeDragAndDrop();

                    // Add event listeners to delete buttons after they are created
                    addDeleteButtonEventListeners();

                    // Attach event listeners to collection elements
                    attachCollectionEventListeners();

                    // Attach double click listeners to photo tiles
                    attachDoubleClickListeners();
                  // Load collection groups after loading photos
                    loadCollectionGroups();
                } else {
                    console.error('Error loading photos:', data);
                }
            })
            .catch(error => {
                console.error('Error fetching photos:', error);
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
        const draggables = document.querySelectorAll('.draggable');
        const droppables = document.querySelectorAll('.droppable');

        draggables.forEach(draggable => {
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
        draggedItem = event.target; // Store the dragged element
        event.dataTransfer.setData('text/plain', event.target.dataset.photoPath); // Store photoPath
        event.target.classList.add('dragging');
    }

    function dragEnd(event) {
        event.target.classList.remove('dragging');
    }

    function dragEnter(event) {
        event.preventDefault();
        if (event.target.classList.contains('droppable')) {
            event.target.classList.add('drag-over');
        }
    }

    function dragOver(event) {
        event.preventDefault(); // Necessary to allow the drop
        if (event.target.classList.contains('droppable')) {
            event.target.classList.add('drag-over');
        }
    }

    function dragLeave(event) {
        if (event.target.classList.contains('droppable')) {
            event.target.classList.remove('drag-over');
        }
    }

    function drop(event) {
        event.preventDefault(); // Prevent default browser behavior
        if (event.target.classList.contains('droppable')) {
            event.target.classList.remove('drag-over');
            const photoPath = event.dataTransfer.getData('text/plain'); // Get photoPath

            const collectionName = event.target.dataset.collectionName;

            movePhotoToCollection(photoPath, collectionName);
        }
    }

    function movePhotoToCollection(photoPath, collectionName) {
        // AJAX request to move photo to the collection
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
                    const message = `Фото успешно добавлено в коллекцию ${collectionName}`;
                    alert(message); // Inform user of success
                    location.reload();
                } else {
                    alert("Ошибка при перемещении фото: " + data.message); // Alert user of error
                }
            })
            .catch(error => {
                alert("Произошла ошибка при отправке запроса."); // Alert user of AJAX failure
                console.error(error); // Log error to console
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
            .then(response => response.json())
            .then(data => {
                if (data && data.status === 'success' && data.photos) {
                    const photos = data.photos;
                    if (photos.length > 0) {
                        photos.forEach(photo => {
                            const img = document.createElement('img');
                            img.src = `/uploads/${photo.name}`;
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
            .then(response => response.json())
            .then(groups => {
                const selectElement = document.getElementById('group_name');
                selectElement.innerHTML = '<option value="">Без группы</option>'; // Clear existing options

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

    // Load photos on page load
    loadPhotos();

    // Attach event listeners to collection elements
    attachCollectionEventListeners();
    // Attach double click listeners to photo tiles
    attachDoubleClickListeners();

});