<?php
require_once 'config.php';

header('Content-Type: application/json');

$username = $_GET['username'] ?? '';

// Получаем ID пользователя
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $user = $result->fetch_assoc();
    $user_id = $user['id'];
    
    // Получаем 5 последних тренировок
    $stmt = $conn->prepare("SELECT duration, date FROM workouts WHERE user_id = ? ORDER BY date DESC LIMIT 5");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $sessions = [];
    while ($row = $result->fetch_assoc()) {
        $sessions[] = $row;
    }
    
    echo json_encode(['success' => true, 'sessions' => $sessions]);
} else {
    echo json_encode(['success' => false, 'error' => 'User not found']);
}
?>