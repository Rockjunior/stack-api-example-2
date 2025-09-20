# Migration to Incremental IDs

## What Changed

### 1. Local Login System ✅ (Already Applied)
- User IDs now use incremental integers: `1, 2, 3, 4...`
- Instead of timestamp-based IDs like `1726754938123`
- First user gets ID `1`, second gets ID `2`, etc.

### 2. Database Tables (Requires Migration)
- `learning_sessions.id`: UUID → Integer (1, 2, 3...)
- `question_attempts.id`: UUID → Integer (1, 2, 3...)  
- `input_tracking.id`: UUID → Integer (1, 2, 3...)

## How to Apply Database Migration

### Option A: Fresh Start (Recommended if you don't have important data)
If you don't mind losing existing data, this is the simplest approach:

1. **Drop existing tables** in your Supabase dashboard:
   ```sql
   DROP TABLE input_tracking CASCADE;
   DROP TABLE question_attempts CASCADE;
   DROP TABLE learning_sessions CASCADE;
   ```

2. **Create new tables with incremental IDs**:
   ```sql
   -- Learning sessions with incremental ID
   CREATE TABLE learning_sessions (
     id SERIAL PRIMARY KEY,  -- Auto-incrementing: 1, 2, 3, 4...
     user_id UUID REFERENCES auth.users(id) NOT NULL,
     session_start TIMESTAMP DEFAULT NOW(),
     session_end TIMESTAMP,
     page_url TEXT,
     user_agent TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- Question attempts with incremental ID
   CREATE TABLE question_attempts (
     id SERIAL PRIMARY KEY,  -- Auto-incrementing: 1, 2, 3, 4...
     session_id INTEGER REFERENCES learning_sessions(id) NOT NULL,
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

   -- Input tracking with incremental ID
   CREATE TABLE input_tracking (
     id SERIAL PRIMARY KEY,  -- Auto-incrementing: 1, 2, 3, 4...
     attempt_id INTEGER REFERENCES question_attempts(id) NOT NULL,
     session_id INTEGER REFERENCES learning_sessions(id) NOT NULL,
     user_id UUID REFERENCES auth.users(id) NOT NULL,
     input_name TEXT,
     input_value TEXT,
     input_type TEXT,
     is_final_answer BOOLEAN DEFAULT FALSE,
     validation_result TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Add indexes and RLS policies**:
   ```sql
   -- Indexes
   CREATE INDEX idx_learning_sessions_user_id ON learning_sessions(user_id);
   CREATE INDEX idx_question_attempts_user_id ON question_attempts(user_id);
   CREATE INDEX idx_question_attempts_session_id ON question_attempts(session_id);
   CREATE INDEX idx_input_tracking_user_id ON input_tracking(user_id);
   CREATE INDEX idx_input_tracking_attempt_id ON input_tracking(attempt_id);
   CREATE INDEX idx_input_tracking_session_id ON input_tracking(session_id);

   -- RLS
   ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
   ALTER TABLE input_tracking ENABLE ROW LEVEL SECURITY;

   -- Policies
   CREATE POLICY "Users can view own sessions" ON learning_sessions FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own sessions" ON learning_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own sessions" ON learning_sessions FOR UPDATE USING (auth.uid() = user_id);

   CREATE POLICY "Users can view own attempts" ON question_attempts FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own attempts" ON question_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update own attempts" ON question_attempts FOR UPDATE USING (auth.uid() = user_id);

   CREATE POLICY "Users can view own input tracking" ON input_tracking FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can insert own input tracking" ON input_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
   ```

### Option B: Preserve Existing Data
If you have important data to preserve, use the migration script:

1. Run the `migration_to_incremental_ids.sql` file in your Supabase SQL editor
2. Verify the migration worked with the verification queries
3. Uncomment the final DROP/RENAME statements to complete the migration

## Testing the Changes

After applying the migration:

1. **Test user registration** - New users should get IDs like `1, 2, 3`
2. **Test question loading** - Should create session with ID `1, 2, 3`
3. **Test question submission** - Should create attempt with ID `1, 2, 3`
4. **Check database** - All IDs should be simple integers instead of UUIDs

## Benefits of Incremental IDs

✅ **Simpler debugging** - Easy to reference "session 5" or "attempt 12"  
✅ **Smaller URLs** - `/session/5` instead of `/session/eb9a2081-7775-46c9-b540-f3cb9f47dad2`  
✅ **Better performance** - Integer joins are faster than UUID joins  
✅ **Sequential ordering** - Easy to see chronological order  
✅ **Smaller database size** - Integers take less space than UUIDs  

## Notes

- **User authentication IDs remain UUIDs** (managed by Supabase Auth)
- **Only internal tracking IDs changed** to incremental integers
- **Foreign key relationships preserved** but now use integers
- **All existing functionality will work** the same way
