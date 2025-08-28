// Database operations for STACK API question tracking
// Handles anonymous session tracking and question interaction logging

// Global variables for session tracking
let currentSession = null;
let currentAttempts = {}; // Track attempts by question prefix

// Generate anonymous user identifier
function generateAnonymousId() {
    // Check if we already have one stored
    let anonymousId = localStorage.getItem('anonymousUserId');
    if (!anonymousId) {
        // Create a unique identifier based on timestamp and random number
        anonymousId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('anonymousUserId', anonymousId);
    }
    return anonymousId;
}

// Initialize database session when page loads
async function initializeDatabaseSession() {
    if (!supabase) {
        console.warn('Supabase not configured - database tracking disabled');
        return null;
    }

    try {
        const anonymousId = generateAnonymousId();
        
        // Create learning session
        const { data, error } = await supabase
            .from('learning_sessions')
            .insert([
                {
                    page_url: window.location.href,
                    user_agent: navigator.userAgent,
                    anonymous_id: anonymousId
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating learning session:', error);
            return null;
        }

        currentSession = data;
        console.log('Database session initialized:', currentSession.id);
        return data;

    } catch (error) {
        console.error('Database session initialization failed:', error);
        return null;
    }
}

// Create question attempt record
async function createQuestionAttempt(qfile, qname, qprefix, seed) {
    if (!supabase || !currentSession) {
        console.warn('Database not available for question attempt tracking');
        return null;
    }

    try {
        // Check if this is a retry (increment attempt number)
        const existingAttempt = currentAttempts[qprefix];
        const attemptNumber = existingAttempt ? existingAttempt.attempt_number + 1 : 1;

        const { data, error } = await supabase
            .from('question_attempts')
            .insert([
                {
                    session_id: currentSession.id,
                    question_file: qfile,
                    question_name: qname || null,
                    question_prefix: qprefix,
                    seed: seed || null,
                    attempt_number: attemptNumber
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating question attempt:', error);
            return null;
        }

        // Store current attempt for this question
        currentAttempts[qprefix] = data;
        console.log('Question attempt created:', data.id);
        return data;

    } catch (error) {
        console.error('Question attempt creation failed:', error);
        return null;
    }
}

// Update question attempt with submission results
async function updateQuestionAttempt(qprefix, score, maxScore, isCorrect) {
    if (!supabase || !currentAttempts[qprefix]) {
        console.warn('No question attempt to update');
        return null;
    }

    try {
        const attempt = currentAttempts[qprefix];
        
        const { data, error } = await supabase
            .from('question_attempts')
            .update({
                submitted_at: new Date().toISOString(),
                score: score,
                max_score: maxScore,
                is_correct: isCorrect
            })
            .eq('id', attempt.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating question attempt:', error);
            return null;
        }

        // Update local cache
        currentAttempts[qprefix] = data;
        console.log('Question attempt updated:', data.id);
        return data;

    } catch (error) {
        console.error('Question attempt update failed:', error);
        return null;
    }
}

// Track input interactions
async function trackInput(qprefix, inputName, inputValue, inputType, isFinalAnswer = false, validationResult = null) {
    if (!supabase || !currentSession || !currentAttempts[qprefix]) {
        return null;
    }

    try {
        const attempt = currentAttempts[qprefix];
        
        const { data, error } = await supabase
            .from('input_tracking')
            .insert([
                {
                    attempt_id: attempt.id,
                    session_id: currentSession.id,
                    input_name: inputName,
                    input_value: inputValue,
                    input_type: inputType,
                    is_final_answer: isFinalAnswer,
                    validation_result: validationResult
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error tracking input:', error);
            return null;
        }

        return data;

    } catch (error) {
        console.error('Input tracking failed:', error);
        return null;
    }
}

// End current session
async function endDatabaseSession() {
    if (!supabase || !currentSession) {
        return;
    }

    try {
        const { error } = await supabase
            .from('learning_sessions')
            .update({
                session_end: new Date().toISOString()
            })
            .eq('id', currentSession.id);

        if (error) {
            console.error('Error ending session:', error);
        } else {
            console.log('Database session ended');
        }

    } catch (error) {
        console.error('Session end failed:', error);
    }
}

// Utility function to extract input details
function getInputDetails(inputElement) {
    const inputType = inputElement.type || inputElement.tagName.toLowerCase();
    let inputValue = inputElement.value;
    
    // Handle different input types
    if (inputType === 'checkbox' || inputType === 'radio') {
        inputValue = inputElement.checked ? inputElement.value : '';
    }
    
    return {
        type: inputType,
        value: inputValue
    };
}

// Initialize database tracking when page unloads
window.addEventListener('beforeunload', function() {
    endDatabaseSession();
});

// Export functions for use in other scripts
window.databaseTracking = {
    initializeDatabaseSession,
    createQuestionAttempt,
    updateQuestionAttempt,
    trackInput,
    endDatabaseSession,
    getInputDetails
}; 