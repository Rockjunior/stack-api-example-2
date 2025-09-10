// index.js
import express from "express";
import bodyParser from "body-parser";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// --- Supabase setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // use service role key for writes

// Add connection validation
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
// 1. Start a learning session
// -------------------------
app.post("/session/start", async (req, res) => {
    try {
        const { page_url, anonymous_id } = req.body;
        const user_agent = req.headers["user-agent"];

        const { data, error } = await supabase
            .from("learning_sessions")
            .insert([
                { page_url, anonymous_id, user_agent }
            ])
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, session: data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------------------------
// 2. Record a question attempt
// -------------------------
app.post("/attempt", async (req, res) => {
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

        const { data, error } = await supabase
            .from("question_attempts")
            .insert([
                {
                    session_id,
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

// -------------------------
// 3. Track inputs
// -------------------------
app.post("/input", async (req, res) => {
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

// -------------------------
// 4. AI Feedback using ChatGPT
// -------------------------
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
