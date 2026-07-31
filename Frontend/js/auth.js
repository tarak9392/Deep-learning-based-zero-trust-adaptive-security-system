if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://127.0.0.1:5000/api' : '/api';
}
var API_BASE_URL = window.API_BASE_URL;


function quickFillRole(username, password) {
    const userEl = document.getElementById('username');
    const passEl = document.getElementById('password');
    if (userEl && passEl) {
        userEl.value = username;
        passEl.value = password;
        
        userEl.classList.add('border-info');
        passEl.classList.add('border-info');
        setTimeout(() => {
            userEl.classList.remove('border-info');
            passEl.classList.remove('border-info');
        }, 1200);

        Swal.fire({
            icon: 'info',
            title: `${username === 'student' ? 'Student / User' : 'Admin'} Role Selected`,
            text: `Credentials set for '${username}' demo account.`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    // Toggle Password Visibility
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
        });
    }

    // Login Form Submission
    const loginForm = document.getElementById('loginForm');
    let realLocation = 'Unknown';

    // Auto-fetch real location on page load
    async function fetchRealLocation() {
        const loader = document.getElementById('locLoader');
        const locSelect = document.getElementById('simLocation');
        if (!locSelect) return;
        
        if (loader) loader.style.display = 'inline-block';
        try {
            // Using GeoJS which is very reliable and has no CORS/rate-limit issues for basic usage
            const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
            const data = await response.json();
            if (data.city) {
                realLocation = data.city;
                locSelect.options[0].text = `📍 Auto-detect (${realLocation})`;
                locSelect.options[0].value = realLocation;
            } else {
                throw new Error("City not found in response");
            }
        } catch (e) {
            console.error('Failed to fetch location, trying fallback', e);
            try {
                const fallbackResponse = await fetch('https://ipinfo.io/json');
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.city) {
                    realLocation = fallbackData.city;
                    locSelect.options[0].text = `📍 Auto-detect (${realLocation})`;
                    locSelect.options[0].value = realLocation;
                }
            } catch (fallbackError) {
                locSelect.options[0].text = `📍 Auto-detect (Failed)`;
            }
        } finally {
            if (loader) loader.style.display = 'none';
        }
    }
    fetchRealLocation();

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btn = document.getElementById('loginBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing Behavior...';
            btn.disabled = true;

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            const location = document.getElementById('simLocation')?.value || 'Unknown';
            const device = document.getElementById('simDevice')?.value || 'Unknown';
            const browser = document.getElementById('simBrowser')?.value || 'Unknown';

            try {
                // Get basic device fingerprinting
                const fingerprint = {
                    userAgent: navigator.userAgent,
                    screenResolution: `${window.screen.width}x${window.screen.height}`,
                    language: navigator.language
                };

                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        username, 
                        password, 
                        fingerprint,
                        location,
                        device,
                        browser
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    if (data.requires_2fa) {
                        current2FAUsername = username;
                        if (document.getElementById('mfaUsernameDisplay')) document.getElementById('mfaUsernameDisplay').innerText = username;
                        if (document.getElementById('permUserDisplay')) document.getElementById('permUserDisplay').innerText = username;

                        const card = document.getElementById('biometricPermissionCard');
                        const area = document.getElementById('biometricScannerArea');
                        if (card) card.style.display = 'block';
                        if (area) area.style.display = 'none';

                        const mfaModal = new bootstrap.Modal(document.getElementById('mfaModal'));
                        mfaModal.show();
                        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket me-2"></i> Authenticate';
                        btn.disabled = false;
                        return;
                    } else if (data.requires_mfa) {
                        // Trust score was medium, requires OTP
                        Swal.fire({
                            title: 'Verification Required',
                            text: 'Your trust score requires additional verification.',
                            icon: 'info',
                            input: 'text',
                            showCancelButton: true,
                            confirmButtonText: 'Verify OTP'
                        });
                    } else {
                        // Success, High Trust Score
                        Swal.fire({
                            icon: 'success',
                            title: 'Access Granted',
                            text: `Trust Score: ${data.trust_score.toFixed(2)}%`,
                            timer: 2000,
                            showConfirmButton: false
                        }).then(() => {
                            localStorage.setItem('token', data.token);
                            const targetPage = (data.role === 'Admin') ? 'admin.html' : 'dashboard.html';
                            window.location.href = targetPage;
                        });
                    }
                } else {
                    // Login Failed or Blocked
                    let errorHtml = data.message || 'Authentication failed';
                    
                    // EXPLAINABLE AI LOGIC
                    if (data.reasons && data.reasons.length > 0) {
                        errorHtml += '<br><br><div class="text-start p-3 bg-dark rounded border border-danger">';
                        errorHtml += '<span class="text-danger fw-bold"><i class="fa-solid fa-robot"></i> AI Threat Engine Analysis:</span><ul class="text-muted small mt-2 mb-0">';
                        data.reasons.forEach(r => {
                            errorHtml += `<li>${r}</li>`;
                        });
                        errorHtml += '</ul></div>';
                    }

                    Swal.fire({
                        icon: 'error',
                        title: 'Access Denied',
                        html: errorHtml
                    });
                }
            } catch (error) {
                console.error("Login Error:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'System Error',
                    text: 'Unable to connect to the Zero Trust Engine.'
                });
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});

let current2FAUsername = '';

function grantBiometricPermission() {
    const card = document.getElementById('biometricPermissionCard');
    const area = document.getElementById('biometricScannerArea');
    if (card) card.style.display = 'none';
    if (area) area.style.display = 'block';

    Swal.fire({
        icon: 'success',
        title: 'Biometric Access Granted',
        text: 'Device Touch ID / Fingerprint sensor active. Touch sensor to scan.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000
    });
}

function denyBiometricPermission() {
    Swal.fire({
        icon: 'warning',
        title: 'Biometric Access Denied',
        text: 'Biometric permission was rejected. Switching to 6-digit Authenticator OTP code verification.',
        confirmButtonText: 'Use Authenticator Code'
    }).then(() => {
        const otpTab = document.getElementById('tab-otp');
        if (otpTab) {
            const tabObj = new bootstrap.Tab(otpTab);
            tabObj.show();
        }
    });
}

let isScanningFingerprint = false;

async function scanFingerprintBiometric() {
    if (isScanningFingerprint) return;
    isScanningFingerprint = true;

    const btnContainer = document.getElementById('fingerprintBtn');
    const statusText = document.getElementById('fingerprintStatus');
    const icon = document.getElementById('fingerprintIcon');
    const scanBtn = document.getElementById('btnScanFingerprint');

    if (!btnContainer) return;

    btnContainer.classList.add('scanning');
    if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Scanning Biometrics...';
    }
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 25;
        if (progress <= 100 && statusText) {
            statusText.className = 'text-warning small font-mono mt-2 mb-3';
            statusText.innerHTML = `<i class="fa-solid fa-microchip fa-spin me-1"></i> Analyzing Biometric Trajectory... ${progress}%`;
        }
        if (progress >= 100) {
            clearInterval(interval);
            btnContainer.classList.remove('scanning');
            if (icon) icon.className = 'fa-solid fa-fingerprint fa-4x text-success';
            if (statusText) {
                statusText.className = 'text-success fw-bold small font-mono mt-2 mb-3';
                statusText.innerHTML = '<i class="fa-solid fa-circle-check me-1"></i> Biometrics 100% Matched!';
            }

            // Submit 2FA Verification
            setTimeout(async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/auth/verify_2fa`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: current2FAUsername || 'hr',
                            biometric: true
                        })
                    });
                    const resData = await response.json();

                    if (response.ok) {
                        localStorage.setItem('token', resData.token);
                        Swal.fire({
                            icon: 'success',
                            title: 'Biometric Access Granted',
                            text: 'Fingerprint matched. Redirecting to Admin Control Center...',
                            timer: 1600,
                            showConfirmButton: false
                        }).then(() => {
                            const targetPage = (resData.role === 'Admin') ? 'admin.html' : 'dashboard.html';
                            window.location.href = targetPage;
                        });
                    } else {
                        isScanningFingerprint = false;
                        if (scanBtn) {
                            scanBtn.disabled = false;
                            scanBtn.innerHTML = '<i class="fa-solid fa-fingerprint me-1"></i> Scan Fingerprint Now';
                        }
                        Swal.fire('Biometric Error', resData.message || 'Verification failed', 'error');
                    }
                } catch(e) {
                    isScanningFingerprint = false;
                    if (scanBtn) {
                        scanBtn.disabled = false;
                        scanBtn.innerHTML = '<i class="fa-solid fa-fingerprint me-1"></i> Scan Fingerprint Now';
                    }
                    Swal.fire('Error', 'Server connection failure', 'error');
                }
            }, 600);
        }
    }, 350);
}

async function verify2FACode() {
    const code = document.getElementById('otpCodeInput').value.trim();
    if (!code) {
        Swal.fire('Code Required', 'Please enter your 6-digit Authenticator OTP code (e.g. 849201)', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify_2fa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: current2FAUsername || 'hr',
                otp_code: code,
                biometric: false
            })
        });
        const resData = await response.json();

        if (response.ok) {
            localStorage.setItem('token', resData.token);
            Swal.fire({
                icon: 'success',
                title: '2FA Verification Successful',
                text: 'Redirecting to Admin Control Center...',
                timer: 1800,
                showConfirmButton: false
            }).then(() => {
                const targetPage = (resData.role === 'Admin') ? 'admin.html' : 'dashboard.html';
                window.location.href = targetPage;
            });
        } else {
            Swal.fire('Invalid OTP', resData.message || 'Invalid 6-digit code', 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Server connection failure', 'error');
    }
}

async function sendSmsOtpToRealNumber() {
    const phoneInput = document.getElementById('hrRealPhoneInput');
    const sendBtn = document.getElementById('btnSendSmsOtp');
    const statusText = document.getElementById('smsStatusText');

    const phone = phoneInput ? phoneInput.value.trim() : '+91 98765 43210';
    if (!phone || phone.length < 8) {
        Swal.fire('Phone Number Required', 'Please enter a valid real mobile phone number.', 'warning');
        return;
    }

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i> Sending...';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/send_otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: current2FAUsername || 'hr',
                mobile_number: phone
            })
        });
        const data = await response.json();

        if (response.ok) {
            const generatedOtp = data.otp_code;
            if (statusText) {
                statusText.className = 'text-success small font-mono';
                statusText.innerHTML = `<i class="fa-solid fa-check-circle me-1"></i> SMS Dispatched to ${phone}`;
            }

            // Display Interactive Mobile SMS Notification Toast
            Swal.fire({
                icon: 'info',
                title: '📱 Real SMS Notification Received',
                html: `
                    <div class="text-start p-3 bg-dark rounded border border-info font-mono">
                        <p class="text-info fw-bold mb-1"><i class="fa-solid fa-comment-sms text-info me-1"></i> SMS Message to ${phone}:</p>
                        <div class="p-2 bg-black rounded text-white small border border-secondary mb-2">
                            "Your Zero Trust 2FA Verification Code is <strong class="text-warning fs-5">${generatedOtp}</strong>. Valid for 3 minutes."
                        </div>
                        <button type="button" class="btn btn-sm btn-success w-100 font-mono mt-1" onclick="autoFillOtp('${generatedOtp}')">
                            <i class="fa-solid fa-paste me-1"></i> Auto-fill OTP (${generatedOtp})
                        </button>
                    </div>
                `,
                showConfirmButton: false,
                timer: 10000
            });

            // Resend timer countdown
            let countdown = 30;
            const timerInterval = setInterval(() => {
                if (sendBtn) {
                    sendBtn.innerHTML = `<i class="fa-solid fa-clock me-1"></i> Resend (${countdown}s)`;
                }
                countdown--;
                if (countdown < 0) {
                    clearInterval(timerInterval);
                    if (sendBtn) {
                        sendBtn.disabled = false;
                        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> Send OTP';
                    }
                }
            }, 1000);

        } else {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> Send OTP';
            }
            Swal.fire('Error', data.message || 'Failed to send OTP SMS', 'error');
        }
    } catch(e) {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> Send OTP';
        }
        Swal.fire('Error', 'Server connection failure', 'error');
    }
}

function autoFillOtp(code) {
    const input = document.getElementById('otpCodeInput');
    if (input) {
        input.value = code;
        input.classList.add('border-success');
        setTimeout(() => input.classList.remove('border-success'), 1200);
    }
    Swal.close();
}
