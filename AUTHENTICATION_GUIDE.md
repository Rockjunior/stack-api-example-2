# Authentication Implementation Guide

## Overview
This guide walks you through implementing authentication in your STACK API project using Supabase Auth. The implementation includes:

1. **Database Schema**: User profiles and authenticated session tracking
2. **Backend API**: Authentication endpoints and protected routes
3. **Frontend**: Login/registration forms and session management
4. **Protected Routes**: Ensuring only authenticated users can access content

## 1. Database Schema Setup

### Step 1: Run the Database Schema
Execute the SQL commands in `database_schema_with_auth.sql` in your Supabase SQL editor:

```sql
-- This will create:
-- 1. user_profiles table (extends auth.users)
-- 2. Updated learning_sessions, question_attempts, input_tracking tables
-- 3. Row Level Security (RLS) policies
-- 4. Triggers for automatic profile creation
```

### Step 2: Enable Authentication in Supabase
1. Go to your Supabase project dashboard
2. Navigate to Authentication > Settings
3. Ensure "Enable email confirmations" is configured as needed
4. Configure your site URL (e.g., `http://localhost:8080`)

## 2. Environment Variables

Your `.env` file should contain:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
PORT=3000
```

## 3. API Endpoints

The following endpoints are now available:

### Authentication Endpoints
- `POST /auth/signup` - Create new user account
- `POST /auth/signin` - Sign in user
- `GET /auth/profile` - Get user profile (protected)
- `PUT /auth/profile` - Update user profile (protected)
- `POST /auth/signout` - Sign out user (protected)

### Protected Data Endpoints
- `POST /session/start` - Start learning session (protected)
- `POST /attempt` - Record question attempt (protected)
- `POST /input` - Track user input (protected)

## 4. Frontend Authentication Flow

### Authentication Manager (`js/auth.js`)
- Handles Supabase authentication
- Manages JWT tokens
- Provides authentication utilities
- Automatic session management

### Login Page (`login/login.html`)
- Registration form with validation
- Login form
- Password strength requirements
- Error handling and user feedback

### Main Application (`index.html`)
- Authentication checks on page load
- User info display
- Logout functionality
- Automatic redirection if not authenticated

## 5. Security Features

### Row Level Security (RLS)
- Users can only access their own data
- Automatic enforcement at the database level

### JWT Authentication
- Secure token-based authentication
- Automatic token refresh
- Server-side token validation

### Password Requirements
- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character

## 6. Usage Instructions

### For Development
1. Start your Docker containers:
   ```powershell
   docker-compose up --build
   ```

2. Navigate to `http://localhost:8080/`

3. You'll be redirected to `http://localhost:8080/login/login.html`

4. Create an account or sign in

5. After authentication, you'll be redirected to the main application

### For Users
1. **First Visit**: Users must create an account
2. **Registration**: Fill out the registration form with:
   - First Name
   - Last Name  
   - Email address
   - Strong password
3. **Login**: Use email and password to sign in
4. **Session Management**: Sessions persist across browser sessions
5. **Logout**: Click the logout button to end the session

## 7. Testing the Implementation

### Test Registration
1. Go to `http://localhost:8080/login/login.html`
2. Click "Register here"
3. Fill out the registration form
4. Submit and verify account creation

### Test Login
1. Use the registered email and password
2. Verify redirection to main application
3. Check that user info appears in header

### Test Protected Routes
1. Try accessing `http://localhost:8080/` without being logged in
2. Verify redirection to login page
3. Log in and verify access is granted

### Test Data Tracking
1. Complete some questions while logged in
2. Check your Supabase database tables:
   - `user_profiles` - Should contain your profile
   - `learning_sessions` - Should track your sessions
   - `question_attempts` - Should track your question attempts
   - `input_tracking` - Should track your interactions

## 8. Key Changes from Anonymous System

### Before (Anonymous)
- Used browser-generated anonymous IDs
- No user accounts
- Data linked to temporary session identifiers
- No authentication required

### After (Authenticated)
- Real user accounts with Supabase Auth
- Persistent user data across sessions
- Row-level security ensuring data privacy
- JWT-based authentication
- User profiles with names and preferences

## 9. Migration Considerations

If you have existing anonymous data, you'll need to:
1. Export existing data from anonymous tables
2. Create user accounts for existing users (if possible)
3. Migrate data to new authenticated structure
4. Update any existing APIs or integrations

## 10. Troubleshooting

### Common Issues
1. **Authentication redirect loop**: Check Supabase configuration and environment variables
2. **CORS errors**: Verify API endpoints allow cross-origin requests
3. **Database connection errors**: Confirm Supabase credentials in `.env`
4. **JWT token issues**: Check token expiration and refresh logic

### Debug Steps
1. Check browser console for JavaScript errors
2. Verify Supabase project settings
3. Test API endpoints with Postman or similar tool
4. Check database logs in Supabase dashboard

## 11. Next Steps

### Potential Enhancements
1. **Email Confirmation**: Require email verification for new accounts
2. **Password Reset**: Add forgot password functionality
3. **Social Login**: Add Google/GitHub/other OAuth providers
4. **User Dashboard**: Create user profile management page
5. **Admin Panel**: Add administrative features for user management
6. **Analytics**: Track user engagement and learning progress

### Performance Optimization
1. **Caching**: Implement session caching
2. **Database Indexes**: Add appropriate indexes for queries
3. **API Rate Limiting**: Implement rate limiting for security
4. **Connection Pooling**: Optimize database connections

This authentication system provides a solid foundation for your learning platform while ensuring user data privacy and security.
