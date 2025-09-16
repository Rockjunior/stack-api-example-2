# Database Migration Guide for Existing Tables

Since you already have the three tables (`learning_sessions`, `question_attempts`, `input_tracking`), here's the step-by-step process to add authentication:

## Step 1: Create User Profiles Table
Run this first to create the user profiles table:

```sql
-- 1. User profiles table (extends Supabase auth.users)
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

-- User profiles policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS handle_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
```

## Step 2: Add user_id Columns to Existing Tables
Run these ALTER TABLE statements:

```sql
-- Add user_id columns to existing tables
ALTER TABLE learning_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE question_attempts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE input_tracking 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_user_id ON question_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_input_tracking_user_id ON input_tracking(user_id);
```

## Step 3: Handle Existing Anonymous Data
You have three options for existing anonymous data:

### Option A: Delete Existing Anonymous Data (Recommended if data is not important)
```sql
DELETE FROM input_tracking WHERE user_id IS NULL;
DELETE FROM question_attempts WHERE user_id IS NULL;
DELETE FROM learning_sessions WHERE user_id IS NULL;
```

### Option B: Create Default Anonymous User (If you want to preserve data)
1. First, create a user account in Supabase Auth UI with email like `anonymous@example.com`
2. Get the user UUID from the auth.users table
3. Update existing records:

```sql
-- Replace 'your-anonymous-user-uuid' with the actual UUID
UPDATE learning_sessions SET user_id = 'your-anonymous-user-uuid' WHERE user_id IS NULL;
UPDATE question_attempts SET user_id = 'your-anonymous-user-uuid' WHERE user_id IS NULL;
UPDATE input_tracking SET user_id = 'your-anonymous-user-uuid' WHERE user_id IS NULL;
```

### Option C: Keep Existing Data As-Is
- Leave the user_id columns nullable
- Handle NULL values in your application code
- Only new data will be linked to authenticated users

## Step 4: Make user_id Columns NOT NULL (Only if you chose Option A or B)
```sql
-- Only run these if you've handled all NULL values
ALTER TABLE learning_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE question_attempts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE input_tracking ALTER COLUMN user_id SET NOT NULL;
```

## Step 5: Enable Row Level Security and Policies
```sql
-- Enable RLS on existing tables
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE input_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies for learning_sessions
CREATE POLICY "Users can view own sessions" ON learning_sessions 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON learning_sessions 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON learning_sessions 
FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for question_attempts
CREATE POLICY "Users can view own attempts" ON question_attempts 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts" ON question_attempts 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts" ON question_attempts 
FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for input_tracking
CREATE POLICY "Users can view own input tracking" ON input_tracking 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own input tracking" ON input_tracking 
FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Step 6: Test the Migration
After running the migration:

1. **Check the schema**:
   ```sql
   \d learning_sessions
   \d question_attempts  
   \d input_tracking
   \d user_profiles
   ```

2. **Verify policies are active**:
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

3. **Test user creation** by registering a new account through your app

4. **Test data isolation** by creating test data with different users

## Recommended Migration Order
1. **First**: Run Step 1 (create user_profiles table)
2. **Second**: Run Step 2 (add user_id columns)  
3. **Third**: Choose and execute Step 3 (handle existing data)
4. **Fourth**: Run Step 4 (make columns NOT NULL) - only if you chose Option A or B
5. **Fifth**: Run Step 5 (enable RLS and policies)
6. **Finally**: Run Step 6 (test everything)

## Important Notes
- **Backup your database** before running any migration
- **Test in a development environment** first
- The RLS policies will prevent access to data without proper authentication
- Make sure your application code is updated to handle authentication before enabling RLS
- If you get permission errors after enabling RLS, it means the policies are working correctly

After completing this migration, your existing tables will be fully integrated with Supabase authentication and user data will be properly isolated per user account.
