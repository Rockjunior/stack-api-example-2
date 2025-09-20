-- Migration script to change from UUID to incremental integer IDs
-- WARNING: This will require updating all foreign key references

-- Step 1: Create new tables with incremental IDs
-- Note: We'll need to migrate data and update foreign keys

-- 1. Create new learning_sessions table with incremental ID
CREATE TABLE learning_sessions_new (
  id SERIAL PRIMARY KEY,  -- This creates auto-incrementing integers: 1, 2, 3, 4...
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  session_start TIMESTAMP DEFAULT NOW(),
  session_end TIMESTAMP,
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create new question_attempts table with incremental ID
CREATE TABLE question_attempts_new (
  id SERIAL PRIMARY KEY,  -- Auto-incrementing: 1, 2, 3, 4...
  session_id INTEGER REFERENCES learning_sessions_new(id) NOT NULL,  -- Now references INTEGER
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  question_file TEXT,
  question_name TEXT,
  question_prefix TEXT,
  seed INTEGER,
  started_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  score DECIMAL(5,2),
  max_score DECIMAL(5,2),
  is_correct BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create new input_tracking table with incremental ID
CREATE TABLE input_tracking_new (
  id SERIAL PRIMARY KEY,  -- Auto-incrementing: 1, 2, 3, 4...
  attempt_id INTEGER REFERENCES question_attempts_new(id) NOT NULL,  -- Now references INTEGER
  session_id INTEGER REFERENCES learning_sessions_new(id) NOT NULL,  -- Now references INTEGER
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  input_name TEXT,
  input_value TEXT,
  input_type TEXT,
  is_final_answer BOOLEAN DEFAULT FALSE,
  validation_result TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Migrate existing data (if any exists)
-- Note: This creates a mapping between old UUIDs and new incremental IDs

-- Migrate learning_sessions
INSERT INTO learning_sessions_new (user_id, session_start, session_end, page_url, user_agent, created_at)
SELECT user_id, session_start, session_end, page_url, user_agent, created_at
FROM learning_sessions
ORDER BY created_at;  -- Maintain chronological order

-- Create a temporary mapping table for session ID conversion
CREATE TEMPORARY TABLE session_id_mapping AS
SELECT 
  old.id as old_id,
  new.id as new_id
FROM learning_sessions old
JOIN learning_sessions_new new ON (
  old.user_id = new.user_id 
  AND old.session_start = new.session_start
  AND old.created_at = new.created_at
);

-- Migrate question_attempts with new session_id references
INSERT INTO question_attempts_new (session_id, user_id, question_file, question_name, question_prefix, seed, started_at, submitted_at, score, max_score, is_correct, created_at)
SELECT 
  sim.new_id,  -- Use new incremental session_id
  qa.user_id, 
  qa.question_file, 
  qa.question_name, 
  qa.question_prefix, 
  qa.seed, 
  qa.started_at, 
  qa.submitted_at, 
  qa.score, 
  qa.max_score, 
  qa.is_correct, 
  qa.created_at
FROM question_attempts qa
JOIN session_id_mapping sim ON qa.session_id = sim.old_id
ORDER BY qa.created_at;

-- Create a temporary mapping table for attempt ID conversion
CREATE TEMPORARY TABLE attempt_id_mapping AS
SELECT 
  old.id as old_id,
  new.id as new_id
FROM question_attempts old
JOIN question_attempts_new new ON (
  old.user_id = new.user_id 
  AND old.question_prefix = new.question_prefix
  AND old.created_at = new.created_at
);

-- Migrate input_tracking with new attempt_id and session_id references
INSERT INTO input_tracking_new (attempt_id, session_id, user_id, input_name, input_value, input_type, is_final_answer, validation_result, created_at)
SELECT 
  aim.new_id,  -- Use new incremental attempt_id
  sim.new_id,  -- Use new incremental session_id
  it.user_id,
  it.input_name,
  it.input_value,
  it.input_type,
  it.is_final_answer,
  it.validation_result,
  it.created_at
FROM input_tracking it
JOIN attempt_id_mapping aim ON it.attempt_id = aim.old_id
JOIN session_id_mapping sim ON it.session_id = sim.old_id
ORDER BY it.created_at;

-- Step 3: Replace old tables with new ones
-- WARNING: This will drop existing data! Make sure migration worked correctly first!

/*
-- Uncomment these lines only after verifying the migration worked:

DROP TABLE input_tracking CASCADE;
DROP TABLE question_attempts CASCADE;  
DROP TABLE learning_sessions CASCADE;

ALTER TABLE learning_sessions_new RENAME TO learning_sessions;
ALTER TABLE question_attempts_new RENAME TO question_attempts;
ALTER TABLE input_tracking_new RENAME TO input_tracking;
*/

-- Step 4: Recreate indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions_new(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_id ON question_attempts_new(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_session_id ON question_attempts_new(session_id);
CREATE INDEX IF NOT EXISTS idx_input_tracking_user_id ON input_tracking_new(user_id);
CREATE INDEX IF NOT EXISTS idx_input_tracking_attempt_id ON input_tracking_new(attempt_id);
CREATE INDEX IF NOT EXISTS idx_input_tracking_session_id ON input_tracking_new(session_id);

-- Step 5: Update RLS policies for new tables
ALTER TABLE learning_sessions_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE input_tracking_new ENABLE ROW LEVEL SECURITY;

-- Learning sessions policies
CREATE POLICY "Users can view own sessions" ON learning_sessions_new FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON learning_sessions_new FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON learning_sessions_new FOR UPDATE USING (auth.uid() = user_id);

-- Question attempts policies
CREATE POLICY "Users can view own attempts" ON question_attempts_new FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON question_attempts_new FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON question_attempts_new FOR UPDATE USING (auth.uid() = user_id);

-- Input tracking policies
CREATE POLICY "Users can view own input tracking" ON input_tracking_new FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own input tracking" ON input_tracking_new FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Verification queries to check the migration
-- Run these to verify everything worked correctly:
/*
SELECT 'learning_sessions' as table_name, count(*) as record_count FROM learning_sessions_new
UNION ALL
SELECT 'question_attempts' as table_name, count(*) as record_count FROM question_attempts_new  
UNION ALL
SELECT 'input_tracking' as table_name, count(*) as record_count FROM input_tracking_new;

-- Check that IDs are now incremental
SELECT 'learning_sessions' as table_name, min(id) as min_id, max(id) as max_id FROM learning_sessions_new
UNION ALL
SELECT 'question_attempts' as table_name, min(id) as min_id, max(id) as max_id FROM question_attempts_new
UNION ALL  
SELECT 'input_tracking' as table_name, min(id) as min_id, max(id) as max_id FROM input_tracking_new;
*/
