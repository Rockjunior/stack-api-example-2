const timeOutHandler = new Object();
const inputPrefix = 'stackapi_input_';
const feedbackPrefix = 'stackapi_fb_';
const validationPrefix = 'stackapi_val_';
// const xmlfiles = ['questions/calc.xml', 'questions/stack_jxg.binding-demo-4.4.xml'];
const apiUrl = 'http://localhost:3080';

const stackstring = {
  "teacheranswershow_mcq":"A correct answer is: {$a->display}",
  "api_which_typed":"which can be typed as follows",
  "api_valid_all_parts":"Please enter valid answers for all parts of the question.",
  "api_out_of":"out of",
  "api_marks_sub":"Marks for this submission",
  "api_submit":"Submit Answers",
  "generalfeedback":"General feedback",
  "score":"Score",
  "api_response":"Response summary",
  "api_correct":"Correct answers"
};

// Create data for call to API.
async function collectData(qfile, qname, qprefix) {
  let res = "";

  // for (const file of xmlfiles) {
    await getQuestionFile(qfile, qname).then((response)=>{
      if (response.questionxml != "<quiz>\nnull\n</quiz>") {
        res = {
          questionDefinition: response.questionxml,
          answers: collectAnswer(qprefix),
          seed: response.seed,
          renderInputs: qprefix + inputPrefix,
          readOnly: false,
        };
      };
    });
  // }
  return res;
}

// Get the different input elements by tag and return object with values.
function collectAnswer(qprefix) {
  const inputs = document.getElementsByTagName('input');
  const textareas = document.getElementsByTagName('textarea');
  const selects = document.getElementsByTagName('select');
  let res = {};
  res = processNodes(res, inputs, qprefix);
  res = processNodes(res, textareas, qprefix);
  res = processNodes(res, selects, qprefix);
  return res;
}

// Return object of values of valid entries in an HTMLCollection.
function processNodes(res, nodes, qprefix) {
  for (let i = 0; i < nodes.length; i++) {
    const element = nodes[i];
    if (element.name.indexOf(qprefix+inputPrefix) === 0 && element.name.indexOf('_val') === -1) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        if (element.checked) {
          res[element.name.slice((qprefix+inputPrefix).length)] = element.value;
        }
      } else {
        res[element.name.slice((qprefix+inputPrefix).length)] = element.value;
      }
    }
  }
  return res;
}

// Display rendered question and solution.
function send(qfile, qname, qprefix) {
  const http = new XMLHttpRequest();
  // const url = window.location.origin + '/render';
  const url = apiUrl + '/render';
  http.open("POST", url, true);
  http.setRequestHeader('Content-Type', 'application/json');
  http.onreadystatechange = function() {
    if(http.readyState == 4) {
      try {
        const json = JSON.parse(http.responseText);
        if (json.message) {
          console.log(json);
          document.getElementById(`${qprefix+"errors"}`).innerText = json.message;
          return;
        } else {
          document.getElementById(`${qprefix+"errors"}`).innerText = '';
        }
        renameIframeHolders();
        let question = json.questionrender;
        const inputs = json.questioninputs;
        let correctAnswers = '';
        // Show correct answers.
        for (const [name, input] of Object.entries(inputs)) {
          question = question.replace(`[[input:${name}]]`, input.render);
          // question = question.replaceAll(`${inputPrefix}`,`${qprefix+inputPrefix}`);
          question = question.replace(`[[validation:${name}]]`, `<span name='${qprefix+validationPrefix + name}'></span>`);
          if (input.samplesolutionrender && name !== 'remember') {
            // Display render of answer and matching user input to produce the answer.
            correctAnswers += `<p>
                  ${stackstring['teacheranswershow_mcq']} \\[{${input.samplesolutionrender}}\\],
                  ${stackstring['api_which_typed']}: `;
            for (const [name, solution] of Object.entries(input.samplesolution)) {
              if (name.indexOf('_val') === -1) {
                correctAnswers += `<span class='correct-answer'>${solution}</span>`;
              }
            }
            correctAnswers += '.</p>';
          } else if (name !== 'remember') {
            // For dropdowns, radio buttons, etc, only the correct option is displayed.
            for (const solution of Object.values(input.samplesolution)) {
              if (input.configuration.options) {
                correctAnswers += `<p class='correct-answer'>${input.configuration.options[solution]}</p>`;
              }
            }
          }
        }
        // Convert Moodle plot filenames to API filenames.
        for (const [name, file] of Object.entries(json.questionassets)) {
          const plotUrl = getPlotUrl(file);
          question = question.replace(name, plotUrl);
          json.questionsamplesolutiontext = json.questionsamplesolutiontext.replace(name, plotUrl);
          correctAnswers = correctAnswers.replace(name, plotUrl);
        }

        question = replaceFeedbackTags(question,qprefix);
        qoutput = document.getElementById(`${qprefix+'output'}`);
        qoutput.innerHTML = question;
        // Only display results sections once question retrieved.
        document.getElementById(`${qprefix+'stackapi_qtext'}`).style.display = 'block';
        document.getElementById(`${qprefix+'stackapi_correct'}`).style.display = 'block';

        // Setup a validation call on inputs. Timeout length is reset if the input is updated
        // before the validation call is made.
        for (const inputName of Object.keys(inputs)) {
          const inputElements = document.querySelectorAll(`[name^=${qprefix+inputPrefix + inputName}]`);
          for (const inputElement of Object.values(inputElements)) {
            inputElement.oninput = (event) => {
              const currentTimeout = timeOutHandler[event.target.id];
              if (currentTimeout) {
                window.clearTimeout(currentTimeout);
              }
              console.log(event.target);
              
              // Removed input tracking - only track final submissions
              
              timeOutHandler[event.target.id] = window.setTimeout(validate.bind(null, event.target, qfile, qname, qprefix), 1000);
            };
          }
        }
        let sampleText = json.questionsamplesolutiontext;
        console.log('📝 Processing general feedback content:', sampleText ? 'Content found' : 'No content');
        if (sampleText) {
          sampleText = replaceFeedbackTags(sampleText,qprefix);
          const generalFeedbackContent = document.getElementById(`${qprefix+'generalfeedback'}`);
          if (generalFeedbackContent) {
            generalFeedbackContent.innerHTML = sampleText;
            console.log('✅ General feedback content populated');
          } else {
            console.error('❌ General feedback content element not found:', `${qprefix+'generalfeedback'}`);
          }
          // Don't show general feedback immediately - wait for submission
          document.getElementById(`${qprefix+'stackapi_generalfeedback'}`).style.display = 'none';
        } else {
          // If the question is updated, there may no longer be general feedback.
          document.getElementById(`${qprefix+'stackapi_generalfeedback'}`).style.display = 'none';
          console.log('⚠️ No general feedback content available for this question');
        }
        document.getElementById(`${qprefix+'stackapi_score'}`).style.display = 'none';
        document.getElementById(`${qprefix+'stackapi_validity'}`).innerText = '';
        const innerFeedback = document.getElementById(`${qprefix+'specificfeedback'}`);
        innerFeedback.innerHTML = '';
        innerFeedback.classList.remove('feedback');
        document.getElementById(`${qprefix+'formatcorrectresponse'}`).innerHTML = correctAnswers;

        // Hide General feedback and correct answers for now (will show after submission)
        document.getElementById(`${qprefix+'stackapi_generalfeedback'}`).style.display = 'none';
        document.getElementById(`${qprefix+'stackapi_correct'}`).style.display = 'none';

        createIframes(json.iframes);
        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
      }
      catch(e) {
        console.log(e);
        document.getElementById(`${qprefix+'errors'}`).innerText = http.responseText;
        return;
      }
    }
  };
  collectData(qfile, qname, qprefix).then((data)=>{
    let submitbutton = document.getElementById(`${qprefix + 'stackapi_qtext'}`).querySelector('input[type="button"]');
    submitbutton.addEventListener('click', function() {answer(qfile, qname, qprefix, data.seed)});
    http.send(JSON.stringify(data));
    let questioncontainer = document.getElementById(`${qprefix+'stack'}`).parentElement;
    if (questioncontainer.getBoundingClientRect().top<0){
      questioncontainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}

// Validate an input. Called a set amount of time after an input is last updated.
function validate(element, qfile, qname, qprefix) {
  const http = new XMLHttpRequest();
  // const url = window.location.origin + '/validate';
  const url = apiUrl + '/validate';
  http.open("POST", url, true);
  // Remove API prefix and subanswer id.
  const answerNamePrefixTrim = (qprefix+inputPrefix).length;
  const answerName = element.name.slice(answerNamePrefixTrim).split('_', 1)[0];
  http.setRequestHeader('Content-Type', 'application/json');
  http.onreadystatechange = function() {
    if(http.readyState == 4) {
      try {
        const json = JSON.parse(http.responseText);
        if (json.message) {
          document.getElementById(`${qprefix+'errors'}`).innerText = json.message;
          return;
        } else {
          document.getElementById(`${qprefix+'errors'}`).innerText = '';
        }
        renameIframeHolders();
        const validationHTML = json.validation;
        const element = document.getElementsByName(`${qprefix+validationPrefix + answerName}`)[0];
        console.log(element);
        element.innerHTML = validationHTML;
        if (validationHTML) {
          element.classList.add('validation');
        } else {
          element.classList.remove('validation');
        }
        createIframes(json.iframes);
        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
      }
      catch(e) {
        document.getElementById(`${qprefix+'errors'}`).innerText = http.responseText;
        return;
      }
    }
  };
  collectData(qfile, qname, qprefix).then((data)=>{
    data.inputName = answerName;
    http.send(JSON.stringify(data));
  });
}

// Call AI feedback service
async function callAIFeedback(qprefix, userAnswers, gradingResponse, questionName, score, maxScore, isCorrect) {
  try {
    // Debug: Log the qprefix to see which question we're targeting
    console.log('AI Feedback for question prefix:', qprefix);
    
    // Show loading indicator - try multiple possible element selectors
    let aiSection = document.getElementById(`${qprefix}ai_feedback_section`);
    let aiFeedback = document.getElementById(`${qprefix}ai_feedback`);
    
    // If not found, try without underscore (fallback for question 1)
    if (!aiSection) {
      aiSection = document.getElementById(`q1ai_feedback_section`);
      console.log('Fallback: trying q1ai_feedback_section');
    }
    if (!aiFeedback) {
      aiFeedback = document.getElementById(`q1ai_feedback`);
      console.log('Fallback: trying q1ai_feedback');
    }
    
    console.log('AI Section element:', aiSection);
    console.log('AI Feedback element:', aiFeedback);
    console.log('Expected section ID:', `${qprefix}ai_feedback_section`);
    console.log('Expected feedback ID:', `${qprefix}ai_feedback`);
    
    if (!aiSection || !aiFeedback) {
      console.error('AI feedback elements not found for prefix:', qprefix);
      return;
    }
    
    aiSection.style.display = 'block';
    aiFeedback.innerHTML = '<div class="ai-loading">⚡ AI is analyzing your response...</div>';

    // Extract correct answer or general feedback for comparison
    const correctAnswer = gradingResponse.formatcorrectresponse || 
                         gradingResponse.generalfeedback || 
                         gradingResponse.responsesummary || 
                         "No solution provided";

    // Extract comprehensive question information
    let questionText = "Question text not found";
    let questionType = "Unknown";
    let additionalContext = "";
    
    // Get the question block for this specific question
    const questionBlock = document.querySelector(`[id*="${qprefix}"]`)?.closest('.que.stack') || 
                         document.querySelector('.que.stack');
    
    if (questionBlock) {
      // Extract the main question text (before any input fields or feedback)
      const questionTextElement = questionBlock.querySelector('.qtext, .questiontext, [class*="questiontext"]');
      if (questionTextElement) {
        questionText = questionTextElement.textContent.trim();
      }
      
      // If not found, try to extract from the beginning of the question block
      if (questionText === "Question text not found") {
        const allText = questionBlock.textContent || "";
        const lines = allText.split('\n').map(line => line.trim()).filter(line => line);
        
        // Find lines that look like question content (before feedback sections)
        const questionLines = [];
        for (const line of lines) {
          if (line.includes('Score:') || 
              line.includes('Correct answer') || 
              line.includes('General feedback') ||
              line.includes('Response summary') ||
              line.includes('AI Tutor Feedback') ||
              line.includes('Marks for this submission')) {
            break;
          }
          if (line.length > 10 && !line.includes('Submit')) {
            questionLines.push(line);
          }
        }
        
        if (questionLines.length > 0) {
          questionText = questionLines.join(' ').substring(0, 500); // Limit length
        }
      }
      
      // Detect question type based on input elements
      const inputs = questionBlock.querySelectorAll('input, select, textarea');
      if (inputs.length > 0) {
        const inputTypes = Array.from(inputs).map(input => input.type || input.tagName.toLowerCase());
        if (inputTypes.includes('text') || inputTypes.includes('textarea')) {
          questionType = "Text/Algebraic Input";
        }
        if (inputTypes.includes('radio')) {
          questionType = "Multiple Choice";
        }
        if (inputTypes.includes('checkbox')) {
          questionType = "Multiple Selection";
        }
      }
      
      // Look for mathematical notation or special elements
      if (questionBlock.querySelector('.MathJax, [class*="math"], .katex')) {
        additionalContext += " Contains mathematical expressions.";
      }
      
      // Look for graphs or interactive elements
      if (questionBlock.querySelector('canvas, svg, [id*="jxg"], [class*="graph"]')) {
        additionalContext += " Contains interactive graph or diagram.";
        questionType = "Interactive/Graphical";
      }
    }
    
    // Clean up the question text
    questionText = questionText.replace(/\s+/g, ' ').trim();

    console.log('Question text extracted:', questionText);

    // Call AI service (use custom API service on port 3000)
    const response = await fetch('http://localhost:3000/ai/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAnswers: userAnswers,
        correctAnswer: correctAnswer,
        generalFeedback: gradingResponse.generalfeedback,
        questionName: questionName,
        questionText: questionText,
        questionType: questionType,
        additionalContext: additionalContext,
        score: score,
        maxScore: maxScore,
        isCorrect: isCorrect
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const aiData = await response.json();
    
    if (aiData.success) {
      // Format the AI response with better styling
      const formattedFeedback = aiData.feedback
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
      
      aiFeedback.innerHTML = `
        <div class="ai-response-content">
          <div class="ai-response-header">
            <span class="ai-icon">🤖</span>
            <span class="ai-title">AI Tutor Feedback</span>
          </div>
          <div class="ai-response-body">
            <p>${formattedFeedback}</p>
          </div>
        </div>
      `;
      
      // Trigger MathJax re-rendering for the new AI content
      setTimeout(() => {
        if (typeof MathJax !== 'undefined' && MathJax.Hub) {
          // MathJax v2
          MathJax.Hub.Queue(["Typeset", MathJax.Hub, aiFeedback]);
        } else if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
          // MathJax v3
          MathJax.typesetPromise([aiFeedback]).catch((err) => console.log('MathJax typeset failed: ' + err.message));
        } else if (typeof MathJax !== 'undefined') {
          // Fallback - try to reprocess the entire document
          MathJax.Hub.Reprocess(aiFeedback);
        }
        console.log('MathJax re-rendering triggered for AI feedback');
      }, 100); // Small delay to ensure DOM is updated
    } else {
      throw new Error(aiData.error || 'AI service returned an error');
    }
  } catch (error) {
    console.error('AI feedback error:', error);
    const aiFeedback = document.getElementById(`${qprefix}ai_feedback`);
    if (aiFeedback) {
      aiFeedback.innerHTML = '<div class="ai-error">AI feedback temporarily unavailable. Please try again later.</div>';
    }
  }
}

// Submit answers.
function answer(qfile, qname, qprefix, seed) {
  const http = new XMLHttpRequest();
  // const url = window.location.origin + '/grade';
  const url = apiUrl + '/grade';
  http.open("POST", url, true);

  if (!document.getElementById(`${qprefix+'output'}`).innerText) {
    return;
  }

  http.setRequestHeader('Content-Type', 'application/json');
  http.onreadystatechange = async function() {
    if(http.readyState == 4) {
      try {
        const json = JSON.parse(http.responseText);
        if (json.message) {
          document.getElementById(`${qprefix+'errors'}`).innerText = json.message;
          return;
        } else {
          document.getElementById(`${qprefix+'errors'}`).innerText = '';
        }
        if (!json.isgradable) {
          document.getElementById(`${qprefix+'stackapi_validity'}`).innerText
              = ' ' + stackstring["api_valid_all_parts"];
          return;
        }
        renameIframeHolders();
        const finalScore = json.score * json.scoreweights.total;
        const maxScore = json.scoreweights.total;
        const isCorrect = json.score >= 1.0;
        
        // Mark question as attempted when user submits
        if (typeof markQuestionAttempted === 'function') {
          markQuestionAttempted();
        }
        
        document.getElementById(`${qprefix+'score'}`).innerText
            = finalScore.toFixed(2) + ' ' + stackstring["api_out_of"] + ' ' + maxScore;
        document.getElementById(`${qprefix+'stackapi_score'}`).style.display = 'block';
        document.getElementById(`${qprefix+'response_summary'}`).innerText = json.responsesummary;
        
        // Collect answers for AI processing and database tracking
        const answers = collectAnswer(qprefix);
        
        // Create and update question attempt in database with results
        if (window.databaseTracking) {
          // Create attempt only when user submits (not on page load)
          const attempt = await window.databaseTracking.createQuestionAttempt(qfile, qname, qprefix, seed);
          
          if (attempt) {
            await window.databaseTracking.updateQuestionAttempt(qprefix, finalScore, maxScore, isCorrect);
            
            // Track final answers with validation results
            const consolidatedAnswers = JSON.stringify(answers);
            
            const validationResults = {
              score: json.score,
              maxScore: json.scoreweights?.total || 1,
              isCorrect: json.score >= 1.0,
              responseSummary: json.responsesummary,
              specificFeedback: json.specificfeedback,
              prts: json.prts
            };
            
            await window.databaseTracking.trackInput(
              qprefix, 
              'final_answers', 
              consolidatedAnswers, 
              'final_submission', 
              true, // is final answer
              JSON.stringify(validationResults) // validation results
            );
          }
        }

        // Show General feedback and correct answers, hide summary
        console.log('📋 Displaying general feedback after submission...');
        
        // Add delay to ensure all elements are ready
        setTimeout(() => {
          const generalFeedbackElement = document.getElementById(`${qprefix+'stackapi_generalfeedback'}`);
          const generalFeedbackContent = document.getElementById(`${qprefix+'generalfeedback'}`);
          
          if (generalFeedbackElement && generalFeedbackContent) {
            // Check if there's actual content to show
            if (generalFeedbackContent.innerHTML.trim() !== '') {
              generalFeedbackElement.style.display = 'block';
              console.log('✅ General feedback displayed with content');
            } else {
              console.log('⚠️ General feedback element exists but has no content');
            }
          } else {
            console.error('❌ General feedback elements not found:', {
              container: !!generalFeedbackElement,
              content: !!generalFeedbackContent
            });
          }
        }, 200);

        document.getElementById(`${qprefix+'stackapi_summary'}`).style.display = 'none';

        const feedback = json.prts;
        const specificFeedbackElement = document.getElementById(`${qprefix+'specificfeedback'}`);
        // Replace tags and plots in specific feedback and then display.
        if (json.specificfeedback) {
          for (const [name, file] of Object.entries(json.gradingassets)) {
            json.specificfeedback = json.specificfeedback.replace(name, getPlotUrl(file));
          }
          json.specificfeedback = replaceFeedbackTags(json.specificfeedback,qprefix);
          specificFeedbackElement.innerHTML = json.specificfeedback;
          specificFeedbackElement.classList.add('feedback');
        } else {
          specificFeedbackElement.classList.remove('feedback');
        }
        // Replace plots in tagged feedback and then display.
        for (let [name, fb] of Object.entries(feedback)) {
          for (const [name, file] of Object.entries(json.gradingassets)) {
            fb = fb.replace(name, getPlotUrl(file));
          }
          const elements = document.getElementsByName(`${qprefix+feedbackPrefix + name}`);
          if (elements.length > 0) {
            const element = elements[0];
            if (json.scores[name] !== undefined) {
              fb = fb + `<div>${stackstring['api_marks_sub']}:
                    ${(json.scores[name] * json.scoreweights[name] * json.scoreweights.total).toFixed(2)}
                      / ${(json.scoreweights[name] * json.scoreweights.total).toFixed(2)}.</div>`;
            }
            element.innerHTML = fb;
            // if (fb) {
//                   element.classList.add('feedback');
//                 } else {
//                   element.classList.remove('feedback');
//                 }
          }
        }
        createIframes(json.iframes);
        
        // Ensure MathJax renders general feedback properly with longer delay
        setTimeout(() => {
          if (typeof MathJax !== 'undefined' && MathJax.Hub) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
            console.log('🔢 MathJax re-rendering triggered for general feedback');
          }
        }, 300);

        // Call AI feedback service after all feedback is displayed
        await callAIFeedback(qprefix, answers, json, qname, finalScore, maxScore, isCorrect);
      }
      catch(e) {
        console.log(e);
        document.getElementById(`${qprefix+'errors'}`).innerText = http.responseText;
        return;
      }
    }
  };
  // Clear previous answers and score.
  const specificFeedbackElement = document.getElementById(`${qprefix+'specificfeedback'}`);
  specificFeedbackElement.innerHTML = "";
  specificFeedbackElement.classList.remove('feedback');
  document.getElementById(`${qprefix+'response_summary'}`).innerText = "";
  document.getElementById(`${qprefix+'stackapi_summary'}`).style.display = 'none';
  
  // Clear previous AI feedback
  const aiSection = document.getElementById(`${qprefix}ai_feedback_section`);
  const aiFeedback = document.getElementById(`${qprefix}ai_feedback`);
  if (aiSection) aiSection.style.display = 'none';
  if (aiFeedback) aiFeedback.innerHTML = "";
  const inputElements = document.querySelectorAll(`[name^=${qprefix+feedbackPrefix}]`);
  for (const inputElement of Object.values(inputElements)) {
    inputElement.innerHTML = "";
    inputElement.classList.remove('feedback');
  }
  document.getElementById(`${qprefix+'stackapi_score'}`).style.display = 'none';
  document.getElementById(`${qprefix+'stackapi_validity'}`).innerText = '';
  collectData(qfile, qname, qprefix).then((data) => {
    data.seed = seed;
    console.log('Question data before sending:', { qfile, qname, qprefix, seed });
    http.send(JSON.stringify(data));
  });
}

// Save contents of question editor locally.
function saveState(key, value) {
  if (typeof(Storage) !== "undefined") {
    localStorage.setItem(key, value);
  }
}

// Load locally stored question on page refresh.
function loadState(key) {
  if (typeof(Storage) !== "undefined") {
    return localStorage.getItem(key) || '';
  }
  return '';
}

function renameIframeHolders() {
  // Each call to STACK restarts numbering of iframe holders so we need to rename
  // any old ones to make sure new iframes end up in the correct place.
  for (const iframe of document.querySelectorAll(`[id^=stack-iframe-holder]:not([id$=old]`)) {
    iframe.id = iframe.id + '_old';
  }
}

function createIframes (iframes) {
  const corsFragment = "/cors.php?name=";

  for (const iframe of iframes) {
    create_iframe(
      iframe[0],
      iframe[1].replaceAll(corsFragment, apiUrl + corsFragment),
      ...iframe.slice(2)
    );
  }
}

// Replace feedback tags in some text with an approproately named HTML div.
function replaceFeedbackTags(text, qprefix) {
  let result = text;
  const feedbackTags = text.match(/\[\[feedback:.*\]\]/g);
  if (feedbackTags) {
    for (const tag of feedbackTags) {
      // Part name is between '[[feedback:' and ']]'.
      result = result.replace(tag, `<div name='${qprefix+feedbackPrefix + tag.slice(11, -2)}'></div>`);
    }
  }
  return result;
}

async function getQuestionFile(questionURL, questionName) {
  let res = "";
  if (questionURL) {
    await fetch(questionURL)
        .then(result => result.text())
        .then((result) => {
          res = loadQuestionFromFile(result, questionName);
        });
  }
  return res;
}

function loadQuestionFromFile(fileContents, questionName) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(fileContents, "text/xml");

  let thequestion = null;
  let randSeed = null;
  for (const question of xmlDoc.getElementsByTagName("question")) {
    if (question.getAttribute('type').toLowerCase() === 'stack' && (!questionName || question.querySelectorAll("name text")[0].textContent === questionName)) {
      thequestion = question.outerHTML;
      let seeds = question.querySelectorAll('deployedseed');
      console.log(seeds);
      if (seeds.length) {
        console.log(seeds.length);
        randSeed = parseInt(seeds[Math.floor(Math.random()*seeds.length)].textContent);
      }
      break;
    }
  }
  return {questionxml:setQuestion(thequestion),seed:randSeed};
}

function setQuestion(question) {
  return '<quiz>\n' + question + '\n</quiz>';
}

function createQuestionBlocks() {
  questionBlocks = document.getElementsByClassName("que stack");
  let i=0;

  for (questionblock of questionBlocks){
    i++;
    let questionPrefix = "q" + i.toString() + "_";
    var qfile = questionblock.dataset.qfile;
    var qname = questionblock.dataset.qname || "";
    questionblock.innerHTML =
        `
                <div class="collapsiblecontent" id=${questionPrefix + "stack"}>
                    <div class="vstack gap-3 ms-3 col-lg-8">
                        <div id=${questionPrefix + "errors"}></div>
                        <div id=${questionPrefix + "stackapi_qtext"} class="col-lg-8" style="display: none">
                          <!--<h2>${stackstring['questiontext']}:</h2>-->
                          <div id=${questionPrefix + "output"} class="formulation"></div>
                          <div id=${questionPrefix + "specificfeedback"}></div>
                          <br>
                          <!-- <input type="button" onclick="answer('${qfile}', '${qname}', '${questionPrefix}')" class="btn btn-primary" value=${stackstring["api_submit"]}/>-->
                          <input type="button" class="btn btn-primary" value=${stackstring["api_submit"]}/>
                          <span id=${questionPrefix + "stackapi_validity"} style="color:darkred"></span>
                        </div>
                        <div id=${questionPrefix + "stackapi_generalfeedback"} class="col-lg-8" style="display: none">
                          <h2>${stackstring['generalfeedback']}:</h2>
                          <div id=${questionPrefix + "generalfeedback"} class="feedback"></div>
                        </div>
                        <h2 id=${questionPrefix + "stackapi_score"} style="display: none">${stackstring['score']}: <span id=${questionPrefix + "score"}></span></h2>
                        <div id=${questionPrefix + "stackapi_summary"} class="col-lg-10" style="display: none">
                          <h2>${stackstring['api_response']}:</h2>
                          <div id=${questionPrefix + "response_summary"} class="feedback"></div>
                        </div>
                        <div id=${questionPrefix + "stackapi_correct"} class="col-lg-10" style="display: none">
                          <h2>${stackstring['api_correct']}:</h2>
                          <div id=${questionPrefix + "formatcorrectresponse"} class="feedback"></div>
                        </div>
                        <div id=${questionPrefix + "ai_feedback_section"} class="col-lg-10" style="display: none">
                          <h2>🤖 AI Tutor Feedback:</h2>
                          <div id=${questionPrefix + "ai_feedback"} class="feedback ai-response"></div>
                        </div>
                    </div>
                    <div id=${questionPrefix + "newquestionbutton"}>
                      <input type="button" onclick="send('${qfile}', '${qname}', '${questionPrefix}')" class="btn btn-primary" value="Show new example question"/>
                    </div>
                </div>
              `;
  }
}

function addCollapsibles(){
  var collapsibles = document.querySelectorAll(".level2>h2, .stack>h2");
  for (let i=0; i<collapsibles.length; i++) {
    collapsibles[i].addEventListener("click", () => collapseFunc(this));
  }
}

function collapseFunc(e){
  e.classList.toggle("collapsed");
}

function stackSetup(){
  // Skip automatic question creation in navigation mode
  // Navigation system will handle question loading
  if (typeof initializeNavigation === 'function') {
    console.log('Navigation mode enabled - skipping automatic question setup');
    return;
  }
  createQuestionBlocks();
  addCollapsibles();
}

function getPlotUrl(file) {
  return `${apiUrl}/plots/${file}`;
}
