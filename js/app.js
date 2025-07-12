// Элементы интерфейса
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const timer = document.getElementById('timer');
const phase = document.getElementById('phase');
const startStopBtn = document.getElementById('startStopBtn');
const pauseBtn = document.getElementById('pauseBtn');
const progressBar = document.getElementById('progressBar');
const historyDiv = document.getElementById('history');
const soundToggle = document.getElementById('soundToggle');
const logoutBtn = document.getElementById('logoutBtn');
const beepSound = document.getElementById('beepSound');
const phaseEndSound = document.getElementById('phaseEndSound');
const iosSoundAlert = document.getElementById('iosSoundAlert');

// Переменные состояния
let currentUser = localStorage.getItem('workoutUser') || null;
let timerInterval = null;
let isRunning = false;
let isPaused = false;
let currentPhase = 'ready';
let timeLeft = 60;
let totalWorkoutTime = 0;
let soundEnabled = true;
let pausedTimeLeft = 0;
let pauseStartTime = 0;
let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let audioContextInitialized = false;


// Фазы тренировки
const phases = {
    warmup: { duration: 60, name: 'Разминка', next: 'intense' },
    intense: { duration: 30, name: 'Интенсив', next: 'rest' },
    rest: { duration: 60, name: 'Отдых', next: 'intense' }
};

// Функция инициализации аудио для iOS
function initAudioForIOS() {
    if (!isIOS || audioContextInitialized) return;
    
    // Создаем и запускаем пустой аудиобуфер для разблокировки аудио
    const initAudio = () => {
        const context = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = context.createOscillator();
        oscillator.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
        audioContextInitialized = true;
    };
    
    // Показываем уведомление для пользователя
    iosSoundAlert.classList.remove('hidden');
    
    // Обработчики для первого касания
    const enableAudio = () => {
        initAudio();
        iosSoundAlert.classList.add('hidden');
        document.body.removeEventListener('click', enableAudio);
        document.body.removeEventListener('touchend', enableAudio);
    };
    
    document.body.addEventListener('click', enableAudio, { once: true });
    document.body.addEventListener('touchend', enableAudio, { once: true });
}

// Функция воспроизведения звука
function playSound(sound) {
    if (!soundEnabled) return;
    
    try {
        sound.currentTime = 0;
        const playPromise = sound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (isIOS && !audioContextInitialized) {
                    iosSoundAlert.classList.remove('hidden');
                    setTimeout(() => iosSoundAlert.classList.add('hidden'), 3000);
                }
                console.log('Ошибка воспроизведения:', error);
            });
        }
    } catch (error) {
        console.log('Ошибка воспроизведения:', error);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        loadHistory();
    }
    
    if (isIOS) {
        initAudioForIOS();
    }
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('js/sw.js')
            .then(registration => {
                console.log('ServiceWorker зарегистрирован');
            })
            .catch(err => {
                console.log('Ошибка регистрации ServiceWorker:', err);
            });
    }
});


// Переключение звука
soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
});

// Форма входа
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('api/login.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = username;
            localStorage.setItem('workoutUser', username);
            loginScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            loadHistory();
        } else {
            alert('Неверное имя пользователя или пароль');
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        alert('Ошибка соединения с сервером');
    }
});

// Кнопка выхода
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('workoutUser');
    currentUser = null;
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
});

// Кнопка старт/стоп
startStopBtn.addEventListener('click', async () => {
    if (!isRunning) {
        startWorkout();
        startStopBtn.textContent = 'Стоп';
        startStopBtn.classList.remove('start');
        startStopBtn.classList.add('stop', 'running');
        pauseBtn.classList.remove('hidden');
        pauseBtn.textContent = 'Пауза';
        isPaused = false;
    } else {
        stopWorkout();
        startStopBtn.textContent = 'Старт';
        startStopBtn.classList.remove('stop', 'running');
        startStopBtn.classList.add('start');
        pauseBtn.classList.add('hidden');
        isPaused = false;
        await saveSession();
    }
    isRunning = !isRunning;
});
// Кнопка паузы
pauseBtn.addEventListener('click', () => {
    if (isPaused) {
        // Продолжить тренировку
        isPaused = false;
        pauseBtn.textContent = 'Пауза';
        startStopBtn.classList.add('running');
        
        // Пересчет времени с учетом паузы
        const now = new Date().getTime();
        const pausedDuration = now - pauseStartTime;
        timeLeft = pausedTimeLeft;
        
        // Перезапуск таймера
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
    } else {
        // Поставить на паузу
        isPaused = true;
        pauseBtn.textContent = 'Продолжить';
        startStopBtn.classList.remove('running');
        clearInterval(timerInterval);
        
        // Сохраняем текущее время
        pausedTimeLeft = timeLeft;
        pauseStartTime = new Date().getTime();
    }
});

// Начало тренировки
function startWorkout() {
    currentPhase = 'warmup';
    timeLeft = phases.warmup.duration;
    phase.textContent = phases.warmup.name;
    totalWorkoutTime = 0;
    
    updateTimerDisplay();
    timerInterval = setInterval(updateTimer, 1000);
}

// Обновление таймера
function updateTimer() {
    if (isPaused) return;
    
    timeLeft--;
    totalWorkoutTime++;
    
    if (timeLeft === 3) {
        playSound(beepSound);
    }
    
    updateTimerDisplay();
    
    const phaseDuration = phases[currentPhase].duration;
    const progress = ((phaseDuration - timeLeft) / phaseDuration) * 100;
    progressBar.style.width = `${progress}%`;
    
    if (timeLeft <= 0) {
        playSound(phaseEndSound);
        nextPhase();
    }
}

// Обновление отображения таймера
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Следующая фаза
function nextPhase() {
    currentPhase = phases[currentPhase].next;
    timeLeft = phases[currentPhase].duration;
    phase.textContent = phases[currentPhase].name;
    progressBar.style.width = '0%';
}

// Остановка тренировки
function stopWorkout() {
    clearInterval(timerInterval);
    resetTimer();
}

// Сброс таймера
function resetTimer() {
    currentPhase = 'ready';
    timeLeft = phases.warmup.duration;
    phase.textContent = 'Готов к тренировке';
    timer.textContent = '01:00';
    progressBar.style.width = '0%';
}

// Сохранение сессии
async function saveSession() {
    if (!currentUser) return false;
    
    try {
        const response = await fetch('api/save_session.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: currentUser,
                duration: totalWorkoutTime,
                date: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadHistory();
            return true;
        } else {
            console.error('Ошибка сохранения:', data.error);
            return false;
        }
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        return false;
    }
}

// Загрузка истории тренировок
async function loadHistory() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`api/get_history.php?username=${currentUser}`);
        const data = await response.json();
        
        if (data.success && data.sessions) {
            displayHistory(data.sessions);
        } else {
            console.error('Ошибка загрузки:', data.error || 'Нет данных');
            historyDiv.innerHTML = '<p>Ошибка загрузки истории</p>';
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        historyDiv.innerHTML = '<p>Ошибка соединения с сервером</p>';
    }
}

// Отображение истории
function displayHistory(sessions) {
    if (!sessions || sessions.length === 0) {
        historyDiv.innerHTML = '<p>У вас пока нет завершенных тренировок</p>';
        return;
    }
    
    let html = '<h3>Последние тренировки:</h3><ol>';
    sessions.slice(0, 5).forEach(session => {
        const date = new Date(session.date).toLocaleString();
        const minutes = Math.floor(session.duration / 60);
        const seconds = session.duration % 60;
        html += `<li>${date} - ${minutes} мин ${seconds} сек</li>`;
    });
    html += '</ol>';
    
    historyDiv.innerHTML = html;
}

// Автоматическое обновление истории
setInterval(() => {
    if (currentUser) {
        loadHistory();
    }
}, 30000);