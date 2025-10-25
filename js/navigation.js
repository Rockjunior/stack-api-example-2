// Question Navigation System
let currentQuestionIndex = 0;
let questionBlocks = [];
let attemptedQuestions = new Set(); // Track which questions have been attempted
let allQuestionsAttempted = false;
let questionResults = new Map(); // Track pass/fail results for each question
let adaptiveMode = false; // Track if we're in adaptive remediation mode

// Question sequence definition with remediation support
const questionSequence = [
  {
    title: "Systems of Linear Equations: Row reduction",
    qfile: "questions/Basic-Maths-System-of-Equations-with-No-Solution.xml",
    qname: "",
    topic: "systems_of_linear_equations",
    difficulty: "basic",
  },
  {
    title: "Matrix: Question 1",
    qfile:"questions/Finding the reduced row echelon form of a 4_4 matrix-question2.xml",
    qname: "",
    topic: "systems_of_linear_equations",
    difficulty: "basic",
  },
  {
    title: "Matrix: Question 2",
    qfile: "questions/Finding the reduced row echelon form of a 4_4 matrix.xml",
    qname: "",
    topic: "systems_of_linear_equations",
    difficulty: "intermediate",
  },
  {
    title: "Matrix: Question 3",
    qfile: "questions/For what values of k does system have no solutions.xml",
    qname: "",
    topic: "systems_of_linear_equations",
    difficulty: "intermediate",
  },
  {
    title: "Matrix: Question 4",
    qfile:
      "questions/Reduced Row Echelon Form from a set of matrices-question2.xml",
    qname: "",
    topic: "systems_of_linear_equations",
    difficulty: "advanced",
  },
  {
    title: "Matrix: Question 5",
    qfile: "questions/Reduced Row Echelon Form.xml",
    qname: "",
    topic: "systems_of_linear_equations",
    difficulty: "advanced",
  },
  {
    title: "Matrix: Question 6",
    qfile: "questions/Indicating the argument used in the proof.xml",
    qname: "",
    topic: "systems_of_linear_equations",
    difficulty: "advanced",
  },
];

// Initialize navigation system
function initializeNavigation() {
  if (navigationInitialized) {
    console.log("⚠️ Navigation already initialized, skipping...");
    return;
  }

  console.log("🚀 Initializing navigation system...");

  // Check if questionSequence is available
  if (typeof questionSequence === "undefined") {
    console.error(
      "❌ questionSequence not found - navigation cannot initialize"
    );
    return;
  }

  // Update total questions display
  document.getElementById("total-questions").textContent =
    questionSequence.length;

  // Load first question
  loadQuestion(0);

  // Update navigation buttons
  updateNavigationButtons();

  navigationInitialized = true;
  console.log("✅ Navigation system initialized successfully");
}

// Navigate to next/previous question
function navigateQuestion(direction) {
  console.log(`🧭 Navigating ${direction > 0 ? "forward" : "backward"}...`);

  let newIndex;

  if (direction > 0) {
    // Check if trying to go forward without attempting current question
    if (!canProceedToNext()) {
      showAttemptWarning();
      return;
    }

    // Use smart next question selection for forward navigation
    newIndex = getNextQuestionIndex();

    // Show adaptive mode indicator
    if (adaptiveMode) {
      showAdaptiveModeMessage();
    }
  } else {
    // Backward navigation - normal sequential
    newIndex = currentQuestionIndex + direction;
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
  let warningDiv = document.getElementById("attempt-warning");
  if (!warningDiv) {
    warningDiv = document.createElement("div");
    warningDiv.id = "attempt-warning";
    warningDiv.className = "attempt-warning";
    document.getElementById("navigation-controls").appendChild(warningDiv);
  }

  warningDiv.innerHTML =
    "⚠️ Please attempt the current question before proceeding to the next one.";
  warningDiv.style.display = "block";

  // Hide warning after 3 seconds
  setTimeout(() => {
    warningDiv.style.display = "none";
  }, 3000);
}

// Load a specific question by index
function loadQuestion(index) {
  console.log(`📝 Loading question ${index + 1}...`);

  if (index < 0 || index >= questionSequence.length) return;

  currentQuestionIndex = index;
  const question = questionSequence[index];

  // Update UI elements
  document.getElementById("current-question").textContent = index + 1;
  document.getElementById("question-title").textContent = question.title;
  document.getElementById(
    "question-type"
  ).textContent = `Question Type: ${question.title}`;

  // Clear previous question content
  const questionContent = document.getElementById("question-content");
  questionContent.innerHTML = "";

  // Set new question attributes
  questionContent.setAttribute("data-qfile", question.qfile);
  if (question.qname) {
    questionContent.setAttribute("data-qname", question.qname);
  } else {
    questionContent.removeAttribute("data-qname");
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

    // Trigger MathJax re-rendering after question loads
    setTimeout(() => {
      if (typeof MathJax !== "undefined" && MathJax.Hub) {
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, questionContent]);
      }

      // Note: "Show new example question" button will be disabled when clicked, not on load

      console.log(`✅ Question ${index + 1} loaded successfully`);
    }, 100);
  }, 100);
}

// Update navigation button states
function updateNavigationButtons() {
  const prevButton = document.getElementById("prev-question");
  const nextButton = document.getElementById("next-question");

  if (prevButton && nextButton) {
    // Update button states
    prevButton.disabled = currentQuestionIndex === 0;

    // Next button logic: disabled if at last question OR if current question not attempted (unless all attempted)
    const isLastQuestion = currentQuestionIndex === questionSequence.length - 1;
    const canGoNext =
      allQuestionsAttempted || attemptedQuestions.has(currentQuestionIndex);
    nextButton.disabled = isLastQuestion || !canGoNext;

    // Update button labels with question titles
    if (currentQuestionIndex > 0) {
      prevButton.textContent = `← ${
        questionSequence[currentQuestionIndex - 1].title
      }`;
    } else {
      prevButton.textContent = "← Previous";
    }

    if (currentQuestionIndex < questionSequence.length - 1) {
      const nextTitle = questionSequence[currentQuestionIndex + 1].title;
      if (canGoNext) {
        nextButton.textContent = `${nextTitle} →`;
      } else {
        nextButton.textContent = `🔒 ${nextTitle} →`;
        nextButton.title = "Complete current question to unlock";
      }
    } else {
      nextButton.textContent = "Next →";
    }
  }
}

// Mark question as attempted and record result
function markQuestionAttempted(
  questionIndex = currentQuestionIndex,
  isCorrect = false,
  score = 0
) {
  console.log(
    `✅ Question ${questionIndex + 1} marked as attempted - ${
      isCorrect ? "PASSED" : "FAILED"
    }`
  );
  attemptedQuestions.add(questionIndex);

  // Record the result for adaptive navigation
  questionResults.set(questionIndex, {
    passed: isCorrect,
    score: score,
    timestamp: Date.now(),
  });

  // Check if all questions have been attempted
  if (attemptedQuestions.size === questionSequence.length) {
    allQuestionsAttempted = true;
    console.log(
      "🎉 All questions have been attempted! Free navigation enabled."
    );
  }

  // Update navigation buttons to reflect new state
  updateNavigationButtons();

  // Hide any existing warning
  const warningDiv = document.getElementById("attempt-warning");
  if (warningDiv) {
    warningDiv.style.display = "none";
  }
}

// Show adaptive mode message when remediation is provided
function showAdaptiveModeMessage() {
  let adaptiveDiv = document.getElementById("adaptive-message");
  if (!adaptiveDiv) {
    adaptiveDiv = document.createElement("div");
    adaptiveDiv.id = "adaptive-message";
    adaptiveDiv.className = "adaptive-message";
    document.getElementById("navigation-controls").appendChild(adaptiveDiv);
  }

  adaptiveDiv.innerHTML =
    "🎯 Providing additional practice based on your previous answer";
  adaptiveDiv.style.display = "block";

  // Hide message after 4 seconds
  setTimeout(() => {
    adaptiveDiv.style.display = "none";
  }, 4000);
}

// Smart next question selection based on performance
function getNextQuestionIndex() {
  const currentResult = questionResults.get(currentQuestionIndex);

  // If current question was failed, provide remediation
  if (currentResult && !currentResult.passed) {
    console.log("🔄 Student failed current question, providing remediation...");

    const currentQuestion = questionSequence[currentQuestionIndex];
    const remediationQuestion = findRemediationQuestion(currentQuestion);

    if (remediationQuestion !== null) {
      adaptiveMode = true;
      console.log(
        `📚 Remediation question selected: ${remediationQuestion + 1}`
      );
      return remediationQuestion;
    }
  }

  // Normal progression - next question in sequence
  adaptiveMode = false;
  return currentQuestionIndex + 1;
}

// Find a remediation question for failed attempts
function findRemediationQuestion(failedQuestion) {
  // Look for questions with same topic but easier difficulty
  const sameTopicQuestions = questionSequence
    .map((q, index) => ({ ...q, index }))
    .filter(
      (q) =>
        q.topic === failedQuestion.topic &&
        q.index !== currentQuestionIndex &&
        !attemptedQuestions.has(q.index)
    );

  // Prefer basic difficulty for remediation
  const basicQuestions = sameTopicQuestions.filter(
    (q) => q.difficulty === "basic"
  );
  if (basicQuestions.length > 0) {
    return basicQuestions[0].index;
  }

  // Fall back to any same-topic question not yet attempted
  if (sameTopicQuestions.length > 0) {
    return sameTopicQuestions[0].index;
  }

  // If no same-topic questions available, repeat the same question with new seed
  return currentQuestionIndex;
}

// Override the original createQuestionBlocks to work with single question
function createQuestionBlocks() {
  const questionContent = document.getElementById("question-content");
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
document.addEventListener("DOMContentLoaded", function () {
  if (!navigationInitialized) {
    // Wait a bit for other scripts to load
    setTimeout(initializeNavigation, 500);
  }
});

// Also initialize when called from docHasLoaded
window.initializeNavigationSystem = function () {
  if (!navigationInitialized) {
    setTimeout(initializeNavigation, 100);
  }
};
