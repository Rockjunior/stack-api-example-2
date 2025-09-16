-- Migration script for existing tables to add authentication
-- Run this AFTER creating user accounts for existing anonymous data

-- Step 1: Add user_id columns (already done in main schema)
-- These columns are added as nullable first to allow existing data to remain

-- Step 2: Data Migration (if you have existing anonymous data)
-- You'll need to decide how to handle existing anonymous data:

-- Option A: Delete existing anonymous data (simplest)
/*
DELETE FROM input_tracking WHERE user_id IS NULL;
DELETE FROM question_attempts WHERE user_id IS NULL;
DELETE FROM learning_sessions WHERE user_id IS NULL;
*/

-- Option B: Create a default "anonymous" user and assign existing data to it
/*
-- Create an anonymous user account first in Supabase Auth UI, then:
-- UPDATE learning_sessions SET user_id = 'your-anonymous-user-uuid' WHERE user_id IS NULL;
-- UPDATE question_attempts SET user_id = 'your-anonymous-user-uuid' WHERE user_id IS NULL;
-- UPDATE input_tracking SET user_id = 'your-anonymous-user-uuid' WHERE user_id IS NULL;
*/

-- Option C: Leave existing data as is and only track new authenticated data
-- (Keep user_id nullable and handle nulls in application logic)

-- Step 3: Make user_id columns NOT NULL (only after handling existing data)
-- Uncomment these lines after you've handled existing anonymous data:

/*
ALTER TABLE learning_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE question_attempts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE input_tracking ALTER COLUMN user_id SET NOT NULL;
*/

-- Step 4: Add additional indexes for the new user_id columns
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_id ON question_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_input_tracking_user_id ON input_tracking(user_id);

-- Step 5: Enable RLS and add policies for existing tables
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE input_tracking ENABLE ROW LEVEL SECURITY;

-- Learning sessions policies
DROP POLICY IF EXISTS "Users can view own sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON learning_sessions;

CREATE POLICY "Users can view own sessions" ON learning_sessions 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON learning_sessions 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON learning_sessions 
FOR UPDATE USING (auth.uid() = user_id);

-- Question attempts policies
DROP POLICY IF EXISTS "Users can view own attempts" ON question_attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON question_attempts;
DROP POLICY IF EXISTS "Users can update own attempts" ON question_attempts;

CREATE POLICY "Users can view own attempts" ON question_attempts 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts" ON question_attempts 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts" ON question_attempts 
FOR UPDATE USING (auth.uid() = user_id);

-- Input tracking policies
DROP POLICY IF EXISTS "Users can view own input tracking" ON input_tracking;
DROP POLICY IF EXISTS "Users can insert own input tracking" ON input_tracking;

CREATE POLICY "Users can view own input tracking" ON input_tracking 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own input tracking" ON input_tracking 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Step 6: Update any existing foreign key constraints if needed
-- (This may not be necessary depending on your current schema)
