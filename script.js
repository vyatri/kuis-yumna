// Global state
let player = null;
let materials = [];
let currentMaterialId = null;
let currentMaterial = null;
let videoCompleted = false;
let quizSubmitted = false;

// Cookie helper functions
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

// Get material-specific cookie names
function getMaterialCookieName(materialId, suffix) {
    return `material_${materialId}_${suffix}`;
}

// Sidebar functions
function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const mainWrapper = document.querySelector('.main-wrapper');
    
    sidebar.classList.add('open');
    overlay.classList.add('show');
    mainWrapper.classList.add('sidebar-open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const mainWrapper = document.querySelector('.main-wrapper');
    
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    mainWrapper.classList.remove('sidebar-open');
}

// Load materials from JSON
async function loadMaterials() {
    try {
        const response = await fetch('./materials.json');
        materials = await response.json();
        
        if (materials.length === 0) {
            console.error('No materials found');
            return;
        }
        
        // Get current material ID from URL or cookie, default to first
        const urlParams = new URLSearchParams(window.location.search);
        const materialIdFromUrl = urlParams.get('id');
        const lastMaterialId = getCookie('last_material_id');
        
        currentMaterialId = materialIdFromUrl || lastMaterialId || materials[0].id;
        
        // Set current material
        currentMaterial = materials.find(m => m.id === currentMaterialId);
        if (!currentMaterial) {
            currentMaterial = materials[0];
            currentMaterialId = materials[0].id;
        }
        
        // Render sidebar
        renderSidebar();
        
        // Load material
        loadMaterial(currentMaterial);
    } catch (error) {
        console.error('Error loading materials:', error);
    }
}

// Render sidebar navigation
function renderSidebar() {
    const sidebarNav = document.getElementById('sidebar-nav');
    sidebarNav.innerHTML = '';
    
    materials.forEach(material => {
        const isCompleted = getCookie(getMaterialCookieName(material.id, 'quiz_completed')) === 'true';
        const isActive = material.id === currentMaterialId;
        
        const materialItem = document.createElement('div');
        materialItem.className = `material-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
        materialItem.onclick = () => switchMaterial(material.id);
        
        materialItem.innerHTML = `
            ${isCompleted ? '<span class="material-check">✓</span>' : '<span class="material-check" style="visibility: hidden;">✓</span>'}
            <span class="material-title">${material.id}: ${material.title}</span>
        `;
        
        sidebarNav.appendChild(materialItem);
    });
}

// Switch to different material
function switchMaterial(materialId) {
    if (materialId === currentMaterialId) {
        closeSidebar();
        return;
    }
    
    // Destroy current player if exists
    if (player) {
        player.destroy();
        player = null;
    }
    
    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('id', materialId);
    window.history.pushState({}, '', url);
    
    // Set current material
    currentMaterialId = materialId;
    currentMaterial = materials.find(m => m.id === materialId);
    
    // Save last material ID
    setCookie('last_material_id', materialId, 30);
    
    // Reset state
    videoCompleted = false;
    quizSubmitted = false;
    
    // Render sidebar with updated active state
    renderSidebar();
    
    // Load new material
    loadMaterial(currentMaterial);
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

// Load material
function loadMaterial(material) {
    if (!material) return;
    
    // Update header
    document.getElementById('material-title').textContent = `${material.id}: ${material.title}`;
    document.getElementById('material-description').innerHTML = material.description.replace(/\n/g, '<br />');
    
    // Check state
    const videoWatched = getCookie(getMaterialCookieName(material.id, 'video_completed')) === 'true';
    const quizCompleted = getCookie(getMaterialCookieName(material.id, 'quiz_completed')) === 'true';
    const savedAnswers = getCookie(getMaterialCookieName(material.id, 'quiz_answers'));
    
    // Reset UI
    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.getElementById('status-text');
    const quizSection = document.getElementById('quiz-section');
    
    statusIcon.textContent = '⏳';
    statusIcon.classList.remove('checked');
    statusText.textContent = 'Video belum selesai ditonton';
    statusText.style.color = '#6b7280';
    
    quizSection.classList.remove('show');
    document.getElementById('quiz-form').innerHTML = '';
    document.getElementById('quiz-results').innerHTML = '';
    document.getElementById('quiz-results').style.display = 'none';
    
    const quizHeader = document.querySelector('.quiz-header');
    const submitBtn = document.getElementById('submit-quiz');
    const quizForm = document.getElementById('quiz-form');
    
    if (quizHeader) quizHeader.style.display = 'block';
    if (submitBtn) submitBtn.style.display = 'block';
    if (quizForm) quizForm.style.display = 'block';
    
    // Initialize YouTube player
    const initCallback = () => {
        if (quizCompleted && savedAnswers) {
            // Quiz already completed, show results directly
            videoCompleted = true;
            statusIcon.textContent = '✅';
            statusIcon.classList.add('checked');
            statusText.textContent = 'Video selesai ditonton!';
            statusText.style.color = '#10b981';
            
            quizSection.classList.add('show');
            
            if (quizHeader) quizHeader.style.display = 'none';
            if (submitBtn) submitBtn.style.display = 'none';
            if (quizForm) quizForm.style.display = 'none';
            
            try {
                const userAnswers = JSON.parse(savedAnswers);
                displayResults(userAnswers, material);
            } catch (e) {
                console.error('Error parsing saved answers:', e);
            }
        } else if (videoWatched) {
            // Video watched but quiz not completed, show quiz form
            videoCompleted = true;
            statusIcon.textContent = '✅';
            statusIcon.classList.add('checked');
            statusText.textContent = 'Video selesai ditonton!';
            statusText.style.color = '#10b981';
            
            showQuizSection(material);
        }
    };
    
    initializePlayer(material.youtubeUrl, initCallback);
}

// Initialize YouTube Player
function initializePlayer(videoId, onReadyCallback) {
    // Wait for YouTube API to be ready
    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        // API will call onYouTubeIframeAPIReady when ready
        // Store callback to be called when API is ready
        const originalReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function() {
            if (originalReady) originalReady();
            createPlayer(videoId, onReadyCallback);
        };
        return;
    }
    
    // API is ready, create player immediately
    createPlayer(videoId, onReadyCallback);
}

function createPlayer(videoId, onReadyCallback) {
    const playerElement = document.getElementById('player');
    playerElement.innerHTML = ''; // Clear previous player
    
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onStateChange': onPlayerStateChange,
            'onReady': () => {
                console.log('Player ready');
                if (onReadyCallback) onReadyCallback();
            }
        }
    });
}

// Handle player state changes
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED && !videoCompleted) {
        videoCompleted = true;
        const materialId = currentMaterialId;
        setCookie(getMaterialCookieName(materialId, 'video_completed'), 'true', 30);
        showQuizSection(currentMaterial);
    }
}

// Show quiz section
function showQuizSection(material) {
    const quizSection = document.getElementById('quiz-section');
    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.getElementById('status-text');
    
    quizSection.classList.add('show');
    statusIcon.textContent = '✅';
    statusIcon.classList.add('checked');
    statusText.textContent = 'Video selesai ditonton!';
    statusText.style.color = '#10b981';
    
    // Check if user has previous score
    const previousScore = getCookie(getMaterialCookieName(material.id, 'quiz_score'));
    if (previousScore && !quizSubmitted) {
        showPreviousScore(parseInt(previousScore));
    }
    
    // Generate quiz questions
    generateQuiz(material);
    
    // Add submit button event listener
    const submitBtn = document.getElementById('submit-quiz');
    submitBtn.onclick = () => submitQuiz(material);
}

// Generate quiz questions
function generateQuiz(material) {
    const quizForm = document.getElementById('quiz-form');
    quizForm.innerHTML = '';
    
    material.questions.forEach((q, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        
        const questionNumber = index + 1;
        const questionLabel = document.createElement('label');
        questionLabel.className = 'question-label';
        questionLabel.textContent = `${questionNumber}. ${q.question}`;
        
        questionDiv.appendChild(questionLabel);
        
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options';
        
        const options = ['A', 'B', 'C', 'D', 'E'];
        q.options.forEach((option, optIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option';
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `question-${index}`;
            radio.id = `q${index}-${optIndex}`;
            radio.value = options[optIndex];
            
            const label = document.createElement('label');
            label.htmlFor = `q${index}-${optIndex}`;
            label.textContent = `${options[optIndex]}. ${option}`;
            
            optionDiv.appendChild(radio);
            optionDiv.appendChild(label);
            optionsDiv.appendChild(optionDiv);
        });
        
        questionDiv.appendChild(optionsDiv);
        quizForm.appendChild(questionDiv);
    });
}

// Submit quiz
function submitQuiz(material) {
    const form = document.getElementById('quiz-form');
    const results = document.getElementById('quiz-results');
    const submitBtn = document.getElementById('submit-quiz');
    const quizHeader = document.querySelector('.quiz-header');
    
    // Get all answers
    const userAnswers = [];
    let allAnswered = true;
    
    material.questions.forEach((q, index) => {
        const selected = form.querySelector(`input[name="question-${index}"]:checked`);
        if (selected) {
            userAnswers.push(selected.value);
        } else {
            userAnswers.push(null);
            allAnswered = false;
        }
    });
    
    if (!allAnswered) {
        alert('Mohon jawab semua soal sebelum menekan tombol Selesai!');
        return;
    }
    
    // Save answers to cookie
    const materialId = material.id;
    setCookie(getMaterialCookieName(materialId, 'quiz_answers'), JSON.stringify(userAnswers), 30);
    setCookie(getMaterialCookieName(materialId, 'quiz_completed'), 'true', 30);
    
    // Calculate and display results
    displayResults(userAnswers, material);
    
    // Update sidebar
    renderSidebar();
    
    // Hide quiz form
    submitBtn.style.display = 'none';
    quizHeader.style.display = 'none';
    
    // Scroll to results
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Display results
function displayResults(userAnswers, material) {
    const results = document.getElementById('quiz-results');
    const form = document.getElementById('quiz-form');
    const submitBtn = document.getElementById('submit-quiz');
    const quizHeader = document.querySelector('.quiz-header');
    
    // Calculate score
    let correctCount = 0;
    const totalQuestions = material.questions.length;
    
    userAnswers.forEach((answer, index) => {
        if (answer === material.answerKey[index]) {
            correctCount++;
        }
    });
    
    const score = Math.round((correctCount / totalQuestions) * 100);
    const materialId = material.id;
    
    // Save score to cookie
    setCookie(getMaterialCookieName(materialId, 'quiz_score'), score.toString(), 30);
    quizSubmitted = true;
    
    // Generate results HTML
    let resultsHTML = `
        <div class="results-header">
            <h3>Hasil Kuis Anda</h3>
            <div class="material-title-result">
                <span class="material-label">Materi:</span>
                <span class="material-name">${material.id}: ${material.title}</span>
            </div>
            <div class="score-display">
                <span class="score-label">Nilai:</span>
                <span class="score-value">${score}</span>
                <span class="score-max">/ 100</span>
            </div>
            <div class="score-breakdown">
                <span>Benar: ${correctCount}</span>
                <span>•</span>
                <span>Salah: ${totalQuestions - correctCount}</span>
                <span>•</span>
                <span>Total: ${totalQuestions}</span>
            </div>
        </div>
        <div class="answers-review">
            <h4>Review Jawaban</h4>
    `;
    
    material.questions.forEach((q, index) => {
        const userAnswer = userAnswers[index];
        const correctAnswer = material.answerKey[index];
        const isCorrect = userAnswer === correctAnswer;
        
        resultsHTML += `
            <div class="answer-item ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="answer-header">
                    <span class="question-number">Soal ${index + 1}:</span>
                    <span class="answer-status">
                        ${isCorrect ? '✓ Benar' : '✗ Salah'}
                    </span>
                </div>
                <div class="answer-content">
                    <p class="question-text">${q.question}</p>
                    <div class="answer-details">
                        <div class="answer-detail">
                            <span class="detail-label">Jawaban Anda:</span>
                            <span class="detail-value ${isCorrect ? 'correct' : 'incorrect'}">${userAnswer || 'Tidak dijawab'}</span>
                        </div>
                        ${!isCorrect ? `
                        <div class="answer-detail">
                            <span class="detail-label">Jawaban Benar:</span>
                            <span class="detail-value correct">${correctAnswer}</span>
                        </div>
                        ` : ''}
                        <div class="correct-answer-text">
                            ${correctAnswer}. ${q.options[correctAnswer.charCodeAt(0) - 65]}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    resultsHTML += `
            <div class="retake-section">
                <button id="retake-quiz" class="retake-button" type="button">
                    <span>🔄 Kerjakan Ulang</span>
                </button>
            </div>
        </div>
    `;
    
    results.innerHTML = resultsHTML;
    results.style.display = 'block';
    
    // Hide quiz form if visible
    if (submitBtn) submitBtn.style.display = 'none';
    if (quizHeader) quizHeader.style.display = 'none';
    if (form) form.style.display = 'none';
    
    // Add retake button event listener
    const retakeBtn = document.getElementById('retake-quiz');
    if (retakeBtn) {
        retakeBtn.onclick = () => retakeQuiz(material);
    }
}

// Show previous score in quiz header
function showPreviousScore(score) {
    const quizHeader = document.querySelector('.quiz-header p');
    if (quizHeader && !document.querySelector('.previous-score')) {
        const previousScoreDiv = document.createElement('div');
        previousScoreDiv.className = 'previous-score';
        previousScoreDiv.innerHTML = `
            <span class="previous-score-label">Nilai sebelumnya:</span>
            <span class="previous-score-value">${score}</span>
            <span class="previous-score-max">/ 100</span>
        `;
        quizHeader.parentNode.insertBefore(previousScoreDiv, quizHeader.nextSibling);
    }
}

// Retake quiz function
function retakeQuiz(material) {
    const form = document.getElementById('quiz-form');
    const results = document.getElementById('quiz-results');
    const submitBtn = document.getElementById('submit-quiz');
    const quizHeader = document.querySelector('.quiz-header');
    const materialId = material.id;
    
    // Delete quiz completion cookie
    deleteCookie(getMaterialCookieName(materialId, 'quiz_completed'));
    deleteCookie(getMaterialCookieName(materialId, 'quiz_answers'));
    
    // Reset form if exists
    if (form) {
        form.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.checked = false;
        });
        form.style.display = 'block';
    }
    
    // Hide results and show quiz
    if (results) {
        results.style.display = 'none';
        results.innerHTML = '';
    }
    if (submitBtn) submitBtn.style.display = 'block';
    if (quizHeader) quizHeader.style.display = 'block';
    
    // Remove previous score display if exists
    const previousScoreDiv = document.querySelector('.previous-score');
    if (previousScoreDiv) {
        previousScoreDiv.remove();
    }
    
    // Generate quiz form if not exists or empty
    if (!form || form.innerHTML === '') {
        generateQuiz(material);
    }
    
    // Update sidebar
    renderSidebar();
    
    quizSubmitted = false;
    
    // Scroll to quiz
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        const quizSection = document.getElementById('quiz-section');
        if (quizSection) {
            quizSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

// Global YouTube API ready handler
window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube API ready');
    // If materials are already loaded, initialize player for current material
    if (currentMaterial && !player) {
        initializePlayer(currentMaterial.youtubeUrl, () => {
            const materialId = currentMaterial.id;
            const videoWatched = getCookie(getMaterialCookieName(materialId, 'video_completed')) === 'true';
            const quizCompleted = getCookie(getMaterialCookieName(materialId, 'quiz_completed')) === 'true';
            const savedAnswers = getCookie(getMaterialCookieName(materialId, 'quiz_answers'));
            
            if (quizCompleted && savedAnswers) {
                // Quiz already completed, show results directly
                videoCompleted = true;
                const statusIcon = document.querySelector('.status-icon');
                const statusText = document.getElementById('status-text');
                const quizSection = document.getElementById('quiz-section');
                
                if (statusIcon && statusText) {
                    statusIcon.textContent = '✅';
                    statusIcon.classList.add('checked');
                    statusText.textContent = 'Video selesai ditonton!';
                    statusText.style.color = '#10b981';
                }
                
                if (quizSection) {
                    quizSection.classList.add('show');
                    const quizHeader = document.querySelector('.quiz-header');
                    const submitBtn = document.getElementById('submit-quiz');
                    const quizForm = document.getElementById('quiz-form');
                    if (quizHeader) quizHeader.style.display = 'none';
                    if (submitBtn) submitBtn.style.display = 'none';
                    if (quizForm) quizForm.style.display = 'none';
                    
                    try {
                        const userAnswers = JSON.parse(savedAnswers);
                        displayResults(userAnswers, currentMaterial);
                    } catch (e) {
                        console.error('Error parsing saved answers:', e);
                    }
                }
            } else if (videoWatched) {
                // Video watched but quiz not completed, show quiz form
                videoCompleted = true;
                const statusIcon = document.querySelector('.status-icon');
                const statusText = document.getElementById('status-text');
                if (statusIcon && statusText) {
                    statusIcon.textContent = '✅';
                    statusIcon.classList.add('checked');
                    statusText.textContent = 'Video selesai ditonton!';
                    statusText.style.color = '#10b981';
                }
                showQuizSection(currentMaterial);
            }
        });
    }
};

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // Sidebar event listeners
    document.getElementById('open-sidebar').onclick = openSidebar;
    document.getElementById('close-sidebar').onclick = closeSidebar;
    document.getElementById('sidebar-overlay').onclick = closeSidebar;
    
    // Load materials
    loadMaterials();
});
