-- Complete database schema with authentication

-- 1. User profiles table (extends Supabase auth.users)
-- The auth.users table is automatically created by Supabase Auth
-- It contains: id (UUID), email, encrypted_password, email_confirmed_at, etc.

CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Update existing learning_sessions table to add authentication
-- Add user_id column to link sessions to authenticated users
ALTER TABLE learning_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id NOT NULL after adding it (you may need to populate existing records first)
-- ALTER TABLE learning_sessions ALTER COLUMN user_id SET NOT NULL;

-- 3. Update existing question_attempts table to add authentication  
-- Add user_id column for direct user reference (makes queries easier)
ALTER TABLE question_attempts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id NOT NULL after adding it (you may need to populate existing records first)
-- ALTER TABLE question_attempts ALTER COLUMN user_id SET NOT NULL;

-- 4. Update existing input_tracking table to add authentication
-- Add user_id column for direct user reference
ALTER TABLE input_tracking 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make user_id NOT NULL after adding it (you may need to populate existing records first)
-- ALTER TABLE input_tracking ALTER COLUMN user_id SET NOT NULL;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_id ON question_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_session_id ON question_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_input_tracking_user_id ON input_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_input_tracking_attempt_id ON input_tracking(attempt_id);
CREATE INDEX IF NOT EXISTS idx_input_tracking_session_id ON input_tracking(session_id);

-- RLS (Row Level Security) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE input_tracking ENABLE ROW LEVEL SECURITY;

-- User profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Learning sessions policies (only create if user_id column exists and is NOT NULL)
DROP POLICY IF EXISTS "Users can view own sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON learning_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON learning_sessions;

-- Note: These policies will only work after user_id is made NOT NULL
-- Uncomment after running the migration:
/*
CREATE POLICY "Users can view own sessions" ON learning_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON learning_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON learning_sessions FOR UPDATE USING (auth.uid() = user_id);
*/

-- Question attempts policies (only create if user_id column exists and is NOT NULL)
DROP POLICY IF EXISTS "Users can view own attempts" ON question_attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON question_attempts;
DROP POLICY IF EXISTS "Users can update own attempts" ON question_attempts;

-- Note: These policies will only work after user_id is made NOT NULL
-- Uncomment after running the migration:
/*
CREATE POLICY "Users can view own attempts" ON question_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON question_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attempts" ON question_attempts FOR UPDATE USING (auth.uid() = user_id);
*/

-- Input tracking policies (only create if user_id column exists and is NOT NULL)
DROP POLICY IF EXISTS "Users can view own input tracking" ON input_tracking;
DROP POLICY IF EXISTS "Users can insert own input tracking" ON input_tracking;

-- Note: These policies will only work after user_id is made NOT NULL
-- Uncomment after running the migration:
/*
CREATE POLICY "Users can view own input tracking" ON input_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own input tracking" ON input_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
*/

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name)
  VALUES (new.id, new.email, '', '');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update user profile updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles updated_at
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
