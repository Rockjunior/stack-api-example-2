// index.js
import express from "express";
import bodyParser from "body-parser";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

// Add CORS middleware
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ];
  const requestOrigin = req.headers.origin;

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    // Always succeed preflight
    return res.status(204).end();
  }
  next();
});

// Explicit OPTIONS handler for all routes (extra safety for some proxies)
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  return res.status(204).end();
});

// --- Supabase setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // use service role key for writes
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // for client-side auth

// Add connection validation
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to authenticate user from JWT token
const authenticateUser = async (req, res, next) => {
  // Never authenticate preflight requests
  if (req.method === 'OPTIONS') {
    return next();
  }
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Test database connection
async function testConnection() {
    try {
        const { data, error } = await supabase.from('learning_sessions').select('count').limit(1);
        if (error) throw error;
        console.log('✅ Successfully connected to Supabase database');
    } catch (err) {
        console.error('❌ Failed to connect to Supabase database:', err.message);
    }
}

testConnection();

// -------------------------
// Authentication Endpoints
// -------------------------

// Sign up endpoint
app.post("/auth/signup", async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;

        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Create user with Supabase Auth including metadata
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm for simplicity
            user_metadata: {
                first_name: firstName,
                last_name: lastName,
                full_name: `${firstName} ${lastName}`
            }
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        // Extract user metadata (fallback to req.body if metadata is missing)
        const userMetadata = authData.user.user_metadata || {};
        const userFirstName = userMetadata.first_name || firstName;
        const userLastName = userMetadata.last_name || lastName;
        const userFullName = userMetadata.full_name || `${userFirstName} ${userLastName}`;

        console.log('📝 Creating user profile with data:', {
            id: authData.user.id,
            email: authData.user.email,
            first_name: userFirstName,
            last_name: userLastName,
            full_name: userFullName
        });

        // Create user profile with proper data (exclude full_name as it's generated)
        const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .insert({
                id: authData.user.id,
                email: authData.user.email,
                first_name: userFirstName,
                last_name: userLastName
            })
            .select()
            .single();

        if (profileError) {
            console.error('❌ Profile creation error:', profileError);
            // User was created but profile failed - this should be handled by the trigger
            return res.status(500).json({ error: 'Failed to create user profile' });
        }

        console.log('✅ User profile created successfully:', profileData);

        res.json({
            message: 'User created successfully',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                firstName: userFirstName,
                lastName: userLastName,
                fullName: userFullName
            }
        });

    } catch (error) {
        console.error('❌ Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sign in endpoint
app.post("/auth/signin", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        res.json({
            message: 'Sign in successful',
            user: data.user,
            profile: profile,
            session: data.session
        });

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user profile endpoint
app.get("/auth/profile", authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json({ profile: data });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile endpoint
app.put("/auth/profile", authenticateUser, async (req, res) => {
    try {
        const { first_name, last_name } = req.body;
        
        const { data, error } = await supabase
            .from('user_profiles')
            .update({ 
                first_name, 
                last_name,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        res.json({ 
            message: 'Profile updated successfully',
            profile: data 
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sign out endpoint (client-side handles token removal)
app.post("/auth/signout", authenticateUser, async (req, res) => {
    try {
        // With JWT tokens, signout is primarily handled client-side
        // But we can log the signout event or perform cleanup here
        res.json({ message: 'Signed out successfully' });
    } catch (error) {
        console.error('Signout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// -------------------------
// Protected Learning Session Endpoints
// -------------------------
// 1. Start a learning session
app.post("/session/start", authenticateUser, async (req, res) => {
    try {
        const { page_url } = req.body;
        const user_agent = req.headers["user-agent"];
        const user_id = req.user.id;

        const { data, error } = await supabase
            .from("learning_sessions")
            .insert([
                { page_url, user_id, user_agent }
            ])
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, session: data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// 2. Record a question attempt
app.post("/attempt", authenticateUser, async (req, res) => {
    try {
        const {
            session_id,
            question_file,
            question_name,
            question_prefix,
            seed,
            score,
            max_score,
            is_correct
        } = req.body;
        const user_id = req.user.id;

        const { data, error } = await supabase
            .from("question_attempts")
            .insert([
                {
                    session_id,
                    user_id,
                    question_file,
                    question_name,
                    question_prefix,
                    seed,
                    score,
                    max_score,
                    is_correct
                }
            ])
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, attempt: data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Update question attempt endpoint
app.put("/attempt/:attemptId", authenticateUser, async (req, res) => {
    try {
        const { attemptId } = req.params;
        const { score, max_score, is_correct } = req.body;
        const user_id = req.user.id;

        console.log('📊 Updating attempt:', {
            attemptId,
            score,
            max_score,
            is_correct,
            user_id
        });

        const { data, error } = await supabase
            .from("question_attempts")
            .update({
                submitted_at: new Date().toISOString(),
                score,
                max_score,
                is_correct
            })
            .eq('id', attemptId)
            .eq('user_id', user_id) // Ensure user can only update their own attempts
            .select()
            .single();

        if (error) {
            console.error('❌ Attempt update error:', error);
            throw error;
        }

        console.log('✅ Attempt updated successfully:', data);
        res.json({ success: true, attempt: data });
    } catch (err) {
        console.error('❌ Attempt update failed:', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// 3. Track inputs
app.post("/input", authenticateUser, async (req, res) => {
    try {
        const {
            attempt_id,
            session_id,
            input_name,
            input_value,
            input_type,
            is_final_answer,
            validation_result
        } = req.body;
        const user_id = req.user.id;

        console.log('🔍 Input tracking request:', {
            attempt_id,
            session_id,
            input_name,
            input_value,
            input_type,
            is_final_answer,
            validation_result
        });

        const { data, error } = await supabase
            .from("input_tracking")
            .insert([
                {
                    attempt_id,
                    session_id,
                    user_id,
                    input_name,
                    input_value,
                    input_type,
                    is_final_answer,
                    validation_result
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('❌ Supabase insert error:', error);
            throw error;
        }

        console.log('✅ Input tracking success:', data);
        res.json({ success: true, input: data });
    } catch (err) {
        console.error('❌ Input tracking failed:', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// Simple in-memory cache for AI responses
const aiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// 4. AI Feedback using ChatGPT
app.post("/ai/feedback", async (req, res) => {
    try {
        const {
            userAnswers,
            correctAnswer,
            generalFeedback,
            questionName,
            questionText,
            questionType,
            additionalContext,
            score,
            maxScore,
            isCorrect
        } = req.body;

        // Create cache key from request data
        const cacheKey = JSON.stringify({
            userAnswers,
            correctAnswer,
            questionText: questionText?.substring(0, 200), // Limit for key size
            isCorrect
        });

        // Check cache first
        const cached = aiCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            console.log('✅ AI Cache hit - returning cached response');
            return res.json({ success: true, feedback: cached.response });
        }

        // Build the prompt based on your sample code
        const userInput = typeof userAnswers === 'object' ? 
            Object.values(userAnswers).join(', ') : 
            String(userAnswers);
        
        const rightSolution = correctAnswer || generalFeedback || "No solution provided";
        const question = questionText || questionName || "Question not provided";
        
        const systemPrompt = `You are an expert mathematics tutor providing detailed, contextual feedback to students. 

        CRITICAL: Always complete your thoughts and examples. Never cut off mid-sentence or leave examples incomplete. If you start an explanation or example, finish it completely within the response.

        For INCORRECT answers, provide:
        **Assessment:** What specifically went wrong in their approach
        **Step-by-Step Solution:** Complete walkthrough showing the correct method for THIS specific problem
        **Key Concept:** The main mathematical principle they need to understand
        **Practice Tips:** Specific advice for mastering this type of problem

        For CORRECT answers, provide:
        **Assessment:** Acknowledge their correct reasoning
        **Method Analysis:** Explain why their approach works mathematically
        **Alternative Approaches:** Other valid methods for this specific problem type
        **Next Level:** Related concepts or extensions they could explore

        Always:
        - Reference the specific mathematical content of the question
        - Use precise mathematical terminology
        - Provide concrete examples relevant to the problem type
        - Be encouraging but mathematically rigorous
        - Complete all examples and explanations within the response`;

        // TODO: Try this one.

        // const systemPrompt = `You are an expert mathematics tutor who explains concepts to students in a clear, 
        //     step-by-step way, just like a structured textbook or study guide.

        //     CRITICAL: Responses must never exceed 400 words. Always keep answers complete but concise, 
        //     so they do not get truncated.

        //     For each problem:
        //     1. Restate the original problem in simple words so the student understands the task.
        //     2. Provide a clear, step-by-step solution written in a logical sequence. 
        //     - Always finish the worked example. 
        //     - Use equations, simplifications, and final answers explicitly.
        //     3. Highlight the key concept the student should learn from this example. 
        //     (e.g., "This is how partial fractions are used to rewrite a rational function.")
        //     4. End with a short practice tip that helps the student apply the concept on their own.

        //     Always:
        //     - Write explanations as if the student is reading a math textbook (not as feedback about 
        //     their performance).
        //     - Use correct mathematical terminology and clear formatting.
        //     - Be encouraging, but focused on the method.
        //     - Ensure the solution and explanation fit fully within the 400-word limit.`;

        const contextInfo = `
            **Question Type:** ${questionType || 'Unknown'}
            **Additional Context:** ${additionalContext || 'None'}
            **General System Feedback:** ${generalFeedback || 'None'}`;

        const message = `Analyze this specific mathematical problem and provide targeted educational feedback:

            **Question:** ${question}
            ${contextInfo}

            **Student's Answer:** ${userInput}
            **Expected Solution:** ${rightSolution}
            **Performance:** ${score}/${maxScore} (${isCorrect ? 'Correct' : 'Incorrect'})

            ${isCorrect ? 
            'The student answered correctly. Explain their mathematical reasoning, show alternative solution methods for this specific problem type, and suggest related concepts they could explore.' : 
            'The student answered incorrectly. Provide a complete step-by-step solution for this specific problem, identify what went wrong in their approach, explain the key mathematical concepts involved, and give targeted practice advice.'
            }

            Focus on the specific mathematical content and problem-solving techniques relevant to this exact question.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                max_tokens: 800,
                temperature: 0.5,
                n: 1,
                stream: false
            }),
            timeout: 30000 // 30 second timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`OpenAI API error details: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const aiData = await response.json();
        let aiResponse = aiData.choices[0].message.content;
        
        // Check if response was truncated due to token limit
        if (aiData.choices[0].finish_reason === 'length') {
            console.warn('⚠️ AI response was truncated due to token limit');
            aiResponse += '\n\n[Response was truncated due to length limit. Please ask for continuation if needed.]';
        }
        
        aiResponse = aiResponse.trim();

        // Cache the response
        aiCache.set(cacheKey, {
            response: aiResponse,
            timestamp: Date.now()
        });

        // Clean old cache entries (simple cleanup)
        if (aiCache.size > 100) {
            const oldestKey = aiCache.keys().next().value;
            aiCache.delete(oldestKey);
        }

        console.log('✅ AI feedback generated and cached');
        res.json({ success: true, feedback: aiResponse });
    } catch (err) {
        console.error('❌ AI feedback error:', err.message);
        console.error('❌ Full error details:', err);
        
        // Provide fallback response if OpenAI fails
        const fallbackResponse = isCorrect 
            ? "Great work! You got the correct answer. Keep practicing similar problems to strengthen your understanding."
            : "This answer needs some work. Please review the problem carefully and try a different approach. Consider the key concepts involved and work through the steps systematically.";
            
        res.json({ 
            success: true, 
            feedback: fallbackResponse,
            fallback: true 
        });
    }
});

// -------------------------
// Database Query Endpoints for Debugging
// -------------------------

// Get all learning sessions (simple query)
app.get("/debug/sessions", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('learning_sessions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.json({ success: true, sessions: data, count: data.length });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get all user profiles
app.get("/debug/users", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, users: data, count: data.length });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get all question attempts (simple query)
app.get("/debug/attempts", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('question_attempts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        res.json({ success: true, attempts: data, count: data.length });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get all input tracking (simple query)
app.get("/debug/inputs", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('input_tracking')
            .select('*')
            .limit(20);

        if (error) throw error;
        res.json({ success: true, inputs: data, count: data.length });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get detailed view of a specific session and all related data
app.get("/debug/session/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // Get session details
        const { data: session, error: sessionError } = await supabase
            .from('learning_sessions')
            .select(`
                *,
                user_profiles(email, first_name, last_name)
            `)
            .eq('id', sessionId)
            .single();

        if (sessionError) throw sessionError;

        // Get all attempts for this session
        const { data: attempts, error: attemptsError } = await supabase
            .from('question_attempts')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });

        if (attemptsError) throw attemptsError;

        // Get all inputs for this session
        const { data: inputs, error: inputsError } = await supabase
            .from('input_tracking')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });

        if (inputsError) throw inputsError;

        res.json({ 
            success: true, 
            session, 
            attempts, 
            inputs,
            summary: {
                total_attempts: attempts.length,
                total_inputs: inputs.length,
                completed_attempts: attempts.filter(a => a.score !== null).length,
                final_answers: inputs.filter(i => i.is_final_answer).length
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get database schema info
app.get("/debug/schema", async (req, res) => {
    try {
        // Get table info for our main tables
        const tables = ['learning_sessions', 'question_attempts', 'input_tracking', 'user_profiles'];
        const schema = {};

        for (const table of tables) {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .limit(1);
            
            if (!error && data.length > 0) {
                schema[table] = {
                    columns: Object.keys(data[0]),
                    sample_record: data[0]
                };
            } else {
                schema[table] = { columns: [], sample_record: null, error: error?.message };
            }
        }

        res.json({ success: true, schema });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get incomplete question attempts (started but not submitted)
app.get("/debug/incomplete-attempts", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('question_attempts')
            .select('*')
            .is('submitted_at', null)
            .order('started_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        res.json({ 
            success: true, 
            incomplete_attempts: data, 
            count: data.length,
            message: `Found ${data.length} incomplete attempts (started but not submitted)`
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Get completion statistics
app.get("/debug/stats", async (req, res) => {
    try {
        // Get total attempts
        const { count: totalAttempts } = await supabase
            .from('question_attempts')
            .select('*', { count: 'exact', head: true });

        // Get completed attempts
        const { count: completedAttempts } = await supabase
            .from('question_attempts')
            .select('*', { count: 'exact', head: true })
            .not('submitted_at', 'is', null);

        // Get correct attempts
        const { count: correctAttempts } = await supabase
            .from('question_attempts')
            .select('*', { count: 'exact', head: true })
            .eq('is_correct', true);

        const completionRate = totalAttempts > 0 ? (completedAttempts / totalAttempts * 100).toFixed(1) : 0;
        const successRate = completedAttempts > 0 ? (correctAttempts / completedAttempts * 100).toFixed(1) : 0;

        res.json({
            success: true,
            stats: {
                total_attempts: totalAttempts,
                completed_attempts: completedAttempts,
                incomplete_attempts: totalAttempts - completedAttempts,
                correct_attempts: correctAttempts,
                completion_rate: `${completionRate}%`,
                success_rate: `${successRate}%`
            }
        });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Fix existing users with empty names
app.post("/debug/fix-user-profiles", async (req, res) => {
    try {
        // Get all users with empty names
        const { data: emptyProfiles, error: fetchError } = await supabase
            .from('user_profiles')
            .select('*')
            .or('first_name.eq.,last_name.eq.,full_name.eq. ');

        if (fetchError) throw fetchError;

        console.log('🔍 Found users with empty names:', emptyProfiles.length);

        const fixes = [];
        for (const profile of emptyProfiles) {
            // Try to get user metadata from auth
            const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
            
            if (authError) {
                console.error(`❌ Could not fetch auth data for user ${profile.id}:`, authError);
                continue;
            }

            const userMetadata = authUser.user?.user_metadata || {};
            const firstName = userMetadata.first_name || 'User';
            const lastName = userMetadata.last_name || profile.email.split('@')[0];
            const fullName = userMetadata.full_name || `${firstName} ${lastName}`;

            // Update the profile (exclude full_name as it's a generated column)
            const { data: updatedProfile, error: updateError } = await supabase
                .from('user_profiles')
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id)
                .select()
                .single();

            if (updateError) {
                console.error(`❌ Failed to update profile for user ${profile.id}:`, updateError);
                fixes.push({ id: profile.id, status: 'failed', error: updateError.message });
            } else {
                console.log(`✅ Fixed profile for user ${profile.id}:`, updatedProfile);
                fixes.push({ id: profile.id, status: 'success', data: updatedProfile });
            }
        }

        res.json({ 
            success: true, 
            message: `Processed ${emptyProfiles.length} users`,
            fixes 
        });
    } catch (err) {
        console.error('❌ Fix user profiles error:', err);
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------------------------
// Health check
// -------------------------
app.get("/", (req, res) => {
    res.send("Supabase API is running ✅");
});

// -------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});
