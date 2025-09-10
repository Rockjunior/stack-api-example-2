// Question Navigation System
let currentQuestionIndex = 0;
let questionBlocks = [];
let attemptedQuestions = new Set(); // Track which questions have been attempted
let allQuestionsAttempted = false;

// Question sequence definition
const questionSequence = [
  {
    title: "Simple question",
    qfile: "questions/Partial fraction decomposition.xml",
    qname: ""
  },
  {
    title: "Matrix input", 
    qfile: "questions/input-sample-questions.xml",
    qname: "Matrix"
  },
  {
    title: "Radio input",
    qfile: "questions/input-sample-questions.xml", 
    qname: "Radio"
  },
  {
    title: "Reveal block",
    qfile: "questions/Reveal_block_example.xml",
    qname: ""
  },
  {
    title: "Plot",
    qfile: "questions/Graphs of many to one functions.xml",
    qname: ""
  },
  {
    title: "JSXGraph", 
    qfile: "questions/JSXGraph-behat.xml",
    qname: ""
  },
  {
    title: "Parsons",
    qfile: "questions/Parsons-examples.xml",
    qname: "irrational-power-irrational (illustrates re-use of strings)"
  }
];

// Initialize navigation system
function initializeNavigation() {
    if (navigationInitialized) {
        console.log('⚠️ Navigation already initialized, skipping...');
        return;
    }
    
    console.log('🚀 Initializing navigation system...');
    
    // Check if questionSequence is available
    if (typeof questionSequence === 'undefined') {
        console.error('❌ questionSequence not found - navigation cannot initialize');
        return;
    }
    
    // Update total questions display
    document.getElementById('total-questions').textContent = questionSequence.length;
    
    // Load first question
    loadQuestion(0);
    
    // Update navigation buttons
    updateNavigationButtons();
    
    navigationInitialized = true;
    console.log('✅ Navigation system initialized successfully');
}

// Navigate to next/previous question
function navigateQuestion(direction) {
    console.log(`🧭 Navigating ${direction > 0 ? 'forward' : 'backward'}...`);
    
    const newIndex = currentQuestionIndex + direction;
    
    // Check if trying to go forward without attempting current question
    if (direction > 0 && !canProceedToNext()) {
        showAttemptWarning();
        return;
    }
    
    if (newIndex >= 0 && newIndex < questionSequence.length) {
        loadQuestion(newIndex);
        updateNavigationButtons();
    }
}

function canProceedToNext() {
    // If all questions have been attempted, allow free navigation
    if (allQuestionsAttempted) {
        return true;
    }
    
    // Check if current question has been attempted
    return attemptedQuestions.has(currentQuestionIndex);
}

function showAttemptWarning() {
    // Create or update warning message
    let warningDiv = document.getElementById('attempt-warning');
    if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.id = 'attempt-warning';
        warningDiv.className = 'attempt-warning';
        document.getElementById('navigation-controls').appendChild(warningDiv);
    }
    
    warningDiv.innerHTML = '⚠️ Please attempt the current question before proceeding to the next one.';
    warningDiv.style.display = 'block';
    
    // Hide warning after 3 seconds
    setTimeout(() => {
        warningDiv.style.display = 'none';
    }, 3000);
}

// Load a specific question by index
function loadQuestion(index) {
    console.log(`📝 Loading question ${index + 1}...`);
    
    if (index < 0 || index >= questionSequence.length) return;
    
    currentQuestionIndex = index;
    const question = questionSequence[index];
    
    // Update UI elements
    document.getElementById('current-question').textContent = index + 1;
    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-type').textContent = `Question Type: ${question.title}`;
    
    // Clear previous question content
    const questionContent = document.getElementById('question-content');
    questionContent.innerHTML = '';
    
    // Set new question attributes
    questionContent.setAttribute('data-qfile', question.qfile);
    if (question.qname) {
        questionContent.setAttribute('data-qname', question.qname);
    } else {
        questionContent.removeAttribute('data-qname');
    }
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Reinitialize the question system for the new question
    setTimeout(() => {
        console.log(`🔄 Reinitializing question system for: ${question.title}`);
        
        // Clear existing question blocks
        questionBlocks = [];
        
        // Reinitialize STACK system for the new question
        createQuestionBlocks();
        
        // Trigger MathJax rendering if available
        if (typeof MathJax !== 'undefined' && MathJax.Hub) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, questionContent]);
        }
        
        console.log(`✅ Question ${index + 1} loaded successfully`);
    }, 100);
}

// Update navigation button states
function updateNavigationButtons() {
    const prevButton = document.getElementById('prev-question');
    const nextButton = document.getElementById('next-question');
    
    if (prevButton && nextButton) {
        // Update button states
        prevButton.disabled = currentQuestionIndex === 0;
        
        // Next button logic: disabled if at last question OR if current question not attempted (unless all attempted)
        const isLastQuestion = currentQuestionIndex === questionSequence.length - 1;
        const canGoNext = allQuestionsAttempted || attemptedQuestions.has(currentQuestionIndex);
        nextButton.disabled = isLastQuestion || !canGoNext;
        
        // Update button labels with question titles
        if (currentQuestionIndex > 0) {
            prevButton.textContent = `← ${questionSequence[currentQuestionIndex - 1].title}`;
        } else {
            prevButton.textContent = '← Previous';
        }
        
        if (currentQuestionIndex < questionSequence.length - 1) {
            const nextTitle = questionSequence[currentQuestionIndex + 1].title;
            if (canGoNext) {
                nextButton.textContent = `${nextTitle} →`;
            } else {
                nextButton.textContent = `🔒 ${nextTitle} →`;
                nextButton.title = 'Complete current question to unlock';
            }
        } else {
            nextButton.textContent = 'Next →';
        }
    }
}

// Mark question as attempted when user submits an answer
function markQuestionAttempted(questionIndex = currentQuestionIndex) {
    console.log(`✅ Question ${questionIndex + 1} marked as attempted`);
    attemptedQuestions.add(questionIndex);
    
    // Check if all questions have been attempted
    if (attemptedQuestions.size === questionSequence.length) {
        allQuestionsAttempted = true;
        console.log('🎉 All questions have been attempted! Free navigation enabled.');
    }
    
    // Update navigation buttons to reflect new state
    updateNavigationButtons();
    
    // Hide any existing warning
    const warningDiv = document.getElementById('attempt-warning');
    if (warningDiv) {
        warningDiv.style.display = 'none';
    }
}

// Override the original createQuestionBlocks to work with single question
function createQuestionBlocks() {
    const questionContent = document.getElementById('question-content');
    questionBlocks = [questionContent]; // Single question block
    
    let i = 1; // Always use q1_ prefix for single question mode
    let questionPrefix = "q" + i.toString() + "_";
    var qfile = questionContent.dataset.qfile;
    var qname = questionContent.dataset.qname || "";
    
    questionContent.innerHTML = `
        <div class="collapsiblecontent" id="${questionPrefix}stack">
            <div class="vstack gap-3 ms-3 col-lg-8">
                <div id="${questionPrefix}errors"></div>
                <div id="${questionPrefix}stackapi_qtext" class="col-lg-8" style="display: none">
                    <div id="${questionPrefix}output" class="formulation"></div>
                    <div id="${questionPrefix}specificfeedback"></div>
                    <br>
                    <input type="button" class="btn btn-primary" value="Submit Answers"/>
                    <span id="${questionPrefix}stackapi_validity" style="color:darkred"></span>
                </div>
                <div id="${questionPrefix}stackapi_generalfeedback" class="col-lg-8" style="display: none">
                    <h2>General feedback:</h2>
                    <div id="${questionPrefix}generalfeedback" class="feedback"></div>
                </div>
                <h2 id="${questionPrefix}stackapi_score" style="display: none">Score: <span id="${questionPrefix}score"></span></h2>
                <div id="${questionPrefix}stackapi_summary" class="col-lg-10" style="display: none">
                    <h2>Response summary:</h2>
                    <div id="${questionPrefix}response_summary" class="feedback"></div>
                </div>
                <div id="${questionPrefix}stackapi_correct" class="col-lg-10" style="display: none">
                    <h2>Correct answers:</h2>
                    <div id="${questionPrefix}formatcorrectresponse" class="feedback"></div>
                </div>
                <div id="${questionPrefix}ai_feedback_section" class="col-lg-10" style="display: none">
                    <h2>🤖 AI Tutor Feedback:</h2>
                    <div id="${questionPrefix}ai_feedback" class="feedback ai-response"></div>
                </div>
            </div>
            <div id="${questionPrefix}newquestionbutton">
                <input type="button" onclick="send('${qfile}', '${qname}', '${questionPrefix}')" class="btn btn-primary" value="Show new example question"/>
            </div>
        </div>
    `;
    
    // Don't auto-initialize to prevent loops
}

// Prevent multiple initializations
let navigationInitialized = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (!navigationInitialized) {
        // Wait a bit for other scripts to load
        setTimeout(initializeNavigation, 500);
    }
});

// Also initialize when called from docHasLoaded
window.initializeNavigationSystem = function() {
    if (!navigationInitialized) {
        setTimeout(initializeNavigation, 100);
    }
};
