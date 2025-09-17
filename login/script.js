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
    // Check if user is already logged in
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        try {
            JSON.parse(currentUser);
            // Already authenticated: go straight to main app to avoid loops
            window.location.replace('/index.html');
            return;
        } catch (e) {
            // Corrupt value: clear and stay on login
            console.warn('Corrupt currentUser detected on login page. Clearing it.');
            localStorage.removeItem('currentUser');
        }
    }
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
registerFormElement.addEventListener('submit', function(e) {
    e.preventDefault();
    handleRegistration();
});

// Login form submission
loginFormElement.addEventListener('submit', function(e) {
    e.preventDefault();
    handleLogin();
});

// Logout functionality
logoutBtn.addEventListener('click', function() {
    handleLogout();
});

// Switch to registration form
function switchToRegister() {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    successMessage.style.display = 'none';
    clearMessages();
}

// Switch to login form
function switchToLogin() {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    successMessage.style.display = 'none';
    clearMessages();
}

// Handle user registration
function handleRegistration() {
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

    // Check if user already exists
    const existingUsers = getUsers();
    if (existingUsers.find(user => user.email === email)) {
        showError('An account with this email already exists.', 'registerForm');
        return;
    }

    // Create new user
    const newUser = {
        id: Date.now().toString(),
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: password, // In production, this should be hashed
        createdAt: new Date().toISOString()
    };

    // Save user
    existingUsers.push(newUser);
    localStorage.setItem('users', JSON.stringify(existingUsers));

    // Show success message and switch to login
    showSuccess('Registration successful! Please login with your credentials.', 'registerForm');
    
    // Clear form
    registerFormElement.reset();
    
    // Switch to login form after 2 seconds
    setTimeout(() => {
        switchToLogin();
        // Pre-fill email in login form
        document.getElementById('loginEmail').value = email;
    }, 2000);
}

// Handle user login
function handleLogin() {
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

    // Check credentials
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
        showError('Invalid email or password.', 'loginForm');
        return;
    }

    // Set current user session
    localStorage.setItem('currentUser', JSON.stringify(user));

    // Clear form
    loginFormElement.reset();

    // Show success message
    showSuccessMessage(user);
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('currentUser');
    switchToLogin();
    showSuccess('You have been logged out successfully.', 'loginForm');
}

// Show success message after login
function showSuccessMessage(user) {
    loginForm.style.display = 'none';
    registerForm.style.display = 'none';
    successMessage.style.display = 'block';
    welcomeText.textContent = `Hello, ${user.firstName} ${user.lastName}! You are successfully logged in.`;
    // Auto-redirect to main application after 1.2 seconds, only when on login page
    if (window.location.pathname.includes('/login/')) {
        setTimeout(() => {
            // Use replace to avoid adding extra history entries
            window.location.replace('/index.html');
        }, 1200);
    }
}

// Utility functions
function getUsers() {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
}

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