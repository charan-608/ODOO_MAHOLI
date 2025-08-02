document.addEventListener('DOMContentLoaded', function() {
    // ========== UTILITY FUNCTIONS ==========
    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const generateToken = (length = 32) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < length; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    };

    const showMessage = (message, type = 'error', elementId = 'errorMessage') => {
        const messageElement = document.getElementById(elementId);
        if (!messageElement) return;

        messageElement.textContent = message;
        messageElement.style.display = 'block';

        switch(type) {
            case 'success':
                messageElement.style.backgroundColor = 'rgba(76, 201, 240, 0.1)';
                messageElement.style.color = '#4cc9f0';
                break;
            case 'info':
                messageElement.style.backgroundColor = 'rgba(72, 149, 239, 0.1)';
                messageElement.style.color = '#4895ef';
                break;
            default: // error
                messageElement.style.backgroundColor = 'rgba(247, 37, 133, 0.1)';
                messageElement.style.color = '#f72585';
        }
    };

    const hideMessage = (elementId = 'errorMessage') => {
        const messageElement = document.getElementById(elementId);
        if (messageElement) messageElement.style.display = 'none';
    };

    const trackEvent = (category, action, label = '', value = null) => {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const event = {
            userId: userData.id || 'anonymous',
            category,
            action,
            label,
            value,
            timestamp: new Date().toISOString(),
            page: window.location.pathname
        };
        
        const events = JSON.parse(localStorage.getItem('analyticsEvents') || '[]');
        events.push(event);
        localStorage.setItem('analyticsEvents', JSON.stringify(events.slice(-100)));
        
        console.log('[Analytics]', event);
    };

    // ========== AUTHENTICATION FUNCTIONS ==========
    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const generateJWT = (payload) => {
        const header = { alg: 'HS256', typ: 'JWT' };
        const encodedHeader = btoa(JSON.stringify(header));
        const encodedPayload = btoa(JSON.stringify(payload));
        const signature = 'simulated-signature';
        return `${encodedHeader}.${encodedPayload}.${signature}`;
    };

    const validateJWT = (token) => {
        if (!token) return false;
        try {
            const [, payload] = token.split('.');
            const data = JSON.parse(atob(payload));
            return data.exp > Math.floor(Date.now() / 1000);
        } catch {
            return false;
        }
    };

    const getCurrentUser = () => {
        const token = localStorage.getItem('authToken');
        if (token && validateJWT(token)) {
            const [, payload] = token.split('.');
            return JSON.parse(atob(payload));
        }
        return null;
    };

    // ========== NAVIGATION HANDLER ==========
    const registerRedirectBtn = document.getElementById('registerRedirect');
    const loginRedirectBtn = document.getElementById('loginRedirect');
    const returnToLoginBtn = document.getElementById('returnToLogin');

    if (registerRedirectBtn) {
        registerRedirectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }

    if (loginRedirectBtn) {
        loginRedirectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    if (returnToLoginBtn) {
        returnToLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    // ========== LOGIN PAGE FUNCTIONALITY ==========
    if (document.getElementById('loginForm')) {
        const loginForm = document.getElementById('loginForm');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const rememberMeCheckbox = document.getElementById('rememberMe');
        const clearUsernameBtn = document.getElementById('clearUsername');
        const togglePasswordBtn = document.getElementById('togglePassword');
        const forgotPasswordLink = document.getElementById('forgotPassword');

        // Check for remembered user
        if (localStorage.getItem('rememberMe') === 'true') {
            const savedUsername = localStorage.getItem('username');
            const savedPassword = localStorage.getItem('password');
            
            if (savedUsername) {
                usernameInput.value = savedUsername;
                if (savedPassword) {
                    passwordInput.value = savedPassword;
                }
                rememberMeCheckbox.checked = true;
            }
        }

        if (clearUsernameBtn) {
            clearUsernameBtn.addEventListener('click', () => {
                usernameInput.value = '';
                usernameInput.focus();
                trackEvent('Login', 'Clear Username');
            });
        }

        if (togglePasswordBtn) {
            togglePasswordBtn.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePasswordBtn.innerHTML = type === 'password'
                    ? '<i class="fas fa-eye"></i>'
                    : '<i class="fas fa-eye-slash"></i>';
                trackEvent('Login', 'Toggle Password Visibility');
            });
        }

        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                const email = prompt('Please enter your email to receive password reset instructions:');
                if (email) {
                    const resetToken = generateToken();
                    localStorage.setItem(`reset_${email}`, resetToken);
                    
                    console.log(`Password reset link: https://yourdomain.com/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`);
                    
                    showMessage(`If an account exists for ${email}, you will receive a password reset link.`, 'info');
                    trackEvent('Login', 'Forgot Password Attempt', email);
                }
            });
        }

        // Social login buttons
        const socialLoginButtons = ['googleLogin', 'facebookLogin', 'githubLogin', 'linkedinLogin'];
        socialLoginButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const provider = buttonId.replace('Login', '');
                    handleSocialLogin(provider);
                });
            }
        });

        async function handleSocialLogin(provider) {
            showMessage(`Logging in with ${provider}...`, 'info');
            
            setTimeout(async () => {
                const mockUser = {
                    id: generateUUID(),
                    username: `${provider.toLowerCase()}user@example.com`,
                    provider: provider,
                    name: `${provider} User`,
                    role: 'user',
                    verified: true,
                    createdAt: new Date().toISOString()
                };

                // Store user data
                localStorage.setItem('userData', JSON.stringify(mockUser));
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('username', mockUser.username);
                
                // Generate JWT
                const token = generateJWT({
                    sub: mockUser.id,
                    email: mockUser.username,
                    role: mockUser.role,
                    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
                });
                localStorage.setItem('authToken', token);
                
                showMessage(`Successfully logged in with ${provider}! Redirecting...`, 'success');
                trackEvent('Login', 'Social Login Success', provider);
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            }, 1000);
        }

        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                hideMessage();

                const username = usernameInput.value.trim();
                const password = passwordInput.value.trim();

                if (!username || !password) {
                    showMessage('Please fill in all fields');
                    return;
                }

                // Check credentials against stored data
                const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                const hashedInput = await hashPassword(password);
                
                if (userData.email === username && userData.password === hashedInput) {
                    // Valid credentials
                    if (rememberMeCheckbox.checked) {
                        localStorage.setItem('rememberMe', 'true');
                        localStorage.setItem('username', username);
                        localStorage.setItem('password', password);
                    } else {
                        localStorage.removeItem('rememberMe');
                        localStorage.removeItem('username');
                        localStorage.removeItem('password');
                    }

                    // Update last login
                    userData.lastLogin = new Date().toISOString();
                    localStorage.setItem('userData', JSON.stringify(userData));
                    
                    // Generate JWT
                    const token = generateJWT({
                        sub: userData.id,
                        email: userData.email,
                        role: userData.role || 'user',
                        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
                    });
                    localStorage.setItem('authToken', token);
                    
                    showMessage('Login successful! Redirecting...', 'success');
                    trackEvent('Login', 'Login Success', username);
                    
                    setTimeout(() => {
                        window.location.href = 'landingpage.html';
                    }, 1000);
                } else {
                    showMessage('Invalid username or password');
                    passwordInput.value = '';
                    passwordInput.focus();
                    trackEvent('Login', 'Login Failed', username);
                }
            });
        }

        // Show registration success message if redirected from registration
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('registered')) {
            showMessage('Registration successful! Please log in.', 'success');
        }
    }

    // ========== REGISTRATION PAGE FUNCTIONALITY ==========
    if (document.getElementById('registerForm')) {
        const registerForm = document.getElementById('registerForm');
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const togglePasswordBtn = document.getElementById('togglePassword');
        const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPassword');
        const termsCheckbox = document.getElementById('agreeTerms');
        const usernameFeedback = document.getElementById('usernameFeedback');
        const emailFeedback = document.getElementById('emailFeedback');
        const confirmPasswordFeedback = document.getElementById('confirmPasswordFeedback');
        
        const calculatePasswordStrength = (password) => {
            let strength = 0;
            if (password.length > 0) strength += 1;
            if (password.length >= 8) strength += 1;
            if (password.length >= 12) strength += 1;
            if (/[A-Z]/.test(password)) strength += 1;
            if (/[0-9]/.test(password)) strength += 1;
            if (/[^A-Za-z0-9]/.test(password)) strength += 1;
            return Math.min(strength, 5);
        };

        if (passwordInput) {
            passwordInput.addEventListener('input', () => {
                const password = passwordInput.value;
                const strength = calculatePasswordStrength(password);
                const strengthBar = document.querySelector('.strength-bar');
                const strengthText = document.getElementById('strengthText');

                if (strengthBar && strengthText) {
                    const width = (strength / 5) * 100;
                    strengthBar.style.width = `${width}%`;

                    if (strength <= 2) {
                        strengthBar.style.backgroundColor = '#f72585';
                        strengthText.textContent = 'Weak';
                        strengthText.style.color = '#f72585';
                    } else if (strength <= 3) {
                        strengthBar.style.backgroundColor = '#f8961e';
                        strengthText.textContent = 'Medium';
                        strengthText.style.color = '#f8961e';
                    } else {
                        strengthBar.style.backgroundColor = '#4cc9f0';
                        strengthText.textContent = 'Strong';
                        strengthText.style.color = '#4cc9f0';
                    }
                }
            });
        }

        if (togglePasswordBtn) {
            togglePasswordBtn.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePasswordBtn.innerHTML = type === 'password'
                    ? '<i class="fas fa-eye"></i>'
                    : '<i class="fas fa-eye-slash"></i>';
                trackEvent('Registration', 'Toggle Password Visibility');
            });
        }

        if (toggleConfirmPasswordBtn) {
            toggleConfirmPasswordBtn.addEventListener('click', () => {
                const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                confirmPasswordInput.setAttribute('type', type);
                toggleConfirmPasswordBtn.innerHTML = type === 'password'
                    ? '<i class="fas fa-eye"></i>'
                    : '<i class="fas fa-eye-slash"></i>';
                trackEvent('Registration', 'Toggle Confirm Password Visibility');
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                hideMessage();

                const username = usernameInput.value.trim();
                const email = emailInput.value.trim();
                const password = passwordInput.value.trim();
                const confirmPassword = confirmPasswordInput.value.trim();
                const agreeTerms = termsCheckbox.checked;

                // Validation
                if (!username || !email || !password || !confirmPassword) {
                    showMessage('Please fill in all fields');
                    return;
                }

                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    showMessage('Please enter a valid email address');
                    return;
                }

                if (password.length < 8) {
                    showMessage('Password must be at least 8 characters long');
                    return;
                }

                if (password !== confirmPassword) {
                    showMessage('Passwords do not match');
                    return;
                }

                if (!agreeTerms) {
                    showMessage('You must agree to the Terms of Service and Privacy Policy');
                    return;
                }

                // Hash password
                const hashedPassword = await hashPassword(password);

                // Save user data
                const userData = {
                    id: generateUUID(),
                    username,
                    email,
                    password: hashedPassword,
                    role: 'user',
                    verified: false,
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    profile: {
                        firstName: '',
                        lastName: '',
                        bio: ''
                    },
                    preferences: {
                        theme: 'light',
                        notifications: true
                    }
                };

                localStorage.setItem('userData', JSON.stringify(userData));
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('username', email);
                
                // Generate verification token
                const verificationToken = generateToken();
                localStorage.setItem(`verification_${email}`, verificationToken);
                
                // Generate JWT
                const token = generateJWT({
                    sub: userData.id,
                    email: userData.email,
                    role: userData.role,
                    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
                });
                localStorage.setItem('authToken', token);
                
                // Simulate sending verification email
                console.log(`Verification email sent to ${email}`);
                console.log(`Verification link: https://yourdomain.com/verify?email=${encodeURIComponent(email)}&token=${verificationToken}`);

                showMessage('Registration successful! Redirecting to login...', 'success');
                trackEvent('Registration', 'Registration Success', username);
                
                // Redirect to login page with success indicator
                setTimeout(() => {
                    window.location.href = 'index.html?registered=true';
                }, 1500);
            });
        }

        if (usernameInput) {
            usernameInput.addEventListener('blur', () => {
                const username = usernameInput.value.trim();
                if (!username) return;
                setTimeout(() => {
                    if (username.length < 4) {
                        usernameFeedback.textContent = 'Username must be at least 4 characters';
                        usernameFeedback.style.display = 'block';
                    } else {
                        usernameFeedback.style.display = 'none';
                    }
                }, 500);
            });
        }

        if (emailInput) {
            emailInput.addEventListener('blur', () => {
                const email = emailInput.value.trim();
                if (!email) return;

                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    emailFeedback.textContent = 'Please enter a valid email address';
                    emailFeedback.style.display = 'block';
                } else {
                    emailFeedback.style.display = 'none';
                }
            });
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => {
                const password = passwordInput.value.trim();
                const confirmPassword = confirmPasswordInput.value.trim();
                if (confirmPassword && password !== confirmPassword) {
                    confirmPasswordFeedback.textContent = 'Passwords do not match';
                    confirmPasswordFeedback.style.display = 'block';
                } else {
                    confirmPasswordFeedback.style.display = 'none';
                }
            });
        }
    }

    // ========== DASHBOARD FUNCTIONALITY ==========
    if (document.getElementById('dashboard-content')) {
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
            window.location.href = 'index.html';
            return;
        }

        // Load user data
        const userData = JSON.parse(localStorage.getItem('userData'));
        
        // Display user info
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${userData.username || 'User'}!`;
        }
        
        if (userData.profile) {
            const firstNameInput = document.getElementById('profile-firstName');
            const lastNameInput = document.getElementById('profile-lastName');
            const bioInput = document.getElementById('profile-bio');
            
            if (firstNameInput) firstNameInput.value = userData.profile.firstName || '';
            if (lastNameInput) lastNameInput.value = userData.profile.lastName || '';
            if (bioInput) bioInput.value = userData.profile.bio || '';
        }

        // Show last login time
        const lastLoginElement = document.getElementById('last-login');
        if (lastLoginElement) {
            const lastLogin = userData.lastLogin ? new Date(userData.lastLogin) : new Date();
            lastLoginElement.textContent = `Last login: ${lastLogin.toLocaleString()}`;
        }

        // Update login time
        userData.lastLogin = new Date().toISOString();
        localStorage.setItem('userData', JSON.stringify(userData));

        // Profile form submission
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                userData.profile = {
                    firstName: document.getElementById('profile-firstName').value,
                    lastName: document.getElementById('profile-lastName').value,
                    bio: document.getElementById('profile-bio').value
                };
                
                localStorage.setItem('userData', JSON.stringify(userData));
                showMessage('Profile updated successfully!', 'success', 'profile-message');
                trackEvent('Dashboard', 'Profile Update');
            });
        }

        // Export data button
        const exportButton = document.getElementById('export-data');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                const data = JSON.stringify(userData, null, 2);
                const blob = new Blob([data], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `civictrack-data-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                trackEvent('Dashboard', 'Data Exported');
            });
        }

        // Import data button
        const importInput = document.getElementById('import-data');
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = JSON.parse(e.target.result);
                        localStorage.setItem('userData', JSON.stringify(data));
                        showMessage('Data imported successfully! Page will reload.', 'success', 'profile-message');
                        trackEvent('Dashboard', 'Data Imported');
                        setTimeout(() => window.location.reload(), 1000);
                    } catch (error) {
                        showMessage('Invalid data file', 'error', 'profile-message');
                    }
                };
                reader.readAsText(file);
            });
        }

        // Logout button
        const logoutButton = document.getElementById('logout-btn');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                localStorage.removeItem('authToken');
                localStorage.removeItem('rememberMe');
                localStorage.removeItem('username');
                localStorage.removeItem('password');
                trackEvent('Dashboard', 'Logout');
                window.location.href = 'index.html';
            });
        }

        // Admin link visibility
        const adminLink = document.getElementById('admin-link');
        if (adminLink && userData.role === 'admin') {
            adminLink.style.display = 'block';
        }
    }

    // ========== ADMIN FUNCTIONALITY ==========
    if (document.getElementById('admin-content')) {
        const currentUser = getCurrentUser();
        
        if (!currentUser || currentUser.role !== 'admin') {
            window.location.href = 'dashboard.html';
            return;
        }

        // Load all users (simulated)
        function loadAllUsers() {
            const users = [];
            // For demo, just show the current user
            const currentUserData = JSON.parse(localStorage.getItem('userData'));
            if (currentUserData) {
                users.push(currentUserData);
            }
            
            const userList = document.getElementById('user-list');
            if (userList) {
                userList.innerHTML = '';
                
                users.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.username || 'N/A'}</td>
                        <td>${user.email || 'N/A'}</td>
                        <td>${user.role || 'user'}</td>
                        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>${user.verified ? 'Yes' : 'No'}</td>
                    `;
                    userList.appendChild(row);
                });
            }
        }

        loadAllUsers();

        // Analytics data
        function loadAnalytics() {
            const events = JSON.parse(localStorage.getItem('analyticsEvents') || []);
            const analyticsTable = document.getElementById('analytics-table');
            if (analyticsTable) {
                analyticsTable.innerHTML = '';
                
                events.forEach(event => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${event.userId}</td>
                        <td>${event.category}</td>
                        <td>${event.action}</td>
                        <td>${event.label || 'N/A'}</td>
                        <td>${new Date(event.timestamp).toLocaleString()}</td>
                    `;
                    analyticsTable.appendChild(row);
                });
            }
        }

        loadAnalytics();
    }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('ServiceWorker registration successful');
        }).catch(err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}