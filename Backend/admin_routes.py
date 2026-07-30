from flask import Blueprint, request, jsonify, Response
from models import db, User, LoginLog, AccessRequest
import jwt
import csv
import io
import datetime
from config import Config

admin_bp = Blueprint('admin', __name__)

def admin_required(f):
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"message": "Missing token"}), 401
        try:
            token = auth_header.split(" ")[1]
            decoded = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])
            if decoded.get('role') != 'Admin':
                return jsonify({"message": "Admin privileges required"}), 403
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({"message": "Invalid or expired token"}), 401
    wrapper.__name__ = f.__name__
    return wrapper

@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    users = User.query.all()
    user_list = []
    for u in users:
        user_list.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "department": u.department,
            "is_active": u.is_active,
            "created_at": u.created_at.strftime("%Y-%m-%d") if u.created_at else None
        })
    return jsonify(user_list), 200

@admin_bp.route('/users/<int:user_id>/status', methods=['PUT'])
@admin_required
def update_user_status(user_id):
    data = request.get_json()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    user.is_active = data.get('is_active', user.is_active)
    db.session.commit()
    return jsonify({"message": f"User status updated to {'Active' if user.is_active else 'Blocked'}"}), 200

@admin_bp.route('/users/<int:user_id>/role', methods=['PUT'])
@admin_required
def update_user_role(user_id):
    data = request.get_json()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    
    user.role = data.get('role', user.role)
    db.session.commit()
    return jsonify({"message": f"User role updated to {user.role}"}), 200

@admin_bp.route('/logs/recent', methods=['GET'])
@admin_required
def get_recent_logs():
    logs = LoginLog.query.order_by(LoginLog.login_time.desc()).limit(50).all()
    log_list = []
    for log in logs:
        user = User.query.get(log.user_id)
        log_list.append({
            "id": log.id,
            "username": user.username if user else "Unknown",
            "ip_address": log.ip_address,
            "time": log.login_time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": log.status,
            "trust_score": log.trust_score
        })
    return jsonify(log_list), 200

@admin_bp.route('/simulate', methods=['POST'])
@admin_required
def simulate_attack():
    data = request.get_json()
    attack_type = data.get('type')
    
    # Mock simulation logic
    msg = ""
    action = ""
    
    if attack_type == 'sqli':
        msg = "SQL Injection Payload Detected in Request Parameters."
        action = "IP Blacklisted & Session Terminated instantly."
    elif attack_type == 'brute':
        msg = "High frequency of failed authentication attempts detected."
        action = "Account Locked & MFA Required."
    elif attack_type == 'bot':
        msg = "AI detected abnormal mouse movements and typing speed (Non-Human Behavior)."
        action = "Trust Score reduced to 0%. Access Revoked."
    elif attack_type == 'tor':
        msg = "Login attempt originated from a known Tor Exit Node."
        action = "Connection Dropped automatically."
        
    # Log the simulated attack
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(" ")[1]
    decoded = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])
    
    log_entry = LoginLog(
        user_id=decoded['user_id'],
        ip_address='192.168.x.x (Simulated Attack)',
        status='Blocked (Simulated Threat)',
        trust_score=0.0
    )
    db.session.add(log_entry)
    db.session.commit()
    
    return jsonify({
        "message": msg,
        "action_taken": action
    }), 200

@admin_bp.route('/reports/summary', methods=['GET'])
@admin_required
def get_reports_summary():
    total_logs = LoginLog.query.count()
    blocked_count = LoginLog.query.filter(LoginLog.status.like('%Blocked%')).count()
    failed_count = LoginLog.query.filter(LoginLog.status.like('%Failed%')).count()
    success_count = LoginLog.query.filter(LoginLog.status == 'Success').count()
    
    logs = LoginLog.query.all()
    scores = [l.trust_score for l in logs if l.trust_score is not None]
    avg_trust = (sum(scores) / len(scores)) if scores else 85.0
    
    compliance_score = round(100.0 - ((blocked_count + failed_count) / max(total_logs, 1) * 100 * 0.3), 1)

    recent_logs = LoginLog.query.order_by(LoginLog.login_time.desc()).limit(100).all()
    audit_events = []
    for log in recent_logs:
        user = User.query.get(log.user_id)
        audit_events.append({
            "id": log.id,
            "timestamp": log.login_time.strftime("%Y-%m-%d %H:%M:%S"),
            "username": user.username if user else "Unknown",
            "ip_address": log.ip_address,
            "device": log.device or "Unknown",
            "location": log.location or "Unknown",
            "status": log.status,
            "trust_score": log.trust_score,
            "risk_level": "High" if (log.trust_score and log.trust_score < 40) or "Blocked" in str(log.status) else ("Medium" if (log.trust_score and log.trust_score < 70) else "Low")
        })

    return jsonify({
        "metrics": {
            "total_events": total_logs,
            "blocked_incidents": blocked_count + failed_count,
            "average_trust_score": round(avg_trust, 1),
            "compliance_score": max(min(compliance_score, 100.0), 0.0),
            "successful_logins": success_count
        },
        "audit_logs": audit_events
    }), 200

@admin_bp.route('/reports/export', methods=['GET'])
@admin_required
def export_reports_csv():
    logs = LoginLog.query.order_by(LoginLog.login_time.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['Audit ID', 'Timestamp', 'Username', 'IP Address', 'Location', 'Device', 'Status', 'Trust Score', 'Risk Level'])
    for log in logs:
        user = User.query.get(log.user_id)
        risk = "High" if (log.trust_score and log.trust_score < 40) or "Blocked" in str(log.status) else ("Medium" if (log.trust_score and log.trust_score < 70) else "Low")
        writer.writerow([
            log.id,
            log.login_time.strftime("%Y-%m-%d %H:%M:%S"),
            user.username if user else "Unknown",
            log.ip_address,
            log.location or "N/A",
            log.device or "N/A",
            log.status,
            f"{log.trust_score:.1f}%" if log.trust_score is not None else "N/A",
            risk
        ])
        
    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = 'attachment; filename=ZeroTrust_Audit_Report.csv'
    return response

@admin_bp.route('/access_requests', methods=['GET'])
@admin_required
def get_access_requests():
    requests = AccessRequest.query.order_by(AccessRequest.created_at.desc()).all()
    req_list = []
    now = datetime.datetime.utcnow()
    for r in requests:
        is_active = (r.status == 'Approved' and r.expires_at and r.expires_at > now)
        req_list.append({
            "id": r.id,
            "user_id": r.user_id,
            "username": r.username,
            "user_role": r.user_role,
            "resource_key": r.resource_key,
            "resource_name": r.resource_name,
            "trust_score": r.trust_score,
            "justification": r.justification,
            "status": r.status,
            "is_active": is_active,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None,
            "expires_at": r.expires_at.strftime("%Y-%m-%d %H:%M:%S") if r.expires_at else None
        })
    return jsonify(req_list), 200

@admin_bp.route('/respond_access', methods=['POST'])
@admin_required
def respond_access_request():
    data = request.get_json() or {}
    request_id = data.get('request_id')
    action = data.get('action') # 'approve' or 'deny'

    req_obj = AccessRequest.query.get(request_id)
    if not req_obj:
        return jsonify({"message": "Request not found"}), 404

    if action == 'approve':
        req_obj.status = 'Approved'
        # Grant 2 minutes window
        req_obj.expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=2)
    else:
        req_obj.status = 'Denied'
        req_obj.expires_at = None

    db.session.commit()
    return jsonify({
        "status": "success",
        "message": f"Access request {action}d successfully"
    }), 200


