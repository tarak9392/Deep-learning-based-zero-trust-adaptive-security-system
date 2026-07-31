// Frontend/js/continuous_auth.js

if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://127.0.0.1:5000/api' : '/api';
}
var API_BASE_URL = window.API_BASE_URL;


let keyPresses = 0;
let mouseMovements = 0;
let lastActivityTime = Date.now();
const AUTH_INTERVAL = 10000; // Check every 10 seconds

// Track Activity
document.addEventListener('keydown', () => {
    keyPresses++;
    lastActivityTime = Date.now();
});

document.addEventListener('mousemove', () => {
    mouseMovements++;
    lastActivityTime = Date.now();
});

// Send Analytics to Backend
setInterval(async () => {
    const idleTime = Math.floor((Date.now() - lastActivityTime) / 1000);
    const token = localStorage.getItem('token');
    
    if (!token) return; // Not logged in

    try {
        const response = await fetch(`${API_BASE_URL}/auth/continuous_monitor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                keyPresses: keyPresses,
                mouseMovements: mouseMovements,
                idleTimeSeconds: idleTime
            })
        });

        if (!response.ok) return;
        const data = await response.json();
        
        // Save current telemetry counters before resetting
        const currentKeys = keyPresses;
        const currentMouse = mouseMovements;

        // Reset counters
        keyPresses = 0;
        mouseMovements = 0;

        if (data.action === 'logout') {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Session Terminated',
                    text: 'Your trust score dropped below the required threshold due to anomalous behavior.',
                    confirmButtonText: 'OK'
                }).then(() => {
                    localStorage.removeItem('token');
                    window.location.href = 'login.html';
                });
            } else {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
            }
            return;
        }
        
        // Update live trust score gauge, gates, and telemetry charts
        if (typeof updateTrustGauge === 'function' && data.trust_score !== undefined) {
            updateTrustGauge(data.trust_score);
        }
        if (typeof evaluateResourceGates === 'function') {
            evaluateResourceGates();
        }
        if (typeof pushTelemetryPoint === 'function' && data.trust_score !== undefined) {
            pushTelemetryPoint(data.trust_score);
        }

        // Update real-time WPM, Mouse Trajectory, and Idle Time DOM counters
        const wpmEl = document.getElementById('telemetryWpm') || document.getElementById('dashWpm');
        if (wpmEl) {
            const estimatedWpm = Math.round((currentKeys / 5) * 6);
            wpmEl.innerText = estimatedWpm;
        }
        const mouseEl = document.getElementById('telemetryMouse') || document.getElementById('dashMouse');
        if (mouseEl) {
            mouseEl.innerText = currentMouse;
        }
        const idleEl = document.getElementById('dashIdle');
        if (idleEl) {
            idleEl.innerText = idleTime;
        }

    } catch (error) {
        console.error("Continuous Monitoring Error:", error);
    }
}, AUTH_INTERVAL);
