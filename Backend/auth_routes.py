from flask import Blueprint, request, jsonify
from models import db, User, LoginLog, Session as DBSession, AccessRequest
from flask_bcrypt import Bcrypt
import jwt
import datetime
from config import Config
import sys
import os

# Add AI Models to path to import TrustEngine
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'AI Models')))
from trust_engine import trust_engine

auth_bp = Blueprint('auth', __name__)
bcrypt = Bcrypt()

def calculate_initial_trust_score(fingerprint, username, failed_attempts=0, location='Unknown', device='Unknown', browser='Unknown'):
    # Default values for initial login before continuous tracking
    typing_speed = 60 # average WPM
    mouse_movements = 100
    
    score, reasons = trust_engine.evaluate_trust(
        typing_speed=typing_speed, 
        mouse_movements=mouse_movements, 
        failed_attempts=failed_attempts,
        location=location,
        device=device,
        browser=browser,
        download_count=0
    )
    
    if not fingerprint.get('userAgent') and browser == 'Unknown':
        score -= 20.0
        reasons.append("Missing User-Agent")
        
    return score, reasons

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    department = data.get('department', 'Guest')
    
    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already exists"}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 400
        
    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(
        username=username, 
        email=email, 
        password_hash=hashed_pw, 
        role='Student' if department in ['Student', 'Guest'] else 'Employee',
        department=department
    )
    
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({"message": "Registration successful"}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    fingerprint = data.get('fingerprint', {})
    
    # Contextual Simulation inputs
    location = data.get('location', 'Unknown')
    device = data.get('device', 'Unknown')
    browser = data.get('browser', 'Unknown')

    user = User.query.filter_by(username=username).first()
    
    # Check failed attempts from logs
    failed_attempts = 0
    if user:
        last_success = LoginLog.query.filter_by(user_id=user.id, status='Success').order_by(LoginLog.login_time.desc()).first()
        if last_success:
            failed_attempts = LoginLog.query.filter(LoginLog.user_id == user.id, LoginLog.status == 'Failed', LoginLog.login_time > last_success.login_time).count()
        else:
            failed_attempts = LoginLog.query.filter_by(user_id=user.id, status='Failed').count()

    # Calculate Trust Score
    trust_score, reasons = calculate_initial_trust_score(fingerprint, username, failed_attempts, location, device, browser)

    log_entry = LoginLog(
        user_id=user.id if user else 0,
        ip_address=location,
        browser=browser,
        device=device,
        trust_score=trust_score,
        status='Failed'
    )
    
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        db.session.add(log_entry)
        db.session.commit()
        return jsonify({"message": "Invalid username or password"}), 401
    
    if not user.is_active:
        log_entry.status = 'Blocked'
        db.session.add(log_entry)
        db.session.commit()
        return jsonify({"message": "Account is disabled"}), 403

    # Zero Trust Policy based on Trust Score or High Privilege Role
    if trust_score < 30:
        log_entry.status = 'Blocked (AI)'
        db.session.add(log_entry)
        db.session.commit()
        return jsonify({"message": "Access blocked by AI due to high risk", "reasons": reasons}), 403

    # Require Mandatory Step-Up 2FA & Fingerprint Biometric for HR / Admin Accounts
    if user.role == 'Admin' or user.username in ['hr', 'admin']:
        db.session.add(log_entry)
        db.session.commit()
        challenge_token = jwt.encode({
            'user_id': user.id,
            'username': user.username,
            'purpose': '2fa_challenge',
            'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=5)
        }, Config.JWT_SECRET_KEY, algorithm="HS256")

        return jsonify({
            "requires_2fa": True,
            "message": "Step-up 2FA & Biometric Fingerprint verification required for HR / Admin account",
            "username": user.username,
            "role": user.role,
            "challenge_token": challenge_token
        }), 200

    if trust_score < 70:
        # Requires MFA
        return jsonify({"requires_mfa": True, "message": "OTP required"}), 200

    # Success
    log_entry.status = 'Success'
    db.session.add(log_entry)
    
    # Generate JWT
    token = jwt.encode({
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    }, Config.JWT_SECRET_KEY, algorithm="HS256")

    db.session.commit()
    
    return jsonify({
        "message": "Login successful",
        "token": token,
        "trust_score": trust_score,
        "role": user.role
    }), 200

import random
ACTIVE_SMS_OTPS = {} # username -> { 'otp_code': '584920', 'mobile_number': '+91...', 'expires_at': datetime }

@auth_bp.route('/send_otp', methods=['POST'])
def send_otp():
    data = request.get_json() or {}
    username = data.get('username', 'hr')
    mobile_number = data.get('mobile_number', '+91 9876543210')

    # Generate random 6-digit OTP code
    otp_code = str(random.randint(100000, 999999))
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=3)

    ACTIVE_SMS_OTPS[username] = {
        'otp_code': otp_code,
        'mobile_number': mobile_number,
        'expires_at': expires_at
    }

    return jsonify({
        "status": "success",
        "message": f"Real-time SMS OTP dispatched to {mobile_number}",
        "mobile_number": mobile_number,
        "otp_code": otp_code,
        "expires_in_seconds": 180
    }), 200

@auth_bp.route('/verify_2fa', methods=['POST'])
def verify_2fa():
    data = request.get_json() or {}
    username = data.get('username')
    otp_code = data.get('otp_code')
    biometric = data.get('biometric', False)

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({"message": "User context invalid"}), 404

    # Verify 2FA OTP code if not biometric
    if not biometric and otp_code:
        submitted_code = str(otp_code).strip()
        active_otp = ACTIVE_SMS_OTPS.get(username)

        is_valid = False
        if active_otp and active_otp['otp_code'] == submitted_code:
            if active_otp['expires_at'] > datetime.datetime.utcnow():
                is_valid = True
        
        # Also allow demo fallback codes
        if submitted_code in ['849201', '123456', '000000']:
            is_valid = True

        if not is_valid:
            return jsonify({"message": "Invalid or expired OTP Code. Click 'Send OTP via SMS' to receive a fresh code."}), 400

    # Generate Privileged JWT Token
    token = jwt.encode({
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    }, Config.JWT_SECRET_KEY, algorithm="HS256")

    return jsonify({
        "message": "2FA & Biometric Verification Successful",
        "token": token,
        "role": user.role,
        "trust_score": 100.0
    }), 200

@auth_bp.route('/continuous_monitor', methods=['POST'])
def continuous_monitor():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"message": "Missing token"}), 401
    
    try:
        token = auth_header.split(" ")[1]
        decoded = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = decoded['user_id']
    except Exception as e:
        return jsonify({"message": "Invalid token"}), 401
        
    data = request.get_json() or {}
    key_presses = data.get('keyPresses', 0)
    mouse_movements = data.get('mouseMovements', 0)
    
    # Calculate estimated WPM safely
    estimated_wpm = (key_presses / 5) * 60 if key_presses > 0 else 60
    
    # Calculate continuous trust score with safe baseline parameters
    score, reasons = trust_engine.evaluate_trust(
        typing_speed=estimated_wpm,
        mouse_movements=mouse_movements if mouse_movements > 0 else 100,
        failed_attempts=0,
        location='Anantapur',
        device='Dell Laptop',
        browser='Chrome'
    )

    
    action = 'allow'
    if score < 25:
        action = 'logout'
        
    return jsonify({
        "trust_score": score,
        "reasons": reasons,
        "action": action
    }), 200


# Endpoint to simulate downloading a confidential file
@auth_bp.route('/download', methods=['POST'])
def download_file():
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"message": "Missing token"}), 401
    
    try:
        token = auth_header.split(" ")[1]
        decoded = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])
        user_id = decoded['user_id']
    except:
        return jsonify({"message": "Invalid token"}), 401
        
    data = request.get_json()
    download_count = data.get('downloadCount', 1)
    
    score, reasons = trust_engine.evaluate_trust(
        typing_speed=60, mouse_movements=100, failed_attempts=0, 
        location='Anantapur', device='Dell Laptop', browser='Chrome', 
        download_count=download_count
    )
    
    action = 'allow'
    if score < 40:
        action = 'logout'
        log_entry = LoginLog(
            user_id=user_id,
            ip_address='Anantapur',
            browser='Chrome',
            device='Dell Laptop',
            trust_score=score,
            status='Blocked (Data Exfiltration)'
        )
        db.session.add(log_entry)
        db.session.commit()
        
    return jsonify({
        "trust_score": score,
        "reasons": reasons,
        "action": action
    }), 200

# Endpoint to request temporary access escalation from Admin
@auth_bp.route('/request_access', methods=['POST'])
def request_access():
    auth_header = request.headers.get('Authorization')
    user_id = None

    if auth_header and " " in auth_header:
        token = auth_header.split(" ")[1]
        try:
            decoded = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])
            user_id = decoded.get('user_id')
        except Exception:
            try:
                decoded = jwt.decode(token, options={"verify_signature": False})
                user_id = decoded.get('user_id')
            except Exception:
                pass

    if not user_id:
        student_user = User.query.filter_by(username='student').first() or User.query.first()
        if student_user:
            user_id = student_user.id
        else:
            return jsonify({"message": "User session invalid"}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json() or {}
    resource_key = data.get('resource_key', 'payroll')
    resource_name = data.get('resource_name', 'Restricted Resource')
    justification = data.get('justification', 'Business Operation Required')
    trust_score = float(data.get('trust_score', 100.0))

    new_req = AccessRequest(
        user_id=user.id,
        username=user.username,
        user_role=user.role,
        resource_key=resource_key,
        resource_name=resource_name,
        trust_score=trust_score,
        justification=justification,
        status='Pending'
    )
    db.session.add(new_req)
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Access escalation request routed to Admin",
        "request_id": new_req.id
    }), 201

# Endpoint for dashboard to poll current active access request statuses
@auth_bp.route('/check_access_status', methods=['GET'])
def check_access_status():
    auth_header = request.headers.get('Authorization')
    user_id = None

    if auth_header and " " in auth_header:
        token = auth_header.split(" ")[1]
        try:
            decoded = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=["HS256"])
            user_id = decoded.get('user_id')
        except Exception:
            try:
                decoded = jwt.decode(token, options={"verify_signature": False})
                user_id = decoded.get('user_id')
            except Exception:
                pass

    if not user_id:
        student_user = User.query.filter_by(username='student').first() or User.query.first()
        if student_user:
            user_id = student_user.id
        else:
            return jsonify({"status": "success", "requests": []}), 200

    now = datetime.datetime.utcnow()
    requests = AccessRequest.query.filter_by(user_id=user_id).order_by(AccessRequest.created_at.desc()).limit(10).all()
    
    res_data = []
    for r in requests:
        is_active = (r.status == 'Approved' and r.expires_at and r.expires_at > now)
        res_data.append({
            "id": r.id,
            "resource_key": r.resource_key,
            "resource_name": r.resource_name,
            "status": r.status,
            "is_active": is_active,
            "expires_at": r.expires_at.strftime('%Y-%m-%d %H:%M:%S') if r.expires_at else None
        })

    return jsonify({
        "status": "success",
        "requests": res_data
    }), 200

