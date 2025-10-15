# STACK API Learning Platform with Authentication

The javascript code in `/js` is based on a modification by Sam Fearn of some of the STACK API code from https://github.com/maths/moodle-qtype_stack

This platform now includes **user authentication** using Supabase Auth, requiring users to create accounts and log in to access learning materials.

## Setup

### Prerequisites
- Docker and Docker Compose installed
- Supabase project set up (for authentication and database)

### Database Setup
1. **Run the database migration** in your Supabase project:
   - Execute the SQL in `database_schema_with_auth.sql` in your Supabase SQL editor
   - Follow the steps in `MIGRATION_GUIDE.md` if you have existing data

### Environment Configuration
2. **Configure your environment variables** in `.env`:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SUPABASE_ANON_KEY=your_anon_key
   OPENAI_API_KEY=your_openai_key (optional)
   ```
If you don't already have a `.env` file in the project root, copy the provided example:

```bash
cp .env.example .env
```

On Windows (PowerShell), run:

```powershell
Copy-Item .env.example .env
```

Fill in the values in `.env` with your Supabase project credentials. Do not commit `.env` to version control — it's already listed in `.gitignore`.

### Running the Application
3. **Start the services**:
   ```bash
   docker compose up --build
   ```

4. **Access the application**:
   - Navigate to `http://localhost:8080/`
   - You'll be redirected to `http://localhost:8080/login/login.html` for authentication
   - Create an account or sign in to access the learning platform

### Additional Services
- **STACK API**: Available at `http://localhost:3080/stack.php` 
- **Authentication API**: Available at `http://localhost:3000/auth/*`
- **Learning Data API**: Available at `http://localhost:3000/session/*`, `http://localhost:3000/attempt`, etc. 

## Production remarks

The following changes are referring to `docker-compose.xml`.

To ease development, we have mounted the volume
```
    volumes:
      - ./web:/usr/share/nginx/html
```
It serves the purpose so we don't have to restart the container each time we make any changes content in the `web` folder.

We serve our content on port 8080.
```
    ports:
      - "8080:80"
```
This can be changed e.g. to port 80 if we want to serve our API on the default port.

Comment out
```
    ports:
      - '3080:80'
```

if you don't want to expose the STACK API itself and its example page to the outside.

## Troubleshooting

### 404 Not Found Error
If you're getting a 404 error when accessing `http://localhost:8080/`:

1. **Stop and rebuild containers**:
   ```bash
   docker compose down
   docker compose up --build
   ```

2. **Check if all files are present**:
   - Ensure `index.html` exists in the project root
   - Ensure `login/` folder exists with `login.html`
   - Ensure `js/` folder contains all JavaScript files

3. **Verify container logs**:
   ```bash
   docker compose logs web
   ```

### Authentication Issues
- **Redirect loops**: Check your Supabase project settings and ensure the site URL is set to `http://localhost:8080`
- **Database connection errors**: Verify your `.env` file has correct Supabase credentials
- **CORS errors**: The API includes CORS headers, but check browser console for specific errors

### Database Migration Issues
- Follow the step-by-step guide in `MIGRATION_GUIDE.md`
- Run `database_schema_with_auth.sql` in your Supabase SQL editor
- Ensure Row Level Security policies are properly configured

