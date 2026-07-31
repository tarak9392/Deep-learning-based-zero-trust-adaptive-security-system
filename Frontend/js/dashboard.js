// Frontend/js/dashboard.js

if (typeof window.API_BASE_URL === 'undefined') {
    window.API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://127.0.0.1:5000/api' : '/api';
}
var API_BASE_URL = window.API_BASE_URL;

let telemetryLineChart = null;
let riskDoughnutChart = null;
let downloadCount = 0;
let threatsBlockedCount = 0;
let currentTrustScore = 100.0;
let userRole = 'Student';
let username = 'User';
let temporaryEscalations = {
    email: false,
    payroll: false,
    hr: false,
    production: false
};
let pendingRequestsMap = {};


function parseJwt(token) {
    if (!token || typeof token !== 'string') return {};
    try {
        const parts = token.split('.');
        if (parts.length < 2) return {};
        let base64Url = parts[1];
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT parse error:", e);
        return {};
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
        return;
    }

    // Decode JWT payload safely
    const payload = parseJwt(token);
    userRole = payload.role || 'Student';
    username = payload.username || 'User';

    // Set navbar & session fingerprint elements safely
    const navUserEl = document.getElementById('navUsername');
    if (navUserEl) navUserEl.innerText = username;
    const dashUserEl = document.getElementById('dashUserDisplay');
    if (dashUserEl) dashUserEl.innerText = username;
    const navRoleEl = document.getElementById('navRoleBadge');
    if (navRoleEl) navRoleEl.innerText = userRole;

    if (userRole === 'Admin' || userRole === 'HR') {
        const salaryBadge = document.getElementById('salaryAccess');
        if (salaryBadge) {
            salaryBadge.className = 'badge bg-success font-mono';
            salaryBadge.innerHTML = '<i class="fa-solid fa-lock-open me-1"></i> Unlocked';
        }
    }

    if (userRole === 'Admin') {
        const adminBadge = document.getElementById('adminAccess');
        if (adminBadge) {
            adminBadge.className = 'badge bg-success font-mono';
            adminBadge.innerHTML = '<i class="fa-solid fa-lock-open me-1"></i> Unlocked';
        }
        const adminLink = document.getElementById('adminLink');
        if (adminLink) {
            adminLink.style.display = 'inline-block';
        }
    }

    // Auto-detect Geo location for dashboard card
    fetchGeoLocation();

    // Initialize Radial Gauge & Evaluate Gates immediately
    try {
        updateTrustGauge(100.0);
        evaluateResourceGates();
        checkServerAccessApprovals();
    } catch(e) {
        console.error("Init gauge/gates error:", e);
    }

    // Initialize Charts safely
    try {
        initCharts();
    } catch(e) {
        console.error("Init charts error:", e);
    }

    // Add Initial Event Logs
    try {
        addLogStreamEntry("SYSTEM_INIT", "127.0.0.1", 100.0, "Success", "Session Authenticated via MFA");
    } catch(e) {}


    // Live Telemetry Loop (updates counters, telemetry chart, and gates)
    setInterval(() => {
        updateTelemetryMetrics();
        checkServerAccessApprovals();
    }, 2000);
});

let temporaryEscalations = {
    email: false,
    payroll: false,
    hr: false,
    production: false
};

let pendingRequestsMap = {}; // key -> status ('Pending', 'Approved', 'Denied')

async function checkServerAccessApprovals() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/check_access_status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        
        let newPendingMap = {};
        if (data.requests) {
            data.requests.forEach(r => {
                if (r.is_active) {
                    temporaryEscalations[r.resource_key] = true;
                    newPendingMap[r.resource_key] = 'Approved';
                } else if (r.status === 'Pending') {
                    newPendingMap[r.resource_key] = 'Pending';
                } else if (r.status === 'Denied') {
                    newPendingMap[r.resource_key] = 'Denied';
                }
            });
        }
        pendingRequestsMap = newPendingMap;
        evaluateResourceGates();
    } catch(e) {
        console.error("Error checking access status", e);
    }
}

function evaluateResourceGates() {
    const score = currentTrustScore;
    const role = userRole;

    // Resource 1: Email (Trust > 30%)
    const emailUnlocked = (score > 30.0) || temporaryEscalations.email;
    updateBadge('badgeEmail', emailUnlocked, 'email');

    // Resource 2: Payroll (HR/Admin/Finance AND Trust > 70%)
    const payrollRoleOk = ['Admin', 'HR', 'Finance'].includes(role) || temporaryEscalations.payroll;
    const payrollUnlocked = payrollRoleOk && (score > 70.0);
    updateBadge('badgePayroll', payrollUnlocked, 'payroll');

    // Resource 3: HR Database (Admin Only AND Trust > 85%)
    const hrRoleOk = (role === 'Admin') || temporaryEscalations.hr;
    const hrUnlocked = hrRoleOk && (score > 85.0);
    updateBadge('badgeHr', hrUnlocked, 'hr');

    // Resource 4: Production Core (Admin Only AND Trust > 90%)
    const prodRoleOk = (role === 'Admin') || temporaryEscalations.production;
    const prodUnlocked = prodRoleOk && (score > 90.0);
    updateBadge('badgeProd', prodUnlocked, 'production');
}

function updateBadge(badgeId, isUnlocked, key) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;

    if (isUnlocked) {
        badge.className = 'badge bg-success font-mono';
        badge.innerHTML = '<i class="fa-solid fa-lock-open me-1"></i> Unlocked';
    } else if (pendingRequestsMap[key] === 'Pending') {
        badge.className = 'badge bg-warning text-dark font-mono';
        badge.innerHTML = '<i class="fa-solid fa-clock me-1"></i> Pending Admin Approval';
    } else if (pendingRequestsMap[key] === 'Denied') {
        badge.className = 'badge bg-danger font-mono';
        badge.innerHTML = '<i class="fa-solid fa-ban me-1"></i> Request Denied';
    } else {
        badge.className = 'badge bg-danger font-mono';
        badge.innerHTML = '<i class="fa-solid fa-lock me-1"></i> Locked';
    }
}

async function fetchGeoLocation() {
    const geoEl = document.getElementById('dashGeo');
    try {
        const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await response.json();
        if (data.city) {
            geoEl.innerText = `${data.city}, ${data.country_code || ''}`;
        } else {
            geoEl.innerText = 'Hyderabad, IN';
        }
    } catch(e) {
        geoEl.innerText = 'Hyderabad, IN';
    }
}

// Radial Gauge Renderer
function updateTrustGauge(score) {
    currentTrustScore = score;
    const gaugeVal = document.getElementById('gaugeVal');
    const gaugeStatus = document.getElementById('gaugeStatus');
    const gaugeDesc = document.getElementById('gaugeDesc');
    const arc = document.getElementById('trustGaugeArc');
    const livePill = document.getElementById('liveTrustScore');

    if (!gaugeVal || !arc) return;

    gaugeVal.innerText = `${score.toFixed(1)}%`;
    if (livePill) livePill.innerText = `${score.toFixed(1)}%`;

    // Circumference of radius 55 = 2 * PI * 55 ≈ 345.57
    const circumference = 345.57;
    const offset = circumference - (score / 100) * circumference;
    arc.style.strokeDashoffset = offset;

    if (score >= 75) {
        arc.style.stroke = '#10b981'; // Green
        gaugeStatus.className = 'badge badge-glow-success font-mono';
        gaugeStatus.innerText = 'SAFE';
        gaugeDesc.innerText = 'Optimal trust baseline established';
        if (livePill) livePill.className = 'badge bg-success font-mono fs-6';
    } else if (score >= 45) {
        arc.style.stroke = '#f59e0b'; // Yellow
        gaugeStatus.className = 'badge badge-warning text-dark font-mono';
        gaugeStatus.innerText = 'ELEVATED RISK';
        gaugeDesc.innerText = 'Step-up verification required';
        if (livePill) livePill.className = 'badge bg-warning font-mono fs-6';
    } else {
        arc.style.stroke = '#ef4444'; // Red
        gaugeStatus.className = 'badge badge-glow-danger font-mono';
        gaugeStatus.innerText = 'CRITICAL ANOMALY';
        gaugeDesc.innerText = 'Session isolation protocol active';
        if (livePill) livePill.className = 'badge bg-danger font-mono fs-6';
    }

    // Re-evaluate Resource Gates live whenever trust score changes
    evaluateResourceGates();
}

// Chart.js Setup
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js library is not available.");
        return;
    }
    if (telemetryLineChart) {
        telemetryLineChart.destroy();
    }
    if (riskDoughnutChart) {
        riskDoughnutChart.destroy();
    }

    // Line Chart (Live Telemetry)
    const ctxLine = document.getElementById('threatChart');
    if (ctxLine) {
        const now = new Date();
        const labels = Array.from({length: 6}, (_, i) => {
            const d = new Date(now.getTime() - (5 - i) * 10000);
            return d.toTimeString().slice(0, 8);
        });

        telemetryLineChart = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Trust Score Telemetry (%)',
                    data: [98, 99, 97, 100, 99, 100],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#cbd5e1', font: { family: 'JetBrains Mono' } } }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { color: '#cbd5e1', font: { family: 'JetBrains Mono' } },
                        grid: { color: 'rgba(255, 255, 255, 0.08)' }
                    },
                    x: {
                        ticks: { color: '#cbd5e1', font: { family: 'JetBrains Mono' } },
                        grid: { color: 'rgba(255, 255, 255, 0.08)' }
                    }
                }
            }
        });
    }

    // Doughnut Chart (Risk Vectors)
    const ctxDoughnut = document.getElementById('riskDoughnutChart');
    if (ctxDoughnut) {
        riskDoughnutChart = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: ['Keystroke Dynamics', 'Mouse Movement', 'IP Context', 'File Access Frequency'],
                datasets: [{
                    data: [40, 30, 20, 10],
                    backgroundColor: ['#6366f1', '#38bdf8', '#10b981', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                cutout: '70%'
            }
        });
    }
}

function pushTelemetryPoint(newScore) {
    if (!telemetryLineChart) return;
    const timeStr = new Date().toTimeString().slice(0, 8);
    telemetryLineChart.data.labels.push(timeStr);
    telemetryLineChart.data.datasets[0].data.push(newScore);

    if (telemetryLineChart.data.labels.length > 10) {
        telemetryLineChart.data.labels.shift();
        telemetryLineChart.data.datasets[0].data.shift();
    }
    telemetryLineChart.update();
}

function updateTelemetryMetrics() {
    // Read live counters if set by continuous_auth.js
    const wpmEl = document.getElementById('telemetryWpm');
    const mouseEl = document.getElementById('telemetryMouse');
    const idleEl = document.getElementById('telemetryIdle');

    if (wpmEl && typeof keyPresses !== 'undefined') {
        const estimatedWpm = Math.min(Math.round((keyPresses / 5) * 60) + 55, 180);
        wpmEl.innerText = estimatedWpm;
    }
    if (mouseEl && typeof mouseMovements !== 'undefined') {
        mouseEl.innerText = Math.max(mouseMovements, 45);
    }
    if (idleEl && typeof lastActivityTime !== 'undefined') {
        const idleSec = Math.floor((Date.now() - lastActivityTime) / 1000);
        idleEl.innerText = idleSec;
    }
}

// Live Security Log Stream
function addLogStreamEntry(eventType, ip, trustScore, status, details) {
    const tbody = document.querySelector('#dashLogStreamTable tbody');
    if (!tbody) return;

    const timeStr = new Date().toTimeString().slice(0, 8);
    let statusBadge = status === 'Success' ? 
        `<span class="badge bg-success font-mono"><i class="fa-solid fa-check"></i> ${status}</span>` : 
        `<span class="badge bg-danger font-mono"><i class="fa-solid fa-triangle-exclamation"></i> ${status}</span>`;

    let scoreColor = trustScore > 70 ? 'text-success' : (trustScore > 40 ? 'text-warning' : 'text-danger');

    const tr = document.createElement('tr');
    tr.className = 'animate-fade-in';
    tr.innerHTML = `
        <td class="text-muted font-mono small">${timeStr}</td>
        <td class="fw-bold text-white"><i class="fa-solid fa-shield-virus text-accent me-1"></i> ${eventType}</td>
        <td><span class="badge bg-dark border font-mono">${ip}</span></td>
        <td class="${scoreColor} font-mono fw-bold">${trustScore.toFixed(1)}%</td>
        <td>${statusBadge} <small class="text-muted ms-1">(${details})</small></td>
    `;

    tbody.insertBefore(tr, tbody.firstChild);
    if (tbody.children.length > 6) {
        tbody.removeChild(tbody.lastChild);
    }
}

// Interactive Simulation Handlers
function simulateBotTypist() {
    updateTrustGauge(35.0);
    pushTelemetryPoint(35.0);
    threatsBlockedCount++;
    document.getElementById('dashThreatsBlocked').innerText = threatsBlockedCount;
    document.getElementById('tickerMsg').innerText = '⚠️ ANOMALY DETECTED: Rapid Bot Typist (250 WPM) - Trust Score Reduced to 35.0%';
    
    addLogStreamEntry("BOT_TYPIST_ANOMALY", "192.168.1.105", 35.0, "Blocked (AI)", "Typing cadence exceeds human limit (Isolation Forest Score: -0.84)");

    Swal.fire({
        icon: 'warning',
        title: 'AI Threat Engine Triggered',
        html: '<div class="text-start"><p class="text-danger fw-bold"><i class="fa-solid fa-robot"></i> Inhuman Keystroke Dynamics Detected!</p><p class="small text-muted">Typing pattern matched synthetic bot script signature (250 WPM). Trust Score dropped to 35%.</p></div>',
        confirmButtonText: 'Review Threat Log'
    });
}

function simulateErraticMouse() {
    updateTrustGauge(48.5);
    pushTelemetryPoint(48.5);
    threatsBlockedCount++;
    document.getElementById('dashThreatsBlocked').innerText = threatsBlockedCount;
    document.getElementById('tickerMsg').innerText = '⚠️ ANOMALY DETECTED: Cursor Freeze & Straight Trajectory - Trust Score Reduced to 48.5%';
    
    addLogStreamEntry("MOUSE_ANOMALY", "192.168.1.105", 48.5, "Step-Up Required", "Erratic linear mouse vector detected");

    Swal.fire({
        icon: 'info',
        title: 'Behavioral Anomaly Warning',
        text: 'Abnormal mouse movement trajectory detected. Session flagged for step-up verification.',
        timer: 3000,
        showConfirmButton: false
    });
}

function resetBehaviorBaseline() {
    updateTrustGauge(100.0);
    pushTelemetryPoint(100.0);
    document.getElementById('tickerMsg').innerText = '⚡ AI Trust Engine: Baseline Restored | All Security Parameters Normal';
    addLogStreamEntry("BASELINE_RESET", "127.0.0.1", 100.0, "Success", "Admin reset baseline trust parameters");

    Swal.fire({
        icon: 'success',
        title: 'Baseline Restored',
        text: 'Behavioral telemetry baseline has been reset to 100% optimal trust.',
        timer: 2000,
        showConfirmButton: false
    });
}

function accessResource(key) {
    const score = currentTrustScore;
    const role = userRole;

    let title = '';
    let reqRole = '';
    let reqScore = 0;
    let isEscalated = temporaryEscalations[key];
    let content = '';

    if (key === 'email') {
        title = 'Corporate Email & Slack';
        reqRole = 'Any Authenticated User';
        reqScore = 30;
        content = '<div class="text-start p-3 bg-dark rounded border"><p class="text-success fw-bold mb-2"><i class="fa-solid fa-envelope-open-text me-1"></i> Webmail Inbox Active</p><ul class="small text-muted mb-0"><li>[INBOX] Security Compliance Newsletter - 10:00 AM</li><li>[SLACK] #general: System Update Deployed</li><li>[SECURITY] Session Encrypted TLS 1.3 | ABAC Verified</li></ul></div>';
    } else if (key === 'payroll') {
        title = 'Payroll & Finance System';
        reqRole = 'HR / Admin / Finance';
        reqScore = 70;
        content = '<div class="text-start p-3 bg-dark rounded border"><p class="text-warning fw-bold mb-2"><i class="fa-solid fa-file-invoice-dollar me-1"></i> Executive Payroll Vault</p><ul class="small text-muted mb-0"><li>Q3 Salary Disbursements: Processed ($125,000)</li><li>Tax Compliance Filings: Audit Passed</li><li>Direct Deposit Gateway: Active & Monitored</li></ul></div>';
    } else if (key === 'hr') {
        title = 'Confidential HR Database';
        reqRole = 'Admin Only';
        reqScore = 85;
        content = '<div class="text-start p-3 bg-dark rounded border"><p class="text-danger fw-bold mb-2"><i class="fa-solid fa-shield-cat me-1"></i> Restricted Personnel Records</p><ul class="small text-muted mb-0"><li>[CONFIDENTIAL] Executive Compensation Matrix</li><li>[AUDIT LOG] Employee Performance Reviews 2026</li><li>[ACCESS LEVEL] Restricted to Verified Administrators</li></ul></div>';
    } else if (key === 'production') {
        title = 'Production Infrastructure Core';
        reqRole = 'Admin Only';
        reqScore = 90;
        content = '<div class="text-start p-3 bg-dark rounded border"><p class="text-info fw-bold mb-2"><i class="fa-solid fa-microchip me-1"></i> Production Gateway Node</p><ul class="small text-muted mb-0"><li>Kubernetes Cluster Health: 99.99% Uptime</li><li>Zero Trust Proxy Tunnel: Active (Port 443)</li><li>Firewall Policy: Strict Isolation Enabled</li></ul></div>';
    }

    const isRoleOk = (key === 'email') || ['Admin', 'HR', 'Finance'].includes(role) || isEscalated || (key === 'hr' && role === 'Admin') || (key === 'production' && role === 'Admin');
    const isScoreOk = (score > reqScore);
    const isUnlocked = (isRoleOk && isScoreOk) || isEscalated;

    if (isUnlocked) {
        addLogStreamEntry("RESOURCE_ACCESS_GRANTED", "127.0.0.1", score, "Success", `Access granted to ${title}`);
        Swal.fire({
            icon: 'success',
            title: `Access Granted: ${title}`,
            html: content,
            confirmButtonText: 'Close System Portal'
        });
    } else {
        addLogStreamEntry("RESOURCE_ACCESS_DENIED", "127.0.0.1", score, "Blocked (ABAC)", `Denied access to ${title}`);
        
        let reason = '';
        if (!isRoleOk) reason += `<li>Required Role: <strong>${reqRole}</strong> (Your Role: <span class="text-danger">${role}</span>)</li>`;
        if (!isScoreOk) reason += `<li>Required Trust Score: <strong>&gt; ${reqScore}%</strong> (Current Score: <span class="text-warning">${score.toFixed(1)}%</span>)</li>`;

        Swal.fire({
            icon: 'error',
            title: `Access Denied: ${title}`,
            html: `<div class="text-start"><p class="text-danger fw-bold"><i class="fa-solid fa-lock text-danger me-1"></i> Zero Trust Policy Enforced</p><ul class="small text-muted mb-3">${reason}</ul></div>`,
            showCancelButton: true,
            confirmButtonText: 'Request Access Escalation',
            cancelButtonText: 'Close'
        }).then((result) => {
            if (result.isConfirmed) {
                requestResourceEscalation(key);
            }
        });
    }
}

function requestResourceEscalation(targetKey) {
    const resourceNames = {
        'email': 'Corporate Email & Slack',
        'payroll': 'Payroll & Finance System',
        'hr': 'Confidential HR Database',
        'production': 'Production Infrastructure'
    };

    const selectedKey = targetKey || 'payroll';
    const selectedName = resourceNames[selectedKey] || 'Restricted System';

    Swal.fire({
        title: `Request Access: ${selectedName}`,
        text: 'Provide a business justification for Administrator review:',
        input: 'textarea',
        inputPlaceholder: 'e.g. Requesting temporary access for semester audit verification...',
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
            const token = localStorage.getItem('token');

            try {
                const response = await fetch(`${API_BASE_URL}/auth/request_access`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        resource_key: selectedKey,
                        resource_name: selectedName,
                        justification: justification,
                        trust_score: currentTrustScore
                    })
                });

                if (response.ok) {
                    pendingRequestsMap[selectedKey] = 'Pending';
                    evaluateResourceGates();

                    addLogStreamEntry("ACCESS_REQUEST_SUBMITTED", "127.0.0.1", currentTrustScore, "Pending Admin Approval", `Escalation requested for ${selectedName}`);

                    Swal.fire({
                        icon: 'info',
                        title: 'Request Sent to Admin',
                        html: `<div class="text-start"><p class="text-info fw-bold mb-1"><i class="fa-solid fa-paper-plane text-info me-1"></i> Access Request Routed to Admin Queue!</p><p class="small text-muted mb-0">Resource: <strong>${selectedName}</strong><br>Status: <span class="badge bg-warning text-dark font-mono mt-1">Pending Admin Approval</span></p></div>`,
                        timer: 3500,
                        showConfirmButton: false
                    });
                } else {
                    Swal.fire('Error', 'Failed to submit request to Admin API.', 'error');
                }
            } catch(e) {
                Swal.fire('Error', 'Connection failure while contacting Zero Trust API.', 'error');
            }
        }
    });
}

function resetChartData() {
    if (!telemetryLineChart) return;
    telemetryLineChart.data.datasets[0].data = [98, 99, 97, 100, 99, 100];
    telemetryLineChart.update();
    updateTrustGauge(100.0);
}

// File Download Exfiltration Simulator
async function simulateDownload() {
    const token = localStorage.getItem('token');
    downloadCount++;
    document.getElementById('dashDownloadCount').innerText = downloadCount;

    Swal.fire({
        title: 'Accessing Confidential Vault...',
        html: '<div class="small text-muted font-mono"><i class="fa-solid fa-shield-halved fa-spin text-info me-1"></i> Running ABAC Data Sensitivity Inspection...</div>',
        timer: 1000,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    }).then(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/download`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ downloadCount: downloadCount })
            });
            const data = await response.json();

            updateTrustGauge(data.trust_score);
            pushTelemetryPoint(data.trust_score);

            if (data.action === 'logout') {
                threatsBlockedCount++;
                document.getElementById('dashThreatsBlocked').innerText = threatsBlockedCount;
                addLogStreamEntry("DATA_EXFILTRATION_BLOCKED", "127.0.0.1", data.trust_score, "Blocked (Data Exfiltration)", "Multiple high-frequency downloads detected");

                Swal.fire({
                    icon: 'error',
                    title: 'SECURITY VIOLATION DETECTED',
                    html: `<div class="text-start"><p class="text-danger fw-bold"><i class="fa-solid fa-hand text-danger"></i> Data Exfiltration Threshold Exceeded!</p><p class="small text-muted">AI Threat Engine detected excessive file downloads in short interval. Trust Score dropped to <strong>${data.trust_score.toFixed(1)}%</strong>. Session Terminated instantly.</p></div>`,
                    confirmButtonText: 'Acknowledge & Exit'
                }).then(() => {
                    logout();
                });
            } else {
                addLogStreamEntry("CONFIDENTIAL_DOWNLOAD", "127.0.0.1", data.trust_score, "Success", `Download #${downloadCount} Authorized`);
                Swal.fire({
                    icon: 'warning',
                    title: 'Restricted Download Warning',
                    html: `<span class="small">File downloaded. AI Trust Engine registered security event.<br><strong class="text-info">Current Score: ${data.trust_score.toFixed(1)}%</strong></span>`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
        } catch(e) {
            console.error("Download Error:", e);
        }
    });
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

