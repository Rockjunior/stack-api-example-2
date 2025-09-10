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
    if (!window.supabase) {
        console.warn('Supabase not configured - database tracking disabled');
        return null;
    }

    try {
        const anonymousId = generateAnonymousId();
        
        // Create learning session
        const { data, error } = await window.supabase
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

        currentSession = data.id; // Store only the UUID string, not the full object
        console.log('Database session initialized:', currentSession);
        return data;

    } catch (error) {
        console.error('Database session initialization failed:', error);
        return null;
    }
}

// Create question attempt record
async function createQuestionAttempt(qfile, qname, qprefix, seed) {
    if (!window.supabase || !currentSession) {
        console.warn('Database not available for question attempt tracking');
        return null;
    }
    
    try {
        const { data, error } = await window.supabase
            .from('question_attempts')
            .insert([{
                session_id: currentSession,
                question_file: qfile,
                question_name: qname || '',
                question_prefix: qprefix,
                seed: seed,
                score: null,
                max_score: null,
                is_correct: null
            }])
            .select()
            .single();

        if (error) throw error;
        
        console.log('Question attempt created:', data.id);
        currentAttempts[qprefix] = data.id;
        return data.id;
    } catch (error) {
        console.error('Error creating question attempt:', error);
        return null;
    }
}

// Update question attempt with submission results
async function updateQuestionAttempt(qprefix, score, maxScore, isCorrect) {
    if (!window.supabase || !currentAttempts[qprefix]) {
        console.warn('No question attempt to update for prefix:', qprefix);
        return null;
    }

    try {
        const { data, error } = await window.supabase
            .from('question_attempts')
            .update({
                score: score,
                max_score: maxScore,
                is_correct: isCorrect
            })
            .eq('id', currentAttempts[qprefix])
            .select()
            .single();

        if (error) throw error;
        
        console.log('Question attempt updated:', data.id);
        return data;
    } catch (error) {
        console.error('Question attempt update failed:', error);
        return null;
    }
}

// Track input interactions
async function trackInput(qprefix, inputName, inputValue, inputType, isFinalAnswer = false, validationResult = null) {
    if (!window.supabase || !currentSession) {
        return null;
    }

    // Ensure we have a valid attempt before tracking
    if (!currentAttempts[qprefix]) {
        console.warn('No question attempt found for input tracking, skipping:', qprefix);
        return null;
    }

    try {
        const attempt = currentAttempts[qprefix];
        
        // Verify the attempt exists in database before tracking inputs
        const { data: attemptExists } = await window.supabase
            .from('question_attempts')
            .select('id')
            .eq('id', attempt)
            .maybeSingle();
            
        if (!attemptExists) {
            console.error('Attempt not found in database:', attempt);
            return null;
        }
        
        // For final answers, consolidate all related inputs into one record
        if (isFinalAnswer) {
            return await trackConsolidatedInput(attempt, inputName, inputValue, inputType, validationResult);
        }
        
        // Skip regular input tracking - only track final answers
        return null;

    } catch (error) {
        console.error('Input tracking failed:', error);
        return null;
    }
}

// Track consolidated final answer (groups matrix/complex inputs)
async function trackConsolidatedInput(attempt, inputName, inputValue, inputType, validationResult) {
    // Check if we already have a final answer record for this input
    const { data: existing, error: queryError } = await window.supabase
        .from('input_tracking')
        .select('id')
        .eq('attempt_id', attempt)
        .eq('input_name', inputName)
        .eq('is_final_answer', true)
        .maybeSingle();
    
    if (existing) {
        // Update existing final answer record
        const { data, error } = await window.supabase
            .from('input_tracking')
            .update({
                input_value: inputValue,
                validation_result: validationResult
            })
            .eq('id', existing.id)
            .select()
            .single();
            
        if (error) {
            console.error('Error updating consolidated input:', error);
            return null;
        }
        return data;
    } else {
        // Create new final answer record
        const { data, error } = await window.supabase
            .from('input_tracking')
            .insert([
                {
                    attempt_id: attempt,
                    session_id: currentSession,
                    input_name: inputName,
                    input_value: inputValue,
                    input_type: inputType,
                    is_final_answer: true,
                    validation_result: validationResult
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating consolidated input:', error);
            return null;
        }
        return data;
    }
}

// Track regular input interactions (with throttling)
async function trackRegularInput(attempt, inputName, inputValue, inputType, validationResult) {
    // Only track significant changes, not every keystroke
    if (inputValue === '' || inputValue === 'EMPTY') {
        return null; // Skip empty values
    }
    
    const { data, error } = await window.supabase
        .from('input_tracking')
        .insert([
            {
                attempt_id: attempt.id,
                session_id: currentSession.id,
                input_name: inputName,
                input_value: inputValue,
                input_type: inputType,
                is_final_answer: false,
                validation_result: validationResult
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('Error tracking regular input:', error);
        return null;
    }
    return data;
}

// End current session
async function endDatabaseSession() {
    if (!window.supabase || !currentSession) {
        return;
    }

    try {
        const { error } = await window.supabase
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