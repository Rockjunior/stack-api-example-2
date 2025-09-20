// Database operations for STACK API question tracking
// Handles authenticated user session tracking and question interaction logging

// Global variables for session tracking
let currentSession = null;
let currentAttempts = {}; // Track attempts by question prefix

// Get authenticated user identifier without forcing redirects
function getAuthenticatedUserId() {
    // Prefer Supabase auth if available
    if (window.authManager && window.authManager.currentUser) {
        const supaUser = window.authManager.currentUser;
        console.log('🔐 Using Supabase auth user:', supaUser.id);
        return supaUser.id || supaUser.email || null;
    }

    // Fallback to local session used by simple login
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        try {
            const userData = JSON.parse(currentUser);
            console.log('🔐 Using localStorage user:', userData.id || userData.email);
            return userData.id || userData.email || null;
        } catch (error) {
            console.error('❌ Error parsing user data:', error);
            return null;
        }
    }
    
    console.warn('⚠️ No authenticated user found - database tracking will be limited');
    return null;
}

// Initialize database session when page loads
async function initializeDatabaseSession() {
    try {
        const userId = getAuthenticatedUserId();
        if (!userId) {
            console.warn('⚠️ No authenticated user - database tracking disabled');
            return null;
        }
        
        // Use authenticated API endpoint instead of direct Supabase client
        const response = await fetch('http://localhost:3000/session/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authManager?.getAccessToken() || ''}`
            },
            body: JSON.stringify({
                page_url: window.location.href
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Session creation failed:', errorData);
            return null;
        }

        const result = await response.json();
        if (result.success) {
            currentSession = result.session.id;
            console.log('✅ Database session initialized:', currentSession);
            return result.session;
        } else {
            console.error('❌ Session creation failed:', result.error);
            return null;
        }

    } catch (error) {
        console.error('❌ Database session initialization failed:', error);
        return null;
    }
}

// Create question attempt record
async function createQuestionAttempt(qfile, qname, qprefix, seed) {
    if (!currentSession) {
        console.warn('⚠️ No active session - question attempt tracking disabled');
        return null;
    }
    
    try {
        // Use authenticated API endpoint
        const response = await fetch('http://localhost:3000/attempt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authManager?.getAccessToken() || ''}`
            },
            body: JSON.stringify({
                session_id: currentSession,
                question_file: qfile,
                question_name: qname || '',
                question_prefix: qprefix,
                seed: seed,
                score: null,
                max_score: null,
                is_correct: null
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Question attempt creation failed:', errorData);
            return null;
        }

        const result = await response.json();
        if (result.success) {
            console.log('✅ Question attempt created:', result.attempt.id);
            currentAttempts[qprefix] = result.attempt.id;
            return result.attempt.id;
        } else {
            console.error('❌ Question attempt creation failed:', result.error);
            return null;
        }
    } catch (error) {
        console.error('❌ Error creating question attempt:', error);
        return null;
    }
}

// Update question attempt with submission results
async function updateQuestionAttempt(qprefix, score, maxScore, isCorrect) {
    if (!currentAttempts[qprefix]) {
        console.warn('⚠️ No question attempt to update for prefix:', qprefix);
        console.warn('Current attempts:', currentAttempts);
        return null;
    }

    try {
        const attemptId = currentAttempts[qprefix];
        console.log('📊 Updating question attempt:', {
            attemptId,
            qprefix,
            score,
            maxScore,
            isCorrect
        });

        // Use authenticated API endpoint for updates
        const response = await fetch(`http://localhost:3000/attempt/${attemptId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authManager?.getAccessToken() || ''}`
            },
            body: JSON.stringify({
                score: score,
                max_score: maxScore,
                is_correct: isCorrect
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Question attempt update failed:', errorData);
            return null;
        }

        const result = await response.json();
        if (result.success) {
            console.log('✅ Question attempt updated successfully:', result.attempt);
            return result.attempt;
        } else {
            console.error('❌ Question attempt update failed:', result.error);
            return null;
        }
    } catch (error) {
        console.error('❌ Question attempt update failed:', error);
        return null;
    }
}

// Track input interactions
async function trackInput(qprefix, inputName, inputValue, inputType, isFinalAnswer = false, validationResult = null) {
    if (!currentSession) {
        console.warn('⚠️ No active session - input tracking disabled');
        return null;
    }

    // Ensure we have a valid attempt before tracking
    if (!currentAttempts[qprefix]) {
        console.warn('No question attempt found for input tracking, skipping:', qprefix);
        return null;
    }

    try {
        const attemptId = currentAttempts[qprefix];
        
        console.log('📝 Tracking input:', {
            qprefix,
            attemptId,
            inputName,
            inputValue: inputValue?.substring(0, 100) + (inputValue?.length > 100 ? '...' : ''),
            inputType,
            isFinalAnswer
        });
        
        // Use authenticated API endpoint for input tracking
        const response = await fetch('http://localhost:3000/input', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authManager?.getAccessToken() || ''}`
            },
            body: JSON.stringify({
                attempt_id: attemptId,
                session_id: currentSession,
                input_name: inputName,
                input_value: inputValue,
                input_type: inputType,
                is_final_answer: isFinalAnswer,
                validation_result: validationResult
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Input tracking failed:', errorData);
            return null;
        }

        const result = await response.json();
        if (result.success) {
            console.log('✅ Input tracked successfully:', result.input);
            return result.input;
        } else {
            console.error('❌ Input tracking failed:', result.error);
            return null;
        }

    } catch (error) {
        console.error('❌ Input tracking failed:', error);
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
                attempt_id: attempt,
                session_id: currentSession,
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
            .eq('id', currentSession);

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