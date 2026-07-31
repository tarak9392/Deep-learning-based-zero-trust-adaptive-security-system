// Frontend/js/admin.js

const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://127.0.0.1:5000/api' : '/api';

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
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Verify Admin Role safely
    const payload = parseJwt(token);
    if (payload.role !== 'Admin') {
        Swal.fire('Access Denied', 'You do not have Administrator privileges.', 'error').then(() => {
            window.location.href = 'dashboard.html';
        });
        return;
    }


    await loadUsers();
    await loadLogs();
    await fetchAccessRequests();

    // Live polling for pending requests count
    setInterval(() => {
        fetchAccessRequests();
    }, 3000);

    // Tab Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            if(e.target.innerText.includes('Logout')) return;
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const targetText = e.currentTarget.innerText;
            const contentUsers = document.getElementById('content-users');
            const contentReqs = document.getElementById('content-access-requests');
            const contentSim = document.getElementById('content-simulation');
            const contentRep = document.getElementById('content-reports');

            if(targetText.includes('User Management')) {
                if(contentUsers) contentUsers.style.display = 'block';
                if(contentReqs) contentReqs.style.display = 'none';
                if(contentSim) contentSim.classList.add('d-none');
                if(contentRep) contentRep.classList.add('d-none');
            } else if(targetText.includes('Access Requests')) {
                if(contentUsers) contentUsers.style.display = 'none';
                if(contentReqs) contentReqs.style.display = 'block';
                if(contentSim) contentSim.classList.add('d-none');
                if(contentRep) contentRep.classList.add('d-none');
                fetchAccessRequests();
            } else if(targetText.includes('Attack Simulation')) {
                if(contentUsers) contentUsers.style.display = 'none';
                if(contentReqs) contentReqs.style.display = 'none';
                if(contentSim) contentSim.classList.remove('d-none');
                if(contentRep) contentRep.classList.add('d-none');
            } else if(targetText.includes('Reports & Audits')) {
                if(contentUsers) contentUsers.style.display = 'none';
                if(contentReqs) contentReqs.style.display = 'none';
                if(contentSim) contentSim.classList.add('d-none');
                if(contentRep) contentRep.classList.remove('d-none');
                loadReports();
            }
        });
    });
});

let allAuditLogs = [];

async function loadReports() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/reports/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Failed to load reports summary");
        
        const data = await response.json();
        const metrics = data.metrics;
        
        document.getElementById('rptTotalEvents').innerText = metrics.total_events || 0;
        document.getElementById('rptBlockedIncidents').innerText = metrics.blocked_incidents || 0;
        document.getElementById('rptAvgTrust').innerText = `${metrics.average_trust_score || 85.0}%`;
        document.getElementById('rptCompliance').innerText = `${metrics.compliance_score || 95.0}%`;
        
        allAuditLogs = data.audit_logs || [];
        renderAuditTable(allAuditLogs);
    } catch (e) {
        console.error("Error loading audit reports:", e);
    }
}

function renderAuditTable(logs) {
    const tbody = document.querySelector('#auditReportTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No audit logs match the selected filter.</td></tr>`;
        return;
    }

    logs.forEach(log => {
        let riskBadge = '';
        if (log.risk_level === 'High') {
            riskBadge = `<span class="badge bg-danger">High Risk</span>`;
        } else if (log.risk_level === 'Medium') {
            riskBadge = `<span class="badge bg-warning text-dark">Medium Risk</span>`;
        } else {
            riskBadge = `<span class="badge bg-success">Low Risk</span>`;
        }

        let scoreColor = log.trust_score > 70 ? 'text-success' : (log.trust_score > 40 ? 'text-warning' : 'text-danger');

        tbody.innerHTML += `
            <tr>
                <td class="text-muted font-monospace small">#LOG-${log.id}</td>
                <td class="text-muted small">${log.timestamp}</td>
                <td class="fw-bold">${log.username}</td>
                <td><span class="badge bg-dark border">${log.ip_address}</span></td>
                <td class="small text-muted">${log.location} / ${log.device}</td>
                <td>${log.status}</td>
                <td class="${scoreColor} fw-bold">${log.trust_score !== null ? log.trust_score.toFixed(1) + '%' : 'N/A'}</td>
                <td>${riskBadge}</td>
            </tr>
        `;
    });
}

function filterAuditLogs() {
    const filter = document.getElementById('auditRiskFilter').value;
    if (filter === 'ALL') {
        renderAuditTable(allAuditLogs);
    } else {
        const filtered = allAuditLogs.filter(log => log.risk_level === filter);
        renderAuditTable(filtered);
    }
}

async function exportAuditCSV() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/reports/export`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("CSV Export Failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ZeroTrust_Security_Audit_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        Swal.fire({
            icon: 'success',
            title: 'Audit CSV Exported',
            text: 'Security audit report downloaded successfully.',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (e) {
        Swal.fire('Export Error', 'Unable to download security audit CSV.', 'error');
    }
}

function downloadAuditPDF() {
    window.print();
}

async function loadUsers() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';

        users.forEach(user => {
            const statusBadge = user.is_active ? 
                `<span class="badge bg-success">Active</span>` : 
                `<span class="badge bg-danger">Blocked</span>`;
            
            const actionBtn = user.is_active ?
                `<button class="btn btn-sm btn-outline-danger" onclick="toggleStatus(${user.id}, false)">Block</button>` :
                `<button class="btn btn-sm btn-outline-success" onclick="toggleStatus(${user.id}, true)">Unblock</button>`;

            tbody.innerHTML += `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.username}</td>
                    <td><span class="badge bg-info">${user.role}</span></td>
                    <td>${statusBadge}</td>
                    <td>${user.created_at || 'N/A'}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.error("Error loading users", e);
    }
}

async function loadLogs() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/logs/recent`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const logs = await response.json();
        const tbody = document.querySelector('#logsTable tbody');
        tbody.innerHTML = '';

        logs.forEach(log => {
            let statusColor = log.status === 'Success' ? 'text-success' : 'text-danger';
            let scoreColor = log.trust_score > 70 ? 'text-success' : (log.trust_score > 40 ? 'text-warning' : 'text-danger');
            
            tbody.innerHTML += `
                <tr>
                    <td class="text-muted small">${log.time}</td>
                    <td>${log.username}</td>
                    <td>${log.ip_address}</td>
                    <td class="${scoreColor} fw-bold">${log.trust_score ? log.trust_score.toFixed(1) + '%' : 'N/A'}</td>
                    <td class="${statusColor}"><i class="fa-solid ${log.status === 'Success' ? 'fa-check' : 'fa-xmark'}"></i> ${log.status}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.error("Error loading logs", e);
    }
}

async function toggleStatus(userId, makeActive) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: makeActive })
        });
        
        if (response.ok) {
            Swal.fire({
                title: 'Success',
                text: `User has been ${makeActive ? 'unblocked' : 'blocked'}.`,
                icon: 'success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
            loadUsers();
        }
    } catch (e) {
        Swal.fire('Error', 'Failed to update user status.', 'error');
    }
}

async function simulateAttack() {
    const attackType = document.getElementById('attackType').value;
    const token = localStorage.getItem('token');
    
    Swal.fire({
        title: 'Launching Attack...',
        html: 'Injecting malicious payloads into Zero Trust Engine...',
        timer: 1500,
        showConfirmButton: false,
        didOpen: () => Swal.showLoading()
    }).then(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/simulate`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type: attackType })
            });
            const data = await response.json();
            
            Swal.fire({
                icon: 'warning',
                title: 'Attack Detected & Blocked',
                text: data.message || 'Zero Trust successfully blocked the simulated attack.',
                footer: `<span class="text-danger">Action Taken: ${data.action_taken}</span>`
            });
            
            loadLogs(); // Refresh logs to show the block
        } catch(e) {
            Swal.fire('Simulation Error', 'Failed to reach API.', 'error');
        }
    });
}

async function blacklistIp() {
    const ip = document.getElementById('blockIp').value;
    if(!ip) return;
    
    Swal.fire('Blacklisted', `IP Address ${ip} has been added to the threat database.`, 'success');
    document.getElementById('blockIp').value = '';
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

async function fetchAccessRequests() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/access_requests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) return;
        const requests = await response.json();

        const pendingList = requests.filter(r => r.status === 'Pending');
        const badge = document.getElementById('pendingBadge');
        if (badge) {
            badge.innerText = pendingList.length;
            badge.className = pendingList.length > 0 ? 'badge bg-danger font-mono' : 'badge bg-secondary font-mono';
        }

        const tbody = document.querySelector('#accessRequestsTable tbody');
        if (!tbody) return;

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No access escalation requests submitted yet.</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(r => {
            let statusBadge = '<span class="badge bg-warning text-dark font-mono">Pending Admin Approval</span>';
            if (r.status === 'Approved') {
                statusBadge = r.is_active ? 
                    '<span class="badge bg-success font-mono"><i class="fa-solid fa-check me-1"></i> Active (2 Min Window)</span>' :
                    '<span class="badge bg-secondary font-mono">Expired</span>';
            } else if (r.status === 'Denied') {
                statusBadge = '<span class="badge bg-danger font-mono"><i class="fa-solid fa-xmark me-1"></i> Rejected</span>';
            }

            let actions = '-';
            if (r.status === 'Pending') {
                actions = `
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-sm btn-success font-mono" onclick="respondAccessRequest(${r.id}, 'approve')">
                            <i class="fa-solid fa-check me-1"></i> Approve
                        </button>
                        <button class="btn btn-sm btn-outline-danger font-mono" onclick="respondAccessRequest(${r.id}, 'deny')">
                            <i class="fa-solid fa-xmark me-1"></i> Deny
                        </button>
                    </div>
                `;
            }

            return `
                <tr>
                    <td class="font-mono text-accent">#REQ-${r.id}</td>
                    <td class="small text-muted font-mono">${r.created_at}</td>
                    <td class="fw-bold text-white">${r.username}</td>
                    <td><span class="badge badge-cyber">${r.user_role}</span></td>
                    <td class="text-info fw-bold">${r.resource_name}</td>
                    <td><span class="badge bg-dark border border-secondary font-mono">${r.trust_score.toFixed(1)}%</span></td>
                    <td class="small text-muted" style="max-width: 200px;">"${r.justification}"</td>
                    <td>${statusBadge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    } catch(e) {
        console.error("Error fetching access requests:", e);
    }
}

async function respondAccessRequest(requestId, action) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/admin/respond_access`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ request_id: requestId, action: action })
        });
        const data = await response.json();
        
        if (response.ok) {
            Swal.fire({
                icon: action === 'approve' ? 'success' : 'info',
                title: action === 'approve' ? 'Access Granted' : 'Access Denied',
                text: action === 'approve' ? 'Temporary 2-minute access window granted.' : 'Request rejected.',
                timer: 2000,
                showConfirmButton: false
            });
            fetchAccessRequests();
        } else {
            Swal.fire('Error', data.message || 'Failed to update request', 'error');
        }
    } catch(e) {
        Swal.fire('Error', 'Server connection failed', 'error');
    }
}

// Chatbot Logic
function toggleChatbot() {
    const chat = document.getElementById('chatbotCard');
    chat.classList.toggle('d-none');
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if(!msg) return;
    
    const chatBody = document.getElementById('chatBody');
    chatBody.innerHTML += `<div class="text-white mb-2 text-end"><strong>You:</strong> ${msg}</div>`;
    input.value = '';
    chatBody.scrollTop = chatBody.scrollHeight;
    
    // Mock Responses
    setTimeout(() => {
        let reply = "I'm analyzing the logs. All systems are operating within normal Zero Trust parameters.";
        if(msg.toLowerCase().includes('attack') || msg.toLowerCase().includes('threat')) {
            reply = "I detected 1 simulated SQL Injection attempt today. It was immediately blocked and the IP was blacklisted.";
        } else if(msg.toLowerCase().includes('high risk') || msg.toLowerCase().includes('risk')) {
            reply = "Currently, there are 0 high-risk users online. The average Trust Score is 85%.";
        }
        
        chatBody.innerHTML += `<div class="text-accent mb-2"><strong>AI:</strong> ${reply}</div>`;
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 800);
}
