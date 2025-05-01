package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

var (
	activeServers = make(map[string]*exec.Cmd)
	serverMutex   sync.Mutex
)

type User struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Token   string `json:"token,omitempty"`
}

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}

func startLocalServer(username string) error {
	serverMutex.Lock()
	defer serverMutex.Unlock()

	// Проверяем, не запущен ли уже сервер для этого пользователя
	if cmd, exists := activeServers[username]; exists {
		if cmd.Process != nil {
			return nil // Сервер уже запущен
		}
	}

	// Создаем директорию для пользователя, если её нет
	userDir := filepath.Join("users", username)
	if err := os.MkdirAll(userDir, 0755); err != nil {
		return err
	}

	// Запускаем локальный сервер
	cmd := exec.Command("python", "app.py", "--user", username)
	cmd.Dir = userDir
	
	if err := cmd.Start(); err != nil {
		return err
	}

	// Сохраняем команду в мапу активных серверов
	activeServers[username] = cmd

	// Запускаем горутину для отслеживания состояния процесса
	go func() {
		cmd.Wait()
		serverMutex.Lock()
		delete(activeServers, username)
		serverMutex.Unlock()
	}()

	return nil
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		json.NewEncoder(w).Encode(AuthResponse{
			Success: false,
			Message: "Ошибка при разборе данных",
		})
		return
	}

	// TODO: Добавить проверку учетных данных в базе данных
	// Пока что используем тестовые данные
	if user.Username == "test" && user.Password == "test" {
		token := generateToken()
		
		// Запускаем локальный сервер для пользователя
		if err := startLocalServer(user.Username); err != nil {
			json.NewEncoder(w).Encode(AuthResponse{
				Success: false,
				Message: "Ошибка при запуске сервера",
			})
			return
		}

		json.NewEncoder(w).Encode(AuthResponse{
			Success: true,
			Message: "Успешный вход",
			Token:   token,
		})
	} else {
		json.NewEncoder(w).Encode(AuthResponse{
			Success: false,
			Message: "Неверные учетные данные",
		})
	}
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		json.NewEncoder(w).Encode(AuthResponse{
			Success: false,
			Message: "Ошибка при разборе данных",
		})
		return
	}

	// TODO: Добавить сохранение пользователя в базу данных
	// Пока что просто генерируем токен
	token := generateToken()

	// Запускаем локальный сервер для нового пользователя
	if err := startLocalServer(user.Username); err != nil {
		json.NewEncoder(w).Encode(AuthResponse{
			Success: false,
			Message: "Ошибка при запуске сервера",
		})
		return
	}

	json.NewEncoder(w).Encode(AuthResponse{
		Success: true,
		Message: "Успешная регистрация",
		Token:   token,
	})
}

func main() {
	// Создаем директорию для пользователей, если её нет
	if err := os.MkdirAll("users", 0755); err != nil {
		panic(err)
	}

	// Регистрируем обработчики
	http.HandleFunc("/api/login", handleLogin)
	http.HandleFunc("/api/register", handleRegister)

	// Запускаем сервер
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	server := &http.Server{
		Addr:         ":" + port,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		panic(err)
	}
} 