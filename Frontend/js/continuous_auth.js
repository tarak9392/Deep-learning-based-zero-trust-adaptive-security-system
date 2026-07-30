// Frontend/js/continuous_auth.js

if (typeof API_BASE_URL === 'undefined') {
    var API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://127.0.0.1:5000/api' : '/api';
}

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

        const data = await response.json();
        
        // Reset counters
        keyPresses = 0;
        mouseMovements = 0;

        if (data.action === 'logout') {
            Swal.fire({
                icon: 'error',
                title: 'Session Terminated',
                text: 'Your trust score dropped below the required threshold due to anomalous behavior.',
                confirmButtonText: 'OK'
            }).then(() => {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
            });
        }
        
        // Update live trust score if gauge exists
        const scoreElement = document.getElementById('liveTrustScore');
        if (scoreElement) {
            scoreElement.innerText = data.trust_score.toFixed(2) + '%';
        }

    } catch (error) {
        console.error("Monitoring Error:", error);
    }
}, AUTH_INTERVAL);
