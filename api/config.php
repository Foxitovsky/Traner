<?php
$db_host = 'localhost';
$db_user = 'cs06829_workouta'; // замените на вашего пользователя
$db_pass = 'Redapple23@'; // замените на ваш пароль
$db_name = 'cs06829_workouta';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Создаем таблицы, если их нет
$conn->query("CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
)");

$conn->query("CREATE TABLE IF NOT EXISTS workouts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    duration INT NOT NULL,
    date DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
)");

// Добавляем тестового пользователя admin:Qwerty1!
$stmt = $conn->prepare("INSERT IGNORE INTO users (username, password) VALUES (?, ?)");
$username = 'admin';
$password = password_hash('Qwerty1!', PASSWORD_DEFAULT);
$stmt->bind_param("ss", $username, $password);
$stmt->execute();
$stmt->close();

// Ограничиваем количество записей в истории
function limitWorkoutHistory($conn, $user_id, $limit = 5) {
    // Получаем общее количество тренировок пользователя
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM workouts WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $count = $result->fetch_assoc()['count'];
    
    // Если больше лимита, удаляем самые старые
    if ($count > $limit) {
        $stmt = $conn->prepare("DELETE FROM workouts WHERE user_id = ? AND id NOT IN (
            SELECT id FROM (
                SELECT id FROM workouts WHERE user_id = ? ORDER BY date DESC LIMIT ?
            ) as temp
        )");
        $stmt->bind_param("iii", $user_id, $user_id, $limit);
        $stmt->execute();
    }
}
?>