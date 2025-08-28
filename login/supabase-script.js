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
const userEmail = document.getElementById('userEmail');
const userCreated = document.getElementById('userCreated');
const loadingIndicator = document.getElementById('loadingIndicator');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');

// Password validation regex
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    if (!supabase) {
        showError('Supabase is not configured. Please check config.js', 'loginForm');
        return;
    }

    // Check if user is already logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await showSuccessMessage(session.user);
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            await showSuccessMessage(session.user);
        } else if (event === 'SIGNED_OUT') {
            switchToLogin();
        }
    });
});

// Form switching functionality
showRegisterLink.addEventListener('click', function(e) {
    e.preventDefault();
    switchToRegister();
});

showLoginLink.addEventListener('click', function(e) {
    e.preventDefault();
    switchToLogin();
});

// Registration form submission
registerFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();
    await handleRegistration();
});

// Login form submission
loginFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();
    await handleLogin();
});

// Logout functionality
logoutBtn.addEventListener('click', async function() {
    await handleLogout();
});

// Switch to registration form
function switchToRegister() {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    successMessage.style.display = 'none';
    loadingIndicator.style.display = 'none';
    clearMessages();
}

// Switch to login form
function switchToLogin() {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    successMessage.style.display = 'none';
    loadingIndicator.style.display = 'none';
    clearMessages();
}

// Show/hide loading indicator
function showLoading() {
    loadingIndicator.style.display = 'block';
    loginBtn.disabled = true;
    registerBtn.disabled = true;
}

function hideLoading() {
    loadingIndicator.style.display = 'none';
    loginBtn.disabled = false;
    registerBtn.disabled = false;
}

// Handle user registration
async function handleRegistration() {
    if (!supabase) {
        showError('Supabase is not configured. Please check config.js', 'registerForm');
        return;
    }

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('registerEmail').value.trim().toLowerCase();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

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

    showLoading();

    try {
        // Sign up with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    full_name: `${firstName} ${lastName}`
                }
            }
        });

        hideLoading();

        if (error) {
            showError(error.message, 'registerForm');
            return;
        }

        if (data.user && !data.user.email_confirmed_at) {
            showSuccess('Registration successful! Please check your email to verify your account, then login.', 'registerForm');
            // Clear form
            registerFormElement.reset();
            // Switch to login form after 3 seconds
            setTimeout(() => {
                switchToLogin();
                document.getElementById('loginEmail').value = email;
            }, 3000);
        } else if (data.user && data.user.email_confirmed_at) {
            // Auto-confirmed (if email confirmation is disabled)
            showSuccess('Registration successful! You are now logged in.', 'registerForm');
            registerFormElement.reset();
        }

    } catch (error) {
        hideLoading();
        showError('An unexpected error occurred. Please try again.', 'registerForm');
        console.error('Registration error:', error);
    }
}

// Handle user login
async function handleLogin() {
    if (!supabase) {
        showError('Supabase is not configured. Please check config.js', 'loginForm');
        return;
    }

    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

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

    showLoading();

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        hideLoading();

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                showError('Please verify your email address before logging in. Check your inbox for a confirmation email.', 'loginForm');
            } else if (error.message.includes('Invalid login credentials')) {
                showError('Invalid email or password. Please check your credentials and try again.', 'loginForm');
            } else {
                showError(error.message, 'loginForm');
            }
            return;
        }

        // Clear form
        loginFormElement.reset();
        // Success message will be handled by the auth state change listener

    } catch (error) {
        hideLoading();
        showError('An unexpected error occurred. Please try again.', 'loginForm');
        console.error('Login error:', error);
    }
}

// Handle logout
async function handleLogout() {
    if (!supabase) return;

    showLoading();

    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('Logout error:', error);
        }
        
        hideLoading();
        showSuccess('You have been logged out successfully.', 'loginForm');
        
    } catch (error) {
        hideLoading();
        console.error('Logout error:', error);
    }
}

// Show success message after login
async function showSuccessMessage(user) {
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    successMessage.style.display = 'block';
    loadingIndicator.style.display = 'none';
    
    const firstName = user.user_metadata?.first_name || '';
    const lastName = user.user_metadata?.last_name || '';
    const fullName = user.user_metadata?.full_name || `${firstName} ${lastName}`.trim() || 'User';
    
    welcomeText.textContent = `Hello, ${fullName}! You are successfully logged in.`;
    userEmail.textContent = user.email;
    userCreated.textContent = new Date(user.created_at).toLocaleDateString();
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(message, formId) {
    const form = document.getElementById(formId);
    const existingError = form.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    form.insertBefore(errorDiv, form.querySelector('form'));
}

function showSuccess(message, formId) {
    const form = document.getElementById(formId);
    const existingSuccess = form.querySelector('.success-notification');
    if (existingSuccess) {
        existingSuccess.remove();
    }

    const successDiv = document.createElement('div');
    successDiv.className = 'success-notification';
    successDiv.textContent = message;
    form.insertBefore(successDiv, form.querySelector('form'));
}

function clearMessages() {
    const errorMessages = document.querySelectorAll('.error-message');
    const successMessages = document.querySelectorAll('.success-notification');
    
    errorMessages.forEach(msg => msg.remove());
    successMessages.forEach(msg => msg.remove());
}

// Real-time password validation feedback
document.getElementById('registerPassword').addEventListener('input', function() {
    const password = this.value;
    const requirementsDiv = document.querySelector('.password-requirements small');
    
    if (password.length === 0) {
        requirementsDiv.style.color = '#666';
        requirementsDiv.textContent = 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.';
        return;
    }

    const isValid = passwordRegex.test(password);
    if (isValid) {
        requirementsDiv.style.color = '#28a745';
        requirementsDiv.textContent = '✓ Password meets all requirements';
    } else {
        requirementsDiv.style.color = '#dc3545';
        let missing = [];
        if (password.length < 8) missing.push('8+ characters');
        if (!/[a-z]/.test(password)) missing.push('lowercase letter');
        if (!/[A-Z]/.test(password)) missing.push('uppercase letter');
        if (!/\d/.test(password)) missing.push('number');
        if (!/[@$!%*?&]/.test(password)) missing.push('special character');
        
        requirementsDiv.textContent = `Missing: ${missing.join(', ')}`;
    }
});

// Real-time password confirmation validation
document.getElementById('confirmPassword').addEventListener('input', function() {
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = this.value;
    
    if (confirmPassword.length === 0) {
        this.style.borderColor = '#e1e5e9';
        return;
    }
    
    if (password === confirmPassword) {
        this.style.borderColor = '#28a745';
    } else {
        this.style.borderColor = '#dc3545';
    }
}); 