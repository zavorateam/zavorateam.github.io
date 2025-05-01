package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"

	"image"
	"image/color"
	_ "image/jpeg" // Import to register JPEG format
	"image/png"
	"math/rand"
	"os/exec"

	"github.com/gorilla/mux"
	"github.com/rs/cors" // Import the cors package
)

const (
	UPLOAD_FOLDER          = "../uploads"
	TEMP_FOLDER            = "../temp_uploads"
	COLLECTIONS_FOLDER     = "../collections"
	COLLECTION_GROUPS_FILE = "../collection_groups.txt"
	DEFAULT_PHOTO_HEIGHT   = 230
	PHOTOS_PER_PAGE        = 18
	FRONTEND_DIR           = "../frontend" // Directory containing frontend assets
	MAX_UPLOAD_SIZE_MB     = 100           // Maximum upload size in MB
)

var (
	ALLOWED_EXTENSIONS = map[string]bool{"png": true, "jpg": true, "jpeg": true, "gif": true}
)

// Photo struct to hold photo information
type Photo struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Tags []Tag  `json:"tags"`
}

// Tag struct to hold tag information
type Tag struct {
	Name string `json:"name"`
}

type CollectionGroup struct {
	Name string `json:"name"`
}

func main() {
	// Ensure directories exist
	os.MkdirAll(UPLOAD_FOLDER, os.ModeDir|0755)
	os.MkdirAll(TEMP_FOLDER, os.ModeDir|0755)
	os.MkdirAll(COLLECTIONS_FOLDER, os.ModeDir|0755)

	// Create some example images if no images exist
	files, err := os.ReadDir(UPLOAD_FOLDER)
	if err != nil {
		log.Fatalf("Failed to read directory: %v", err)
	}

	if len(files) == 0 {
		createExampleImage("example1.png")
		createExampleImage("example2.png")
		createExampleImage("example3.png")
	}

	router := mux.NewRouter()

	// API Endpoints
	router.HandleFunc("/photos", getPhotosHandler).Methods("GET")
	router.HandleFunc("/upload", uploadFileHandler).Methods("POST")
	router.HandleFunc("/upload_directory", uploadDirectoryHandler).Methods("POST") // Add this line
	router.HandleFunc("/delete_photo", deletePhotoHandler).Methods("DELETE")
	router.HandleFunc("/move_photo_to_collection", movePhotoToCollectionHandler).Methods("POST")
	router.HandleFunc("/get_collection_photos/{collectionName}", getCollectionPhotosHandler).Methods("GET")
	router.HandleFunc("/delete_collection", deleteCollectionHandler).Methods("POST")
	router.HandleFunc("/create_collection", createCollectionHandler).Methods("POST")
	router.HandleFunc("/create_collection_group", createCollectionGroupHandler).Methods("POST")
	router.HandleFunc("/collection_groups/handleRedirect", handleRedirect).Methods("GET")
	router.HandleFunc("/create_collection_group/handleRedirect", handleRedirect).Methods("GET")
	router.HandleFunc("/collection_groups", getCollectionGroupsHandler).Methods("GET")
	router.HandleFunc("/tags", getTagsHandler).Methods("GET")
	router.HandleFunc("/open_collection_folder", openCollectionFolderHandler).Methods("POST")

	// Serve static files (images)
	router.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir(UPLOAD_FOLDER))))

	// Serve frontend static files
	fs := http.FileServer(http.Dir(FRONTEND_DIR))
	router.PathPrefix("/").Handler(fs)

	// Configure CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5000"}, // Allow requests from your frontend
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: true,
	})

	handler := c.Handler(router)

	fmt.Println("Server listening on port 5000")
	log.Fatal(http.ListenAndServe(":5000", handler))
}

func allowedFile(filename string) bool {
	ext := filepath.Ext(filename)
	if len(ext) > 0 && ext[0] == '.' {
		ext = ext[1:]
	}
	_, ok := ALLOWED_EXTENSIONS[ext]
	return ok
}

func getPhotosHandler(w http.ResponseWriter, r *http.Request) {
	pageStr := r.URL.Query().Get("page")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	files, err := os.ReadDir(UPLOAD_FOLDER)
	if err != nil {
		http.Error(w, "Failed to read directory", http.StatusInternalServerError)
		return
	}

	imageFiles := []Photo{}
	for _, file := range files {
		if !file.IsDir() && allowedFile(file.Name()) {
			// Example tags for each photo - you should load this from a database or file
			exampleTags := []Tag{
				{Name: "exampleTag1"},
				{Name: "exampleTag2"},
			}
			imageFiles = append(imageFiles, Photo{Name: file.Name(), Path: filepath.Join("/uploads", file.Name()), Tags: exampleTags})
		}
	}

	start := (page - 1) * PHOTOS_PER_PAGE
	end := start + PHOTOS_PER_PAGE
	if end > len(imageFiles) {
		end = len(imageFiles)
	}

	paginatedFiles := imageFiles[start:end]

	// Calculate total size (dummy implementation)
	totalSizeLeft := float64(len(imageFiles)) * 0.5 //Example

	// Calculate average width (dummy implementation)
	averageWidth := 200

	response := map[string]interface{}{
		"photos":           paginatedFiles,
		"total_count_left": len(imageFiles),
		"total_size_left":  totalSizeLeft,
		"average_width":    averageWidth,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func uploadFileHandler(w http.ResponseWriter, r *http.Request) {
	// Set the maximum upload size limit
	r.Body = http.MaxBytesReader(w, r.Body, MAX_UPLOAD_SIZE_MB<<20)

	// Parse the multipart form with a size limit
	if err := r.ParseMultipartForm(MAX_UPLOAD_SIZE_MB << 20); err != nil {
		http.Error(w, "Error parsing multipart form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Error retrieving file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	if !allowedFile(handler.Filename) {
		http.Error(w, "Invalid file type", http.StatusBadRequest)
		return
	}

	filePath := filepath.Join(UPLOAD_FOLDER, handler.Filename)
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Error creating file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Error saving file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("File uploaded successfully"))
}

func uploadDirectoryHandler(w http.ResponseWriter, r *http.Request) {
	directoryPath := r.FormValue("directory")
	if directoryPath == "" {
		http.Error(w, "Missing directory parameter", http.StatusBadRequest)
		log.Println("uploadDirectoryHandler: Missing directory parameter") // Log the error
		return
	}

	log.Printf("uploadDirectoryHandler: Received directory path: %s\n", directoryPath)

	// Create a temporary zip file
	zipFilename := filepath.Join(TEMP_FOLDER, "temp_upload.zip")
	zipFile, err := os.Create(zipFilename)
	if err != nil {
		http.Error(w, "Error creating zip file: "+err.Error(), http.StatusInternalServerError)
		log.Printf("uploadDirectoryHandler: Error creating zip file: %v\n", err) // Log the error
		return
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	filepath.Walk(directoryPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("uploadDirectoryHandler: Error walking path %s: %v\n", path, err) // Log the error
			return err
		}

		// Skip directories
		if info.IsDir() {
			log.Printf("uploadDirectoryHandler: Skipping directory: %s\n", path) // Log skipping directory
			return nil
		}

		// Open the file
		file, err := os.Open(path)
		if err != nil {
			log.Printf("uploadDirectoryHandler: Error opening file %s: %v\n", path, err) // Log the error
			return err
		}
		defer file.Close()

		// Create a zip entry
		zipPath := strings.TrimPrefix(path, directoryPath)
		zipPath = strings.TrimPrefix(zipPath, "/")

		header := &zip.FileHeader{
			Name:   zipPath,
			Method: zip.Deflate,
		}
		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			log.Printf("uploadDirectoryHandler: Error creating zip header for %s: %v\n", path, err) // Log the error
			return err
		}

		// Copy the file data to the zip entry
		_, err = io.Copy(writer, file)
		if err != nil {
			log.Printf("uploadDirectoryHandler: Error copying data for %s: %v\n", path, err) // Log the error
			return err
		}

		log.Printf("uploadDirectoryHandler: Added file to zip: %s\n", path)
		return nil
	})

	// Make sure to close the zip writer *before* extracting
	err = zipWriter.Close()
	if err != nil {
		http.Error(w, "Error closing zip writer: "+err.Error(), http.StatusInternalServerError)
		log.Printf("uploadDirectoryHandler: Error closing zip writer: %v\n", err)
		return
	}

	// Extract the zip file
	err = extractZip(zipFilename, UPLOAD_FOLDER)
	if err != nil {
		http.Error(w, "Error extracting zip file: "+err.Error(), http.StatusInternalServerError)
		log.Printf("uploadDirectoryHandler: Error extracting zip file: %v\n", err) // Log the error
		return
	}

	// Clean up the temporary zip file
	os.Remove(zipFilename)

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Directory uploaded and extracted successfully"))
	log.Println("uploadDirectoryHandler: Directory uploaded and extracted successfully")
}

func extractZip(src, dest string) error {
	reader, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer reader.Close()

	for _, file := range reader.File {
		zippedFile, err := file.Open()
		if err != nil {
			return err
		}
		defer zippedFile.Close()

		// Construct the full file path
		destPath := filepath.Join(dest, file.Name)

		// Create directory if doesn't exist
		if file.FileInfo().IsDir() {
			os.MkdirAll(destPath, os.ModeDir|0755)
			continue
		}

		// Create parent directory
		if err = os.MkdirAll(filepath.Dir(destPath), os.ModeDir|0755); err != nil {
			return err
		}

		// Create the file
		newFile, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.FileInfo().Mode())
		if err != nil {
			return err
		}
		defer newFile.Close()

		// Copy the file contents
		if _, err = io.Copy(newFile, zippedFile); err != nil {
			return err
		}
	}
	return nil
}

func deletePhotoHandler(w http.ResponseWriter, r *http.Request) {
	photoPath := r.URL.Query().Get("photoPath")
	if photoPath == "" {
		http.Error(w, "Missing photoPath parameter", http.StatusBadRequest)
		log.Println("deletePhotoHandler: Missing photoPath parameter")
		return
	}

	// Prepend "../" to the photoPath
	photoPath = "../" + photoPath

	err := os.Remove(photoPath)
	if err != nil {
		http.Error(w, "Error deleting photo", http.StatusInternalServerError)
		log.Printf("deletePhotoHandler: Error deleting photo %s: %v\n", photoPath, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "message": "Photo deleted successfully"})
	log.Printf("deletePhotoHandler: Photo deleted successfully: %s\n", photoPath)
}

func movePhotoToCollectionHandler(w http.ResponseWriter, r *http.Request) {
	photoPath := r.FormValue("photo_path")
	collectionName := r.FormValue("collection_name")

	if photoPath == "" || collectionName == "" {
		http.Error(w, "Missing parameters", http.StatusBadRequest)
		return
	}

	collectionDir := filepath.Join(COLLECTIONS_FOLDER, collectionName)
	err := os.MkdirAll(collectionDir, os.ModeDir|0755)
	if err != nil {
		http.Error(w, "Error creating collection directory", http.StatusInternalServerError)
		return
	}

	photoName := filepath.Base(photoPath)
	newPhotoPath := filepath.Join(collectionDir, photoName)

	err = os.Rename(photoPath, newPhotoPath)
	if err != nil {
		http.Error(w, "Error moving photo to collection", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "message": "Photo moved successfully"})
}

func getCollectionPhotosHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	collectionName := vars["collectionName"]

	collectionDir := filepath.Join(COLLECTIONS_FOLDER, collectionName)
	files, err := os.ReadDir(collectionDir)
	if err != nil {
		http.Error(w, "Collection not found", http.StatusNotFound)
		return
	}

	var photos []Photo
	for _, file := range files {
		if !file.IsDir() && allowedFile(file.Name()) {
			photos = append(photos, Photo{Name: file.Name(), Path: filepath.Join(collectionDir, file.Name())})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "photos": photos})
}

func deleteCollectionHandler(w http.ResponseWriter, r *http.Request) {
	collectionName := r.FormValue("collection_name")

	collectionDir := filepath.Join(COLLECTIONS_FOLDER, collectionName)
	err := os.RemoveAll(collectionDir)
	if err != nil {
		http.Error(w, "Error deleting collection", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "message": "Collection deleted successfully"})
}

func createCollectionHandler(w http.ResponseWriter, r *http.Request) {
	collectionName := r.FormValue("collection_name")

	collectionDir := filepath.Join(COLLECTIONS_FOLDER, collectionName)
	err := os.MkdirAll(collectionDir, os.ModeDir|0755)
	if err != nil {
		http.Error(w, "Error creating collection", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "message": "Collection created successfully"})

	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func createCollectionGroupHandler(w http.ResponseWriter, r *http.Request) {
	groupName := r.FormValue("group_name")
	log.Printf("Creating collection group: %s\n", groupName)

	// Read existing collection groups
	groups := make(map[string][]string)
	file, err := os.OpenFile(COLLECTION_GROUPS_FILE, os.O_RDWR|os.O_CREATE, 0644)
	if err == nil {
		defer file.Close()
		decoder := json.NewDecoder(file)
		err = decoder.Decode(&groups)
		if err != nil && err != io.EOF {
			log.Printf("Error reading collection groups file: %v\n", err)
		}
	} else {
		log.Printf("Error opening collection groups file: %v\n", err)
	}

	// Add the new group
	groups[groupName] = []string{}

	// Write the updated collection groups back to the file
	file, err = os.Create(COLLECTION_GROUPS_FILE)
	if err != nil {
		http.Error(w, "Error creating collection groups file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	err = encoder.Encode(groups)
	if err != nil {
		http.Error(w, "Error writing to collection groups file", http.StatusInternalServerError)
		return
	}

	// Log success
	log.Printf("Successfully created collection group: %s\n", groupName)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "message": "Collection created successfully"})

	// Redirect to the main page
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func getCollectionGroupsHandler(w http.ResponseWriter, r *http.Request) {
	groups := make(map[string][]string)
	file, err := os.Open(COLLECTION_GROUPS_FILE)
	if err == nil {
		defer file.Close()
		decoder := json.NewDecoder(file)
		err = decoder.Decode(&groups)
		if err != nil && err != io.EOF {
			http.Error(w, "Error reading collection groups file", http.StatusInternalServerError)
			return
		}
	} else if os.IsNotExist(err) {
		// If the file doesn't exist, return an empty map
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(groups)
		return
	} else {
		http.Error(w, "Error opening collection groups file", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

func getTagsHandler(w http.ResponseWriter, r *http.Request) {
	// Example tags - you should load this from a database or file
	tags := []Tag{
		{Name: "tag1"},
		{Name: "tag2"},
		{Name: "tag3"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tags)
}

func handleRedirect(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func openCollectionFolderHandler(w http.ResponseWriter, r *http.Request) {
	collectionName := r.FormValue("collection_name")

	collectionDir := filepath.Join(COLLECTIONS_FOLDER, collectionName)
	// Replace with your platform's command to open a directory
	var cmd string
	switch os := runtime.GOOS; os {
	case "windows":
		cmd = "explorer"
	case "darwin":
		cmd = "open"
	case "linux":
		cmd = "xdg-open"
	default:
		http.Error(w, "Unsupported operating system", http.StatusInternalServerError)
		return
	}

	command := exec.Command(cmd, collectionDir)
	err := command.Start()
	if err != nil {
		http.Error(w, "Error opening directory", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "success", "message": "Collection folder opened successfully"})
}

func createExampleImage(filename string) {
	filePath := filepath.Join(UPLOAD_FOLDER, filename)
	_, err := os.Stat(filePath)
	if os.IsNotExist(err) {
		img := image.NewRGBA(image.Rect(0, 0, 200, 200))
		for y := 0; y < 200; y++ {
			for x := 0; x < 200; x++ {
				img.SetRGBA(x, y, color.RGBA{
					R: uint8(rand.Intn(256)),
					G: uint8(rand.Intn(256)),
					B: uint8(rand.Intn(256)),
					A: 255,
				})
			}
		}

		f, err := os.Create(filePath)
		if err != nil {
			log.Fatalf("Failed to create example image: %v", err)
		}
		defer f.Close()

		if err := png.Encode(f, img); err != nil {
			log.Fatalf("Failed to encode example image: %v", err)
		}
	}
}
