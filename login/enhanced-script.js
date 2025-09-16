// Enhanced login script with Supabase authentication
import { AuthManager } from '../js/auth.js'

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const successMessage = document.getElementById('successMessage');
const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');
const welcomeText = document.getElementById('welcomeText');

// Password validation regex
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth manager
    if (!window.authManager) {
        window.authManager = new AuthManager()
    }

    // Check authentication state
    checkAuthState()

    // Listen for auth state changes
    window.addEventListener('authStateChange', handleAuthStateChange)
});

// Check current authentication state
function checkAuthState() {
    if (window.authManager.isAuthenticated()) {
        showSuccessState()
    } else {
        showLoginForm()
    }
}

// Handle auth state changes
function handleAuthStateChange(event) {
    const { event: authEvent, user } = event.detail
    
    if (authEvent === 'SIGNED_IN' && user) {
        showSuccessState()
    } else if (authEvent === 'SIGNED_OUT') {
        showLoginForm()
    }
}

// Form switching functionality
showRegisterLink?.addEventListener('click', function(e) {
    e.preventDefault();
    switchToRegister();
});

showLoginLink?.addEventListener('click', function(e) {
    e.preventDefault();
    switchToLogin();
});

// Registration form submission
registerFormElement?.addEventListener('submit', function(e) {
    e.preventDefault();
    handleRegistration();
});

// Login form submission
loginFormElement?.addEventListener('submit', function(e) {
    e.preventDefault();
    handleLogin();
});

// Logout functionality
logoutBtn?.addEventListener('click', function() {
    handleLogout();
});

// Switch to registration form
function switchToRegister() {
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (successMessage) successMessage.style.display = 'none';
    clearMessages();
}

// Switch to login form
function switchToLogin() {
    if (registerForm) registerForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
    if (successMessage) successMessage.style.display = 'none';
    clearMessages();
}

// Show login form
function showLoginForm() {
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (successMessage) successMessage.style.display = 'none';
}

// Show success state
function showSuccessState() {
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (successMessage) successMessage.style.display = 'block';
    
    // Update welcome message
    const user = window.authManager.currentUser
    updateWelcomeMessage(user)
}

// Handle user registration
async function handleRegistration() {
    const firstName = document.getElementById('firstName')?.value.trim();
    const lastName = document.getElementById('lastName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;

    // Clear previous messages
    clearMessages();

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        showError('All fields are required.', 'registerForm');
        return;
    }

    if (!isValidEmail(email)) {
        showError('Please enter a valid email address.', 'registerForm');
        return;
    }

    if (!passwordRegex.test(password)) {
        showError('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.', 'registerForm');
        return;
    }

    if (password !== confirmPassword) {
        showError('Passwords do not match.', 'registerForm');
        return;
    }

    // Show loading state
    showLoading('registerForm', 'Creating account...');

    try {
        const result = await window.authManager.signUp(email, password, firstName, lastName)
        
        if (result.success) {
            if (result.requiresConfirmation) {
                showSuccess('Please check your email for confirmation link.', 'registerForm');
            } else {
                showSuccess('Account created successfully! Welcome!', 'registerForm');
                // The auth state change will handle the redirect
            }
        } else {
            showError(result.error || 'Registration failed', 'registerForm');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('An unexpected error occurred. Please try again.', 'registerForm');
    } finally {
        hideLoading('registerForm');
    }
}

// Handle user login
async function handleLogin() {
    const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value;

    // Clear previous messages
    clearMessages();

    // Validation
    if (!email || !password) {
        showError('Please enter both email and password.', 'loginForm');
        return;
    }

    if (!isValidEmail(email)) {
        showError('Please enter a valid email address.', 'loginForm');
        return;
    }

    // Show loading state
    showLoading('loginForm', 'Signing in...');

    try {
        const result = await window.authManager.signIn(email, password)
        
        if (result.success) {
            showSuccess('Login successful! Redirecting...', 'loginForm');
            // The auth state change will handle the redirect
        } else {
            showError(result.error || 'Login failed', 'loginForm');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('An unexpected error occurred. Please try again.', 'loginForm');
    } finally {
        hideLoading('loginForm');
    }
}

// Handle user logout
async function handleLogout() {
    try {
        const result = await window.authManager.signOut()
        
        if (result.success) {
            // Clear any stored data
            localStorage.clear()
            showSuccess('Logged out successfully!', 'loginForm');
            // The auth state change will handle showing the login form
        } else {
            showError(result.error || 'Logout failed', 'loginForm');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showError('An unexpected error occurred during logout.', 'loginForm');
    }
}

// Update welcome message with user info
async function updateWelcomeMessage(user) {
    if (!welcomeText || !user) return;

    try {
        const profileResult = await window.authManager.getUserProfile()
        
        if (profileResult.success && profileResult.data) {
            const profile = profileResult.data
            const fullName = profile.full_name || `${profile.first_name} ${profile.last_name}`.trim() || user.email
            welcomeText.textContent = `Welcome, ${fullName}!`
        } else {
            welcomeText.textContent = `Welcome, ${user.email}!`
        }
    } catch (error) {
        console.error('Error fetching user profile:', error)
        welcomeText.textContent = `Welcome, ${user.email}!`
    }
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(message, formType) {
    const errorElement = document.getElementById(`${formType}Error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function showSuccess(message, formType) {
    const successElement = document.getElementById(`${formType}Success`);
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
}

function showLoading(formType, message) {
    const loadingElement = document.getElementById(`${formType}Loading`);
    if (loadingElement) {
        loadingElement.textContent = message;
        loadingElement.style.display = 'block';
    }
    
    // Disable form buttons
    const form = document.getElementById(`${formType}Element`);
    if (form) {
        const buttons = form.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true);
    }
}

function hideLoading(formType) {
    const loadingElement = document.getElementById(`${formType}Loading`);
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    // Re-enable form buttons
    const form = document.getElementById(`${formType}Element`);
    if (form) {
        const buttons = form.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = false);
    }
}

function clearMessages() {
    const messageTypes = ['Error', 'Success', 'Loading'];
    const formTypes = ['login', 'register'];
    
    messageTypes.forEach(msgType => {
        formTypes.forEach(formType => {
            const element = document.getElementById(`${formType}Form${msgType}`);
            if (element) {
                element.style.display = 'none';
                element.textContent = '';
            }
        });
    });
}
