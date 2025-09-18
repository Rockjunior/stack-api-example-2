// Supabase authentication client
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2'

// Get Supabase configuration from your config
const supabaseUrl = 'https://pbgubbwkvzgfifvdjdvt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZ3ViYndrdnpnZmlmdmRqZHZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNzQxNDEsImV4cCI6MjA3MTk1MDE0MX0.mSTHMDvIyJCavDwl5ygBzGzno28be5MlUbyUtvOQCdM'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Authentication utilities
class AuthManager {
    constructor() {
        this.currentUser = null
        this.currentSession = null
        this.init()
    }

    async init() {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            this.currentSession = session
            this.currentUser = session.user
            this.handleAuthStateChange('SIGNED_IN', session)
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            this.handleAuthStateChange(event, session)
        })
    }

    async signUp(email, password, firstName, lastName) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`
                    }
                }
            })

            if (error) throw error

            // If email confirmation is required
            if (data.user && !data.session) {
                return {
                    success: true,
                    message: 'Please check your email for confirmation link',
                    requiresConfirmation: true
                }
            }

            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async signOut() {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async updateProfile(profileData) {
        try {
            if (!this.currentUser) {
                throw new Error('No authenticated user')
            }

            const { data, error } = await supabase
                .from('user_profiles')
                .update(profileData)
                .eq('id', this.currentUser.id)
                .select()
                .single()

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    async getUserProfile() {
        try {
            if (!this.currentUser) {
                throw new Error('No authenticated user')
            }

            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single()

            if (error) throw error
            return { success: true, data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    getAccessToken() {
        return this.currentSession?.access_token
    }

    isAuthenticated() {
        return !!this.currentSession && !!this.currentUser
    }

    handleAuthStateChange(event, session) {
        this.currentSession = session
        this.currentUser = session?.user || null

        // Store session data
        if (session) {
            localStorage.setItem('supabase_session', JSON.stringify(session))
        } else {
            localStorage.removeItem('supabase_session')
        }

        // Dispatch custom event for other parts of the app to listen to
        window.dispatchEvent(new CustomEvent('authStateChange', {
            detail: { event, session, user: this.currentUser }
        }))

        // Redirect based on auth state
        this.handleRedirection(event, session)
    }

    handleRedirection(event, session) {
        const currentPath = window.location.pathname
        const hasLocalUser = !!localStorage.getItem('currentUser')

        // If a local session exists, do not auto-redirect here.
        if (hasLocalUser) {
            return
        }

        if (event === 'SIGNED_IN' && session) {
            // Redirect to main app if on login page or root
            if (currentPath.includes('login') || currentPath === '/') {
                window.location.replace('/index.html')
            }
        } else if (event === 'SIGNED_OUT') {
            // Avoid forcing redirects on SIGNED_OUT; pages handle guard logic.
            // Only redirect if currently on root path
            if (currentPath === '/' ) {
                window.location.replace('/login/login.html')
            }
        }
    }

    // Method to make authenticated API calls
    async makeAuthenticatedRequest(url, options = {}) {
        const token = this.getAccessToken()
        if (!token) {
            throw new Error('No authentication token available')
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }

        return fetch(url, {
            ...options,
            headers
        })
    }
}

// Create global auth manager instance
window.authManager = new AuthManager()

// Export for module use
export { AuthManager, supabase }
