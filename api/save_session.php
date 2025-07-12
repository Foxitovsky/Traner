<?php
require_once 'config.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$username = $data['username'] ?? '';
$duration = $data['duration'] ?? 0;
$date = $data['date'] ?? date('Y-m-d H:i:s');

// Получаем ID пользователя
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $user = $result->fetch_assoc();
    $user_id = $user['id'];
    
    // Сохраняем тренировку
    $stmt = $conn->prepare("INSERT INTO workouts (user_id, duration, date) VALUES (?, ?, ?)");
    $stmt->bind_param("iis", $user_id, $duration, $date);
    
    if ($stmt->execute()) {
        // ОГРАНИЧИВАЕМ ИСТОРИЮ ТРЕНИРОВОК ДО 5 ЗАПИСЕЙ
        limitWorkoutHistory($conn, $user_id, 5);
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => $conn->error]);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'User not found']);
}
?>