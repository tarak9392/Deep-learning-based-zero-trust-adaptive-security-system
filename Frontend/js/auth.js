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

    // Auto-fetch real exact location using HTML5 Geolocation and multi-provider IP reverse geocoding
    async function fetchRealLocation(forceRefresh = false) {
        const loader = document.getElementById('locLoader');
        const locSelect = document.getElementById('simLocation');
        if (!locSelect) return;
        
        // 0. Use user's saved preferred city if already stored in localStorage (unless force refreshed)
        const savedCity = localStorage.getItem('saved_real_city');
        if (savedCity && savedCity !== 'Unknown' && savedCity !== 'Detecting your location...' && !forceRefresh) {
            locSelect.value = savedCity;
            realLocation = savedCity;
            if (loader) loader.style.display = 'none';
            return;
        }

        if (loader) loader.style.display = 'inline-block';

        const updateSelectOption = (detectedCity) => {
            if (detectedCity) {
                realLocation = detectedCity;
                if (locSelect.tagName === 'INPUT') {
                    locSelect.value = realLocation;
                } else if (locSelect.options) {
                    locSelect.options[0].text = `📍 Auto-detect (${realLocation})`;
                    locSelect.options[0].value = realLocation;
                }
                localStorage.setItem('saved_real_city', realLocation);
            }
        };

        // Save typed location whenever user changes it manually
        locSelect.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val && val !== 'Unknown' && val !== 'Russia' && val !== 'Tor Node') {
                localStorage.setItem('saved_real_city', val);
                realLocation = val;
            }
        });

        // 1. Try HTML5 Browser GPS Geolocation for exact device positioning
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;

                        // 1a. Try OpenStreetMap Nominatim reverse geocoding
                        try {
                            const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
                                headers: { 'Accept-Language': 'en' }
                            });
                            if (nomRes.ok) {
                                const nomData = await nomRes.json();
                                const addr = nomData.address || {};
                                const place = addr.city || addr.town || addr.village || addr.suburb || addr.neighbourhood || addr.municipality || addr.district || addr.county || addr.state_district;
                                const state = addr.state;
                                let formatted = place;
                                if (place && state && !place.toLowerCase().includes(state.toLowerCase())) {
                                    formatted = `${place}, ${state}`;
                                }
                                if (formatted) {
                                    updateSelectOption(formatted);
                                    if (loader) loader.style.display = 'none';
                                    return;
                                }
                            }
                        } catch(nomErr) {
                            console.warn('Nominatim reverse geocode error:', nomErr);
                        }

                        // 1b. Try BigDataCloud reverse geocoding
                        try {
                            const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                            if (geoRes.ok) {
                                const geoData = await geoRes.json();
                                const place = geoData.city || geoData.locality || geoData.principalSubdivision;
                                const state = geoData.principalSubdivision;
                                let formatted = place;
                                if (place && state && place !== state && !place.toLowerCase().includes(state.toLowerCase())) {
                                    formatted = `${place}, ${state}`;
                                }
                                if (formatted) {
                                    updateSelectOption(formatted);
                                    if (loader) loader.style.display = 'none';
                                    return;
                                }
                            }
                        } catch (bdcErr) {
                            console.warn('BigDataCloud reverse geocode error:', bdcErr);
                        }
                    } catch (err) {
                        console.warn('GPS reverse geocode fallback to IP services:', err);
                    }
                    fallbackIpLocation();
                },
                (err) => {
                    console.log('HTML5 Geolocation prompt skipped/denied/timed out, using IP detection:', err.message);
                    fallbackIpLocation();
                },
                { timeout: 8000, maximumAge: 0, enableHighAccuracy: true }
            );
        } else {
            fallbackIpLocation();
        }

        // 2. IP Geolocation Multi-Provider Fallback
        async function fallbackIpLocation() {
            const providers = [
                async () => {
                    const res = await fetch('https://ipapi.co/json/');
                    if (!res.ok) return null;
                    const data = await res.json();
                    if (data.city) return data.region ? `${data.city}, ${data.region}` : data.city;
                    return null;
                },
                async () => {
                    const res = await fetch('https://ipwho.is/');
                    if (!res.ok) return null;
                    const data = await res.json();
                    if (data.success && data.city) return data.region ? `${data.city}, ${data.region}` : data.city;
                    return null;
                },
                async () => {
                    const res = await fetch('https://freeipapi.com/api/json');
                    if (!res.ok) return null;
                    const data = await res.json();
                    if (data.cityName) return data.regionName ? `${data.cityName}, ${data.regionName}` : data.cityName;
                    return null;
                },
                async () => {
                    const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
                    if (!res.ok) return null;
                    const data = await res.json();
                    if (data.city) return data.region ? `${data.city}, ${data.region}` : data.city;
                    return null;
                },
                async () => {
                    const res = await fetch('https://ipinfo.io/json');
                    if (!res.ok) return null;
                    const data = await res.json();
                    if (data.city) return data.region ? `${data.city}, ${data.region}` : data.city;
                    return null;
                }
            ];

            for (const provider of providers) {
                try {
                    const loc = await provider();
                    if (loc) {
                        updateSelectOption(loc);
                        if (loader) loader.style.display = 'none';
                        return;
                    }
                } catch (e) {
                    console.warn('IP location provider error:', e);
                }
            }

            if (loader) loader.style.display = 'none';
        }
    }
    window.fetchRealLocation = fetchRealLocation;
    fetchRealLocation();

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            localStorage.removeItem('token');

            
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
                        current2FAUsername = username;
                        // Trigger OTP email/SMS generation automatically
                        fetch(`${API_BASE_URL}/auth/send_otp`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username: username })
                        });

                        Swal.fire({
                            title: 'Step-Up OTP Verification Required',
                            text: data.message || 'Your dynamic trust score requires 6-digit OTP verification.',
                            icon: 'info',
                            input: 'text',
                            inputPlaceholder: 'Enter 6-digit OTP code',
                            showCancelButton: true,
                            confirmButtonText: 'Verify OTP & Log In',
                            inputValidator: (val) => {
                                if (!val || val.trim().length < 6) {
                                    return 'Please enter the 6-digit OTP verification code';
                                }
                            }
                        }).then(async (result) => {
                            if (result.isConfirmed && result.value) {
                                const otpCode = result.value.trim();
                                try {
                                    const vRes = await fetch(`${API_BASE_URL}/auth/verify_2fa`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            username: username,
                                            otp_code: otpCode,
                                            biometric: false
                                        })
                                    });
                                    const vData = await vRes.json();
                                    if (vRes.ok) {
                                        localStorage.setItem('token', vData.token);
                                        const targetPage = (vData.role === 'Admin' || username === 'admin' || username === 'hr') ? 'admin.html' : 'dashboard.html';
                                        Swal.fire({
                                            icon: 'success',
                                            title: 'Access Granted',
                                            text: 'OTP Verification Successful. Redirecting...',
                                            timer: 1400,
                                            showConfirmButton: false
                                        }).then(() => {
                                            window.location.href = targetPage;
                                        });
                                    } else {
                                        Swal.fire('Verification Failed', vData.message || 'Invalid OTP', 'error');
                                    }
                                } catch(e) {
                                    Swal.fire('Error', 'Connection failure during OTP verification', 'error');
                                }
                            }
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

                    const reqUsername = data.username || username;

                    Swal.fire({
                        icon: 'error',
                        title: 'Access Denied',
                        html: errorHtml,
                        showCancelButton: true,
                        confirmButtonText: '<i class="fa-solid fa-paper-plane me-1"></i> Request Access / Unblock from Admin',
                        cancelButtonText: 'Close'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            promptSendAccessRequest(reqUsername);
                        }
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
                            text: 'Fingerprint matched. Redirecting to Zero Trust Command Center...',
                            timer: 1400,
                            showConfirmButton: false
                        }).then(() => {
                            window.location.href = 'dashboard.html';
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
                text: 'Redirecting to Zero Trust Command Center...',
                timer: 1400,
                showConfirmButton: false
            }).then(() => {
                window.location.href = 'dashboard.html';
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

    const phone = phoneInput ? phoneInput.value.trim() : '';
    if (!phone || phone.length < 8) {
        Swal.fire('Phone Number Required', 'Please enter a valid real mobile phone number.', 'warning');
        return;
    }

    const keyInput = document.getElementById('callmebotKeyInput');
    let callmebotKey = keyInput ? keyInput.value.trim() : '';
    if (!callmebotKey) {
        callmebotKey = localStorage.getItem('callmebot_api_key') || '';
        if (callmebotKey && keyInput) keyInput.value = callmebotKey;
    } else {
        localStorage.setItem('callmebot_api_key', callmebotKey);
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
                mobile_number: phone,
                callmebot_key: callmebotKey
            })
        });
        const data = await response.json();

        if (response.ok) {
            const generatedOtp = data.otp_code;
            const providerInfo = data.sms_provider || 'Simulated Gateway';
            const sentRealSms = data.sent_real_sms;

            // Log code to browser console for developer reference
            console.log(`%c[ZeroTrust 2FA OTP] Code for ${phone}: ${generatedOtp}`, 'color: #38bdf8; font-weight: bold; font-size: 14px;');

            if (statusText) {
                statusText.className = sentRealSms ? 'text-success small font-mono' : 'text-warning small font-mono';
                statusText.innerHTML = sentRealSms 
                    ? `<i class="fa-solid fa-check-circle me-1"></i> Dispatched to ${phone} via ${providerInfo}`
                    : `<i class="fa-solid fa-triangle-exclamation me-1"></i> Dispatched via Gateway (${providerInfo})`;
            }

            // Display Automated Real-Time Server-Push 2FA Dispatch Modal
            Swal.fire({
                icon: sentRealSms ? 'success' : 'info',
                title: sentRealSms ? '📱 Real-Time SMS Dispatched' : '📱 2FA Code Triggered',
                html: `
                    <div class="text-start p-3 bg-dark rounded border border-info font-mono">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="text-info fw-bold"><i class="fa-solid fa-mobile-screen text-info me-1"></i> Recipient: ${phone}</span>
                            <span class="badge ${sentRealSms ? 'bg-success' : 'bg-warning text-dark'} font-mono" style="font-size: 0.7rem;">${sentRealSms ? providerInfo : 'Server Push Gateway'}</span>
                        </div>
                        
                        ${sentRealSms ? `
                            <div class="p-2 bg-black rounded text-success small border border-success mb-2">
                                <i class="fa-solid fa-circle-check me-1"></i> Real-time automated message pushed to <strong>${phone}</strong> via <strong>${providerInfo}</strong>. Check your mobile SMS inbox.
                            </div>
                        ` : `
                            <div class="p-2 bg-black rounded text-white small border border-secondary mb-2">
                                <i class="fa-solid fa-paper-plane text-warning me-1"></i> Server pushed 2FA dispatch request to mobile gateway for <strong>${phone}</strong>.
                            </div>
                            <div class="text-center p-2 rounded bg-black border border-info">
                                <span class="text-muted small">Demo / Testing 2FA Code:</span>
                                <div class="fs-4 text-warning fw-bold font-mono tracking-widest my-1">${generatedOtp}</div>
                                <button type="button" class="btn btn-xs btn-info font-mono text-dark py-1 px-3 fw-bold" onclick="autoFillOtp('${generatedOtp}')">
                                    <i class="fa-solid fa-paste me-1"></i> Auto-fill OTP
                                </button>
                            </div>
                        `}
                    </div>
                `,
                showConfirmButton: true,
                confirmButtonText: 'Enter 6-Digit OTP',
                confirmButtonColor: '#0ea5e9'
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

function promptSendAccessRequest(username) {
    const targetUser = username || document.getElementById('username')?.value || 'student';
    Swal.fire({
        title: 'Request Access / Unblock from Admin',
        html: `<p class="small text-muted mb-2">Requesting access / account unblock for user: <strong class="text-info">${targetUser}</strong></p>`,
        input: 'textarea',
        inputPlaceholder: 'State your reason or justification (e.g. Account disabled during testing, requesting unblock...)',
        showCancelButton: true,
        confirmButtonText: 'Submit Request to Admin',
        inputValidator: (value) => {
            if (!value || value.trim().length < 5) {
                return 'Please enter a valid justification (at least 5 characters)';
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const justification = result.value.trim();
            try {
                const response = await fetch(`${API_BASE_URL}/auth/request_access`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: targetUser,
                        resource_key: 'login_unblock',
                        resource_name: 'Account Access & Unblock',
                        justification: justification,
                        trust_score: 100.0
                    })
                });
                const resData = await response.json();
                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Access Request Sent',
                        html: `<div class="text-start"><p class="text-info fw-bold mb-1"><i class="fa-solid fa-paper-plane text-info me-1"></i> Request Routed to Administrator!</p><p class="small text-muted mb-0">Applicant: <strong>${targetUser}</strong><br>Status: <span class="badge bg-warning text-dark font-mono mt-1">Pending Admin Approval</span></p></div>`
                    });
                } else {
                    Swal.fire('Error', resData.message || 'Failed to submit access request.', 'error');
                }
            } catch(e) {
                Swal.fire('Error', 'Connection failure while routing access request to Admin.', 'error');
            }
        }
    });
}
