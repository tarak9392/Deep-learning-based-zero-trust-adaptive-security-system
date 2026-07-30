from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'Users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(50), default='Student') # e.g., Admin, Faculty, HR, Student, Employee, Guest
    department = db.Column(db.String(100), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    mfa_secret = db.Column(db.String(32), nullable=True) # For Google Authenticator
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class LoginLog(db.Model):
    __tablename__ = 'LoginLogs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('Users.id'), nullable=False)
    login_time = db.Column(db.DateTime, default=datetime.utcnow)
    ip_address = db.Column(db.String(50), nullable=False)
    browser = db.Column(db.String(100), nullable=True)
    device = db.Column(db.String(100), nullable=True)
    location = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), nullable=False) # 'Success', 'Failed'
    trust_score = db.Column(db.Float, nullable=True)

class Session(db.Model):
    __tablename__ = 'Sessions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('Users.id'), nullable=False)
    session_token = db.Column(db.String(256), nullable=False, unique=True)
    login_time = db.Column(db.DateTime, default=datetime.utcnow)
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

class UserBehavior(db.Model):
    __tablename__ = 'UserBehavior'
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('Sessions.id'), nullable=False)
    typing_speed_wpm = db.Column(db.Float, nullable=True)
    mouse_movements = db.Column(db.Integer, nullable=True)
    idle_time_seconds = db.Column(db.Integer, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class AccessRequest(db.Model):
    __tablename__ = 'AccessRequests'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('Users.id'), nullable=False)
    username = db.Column(db.String(80), nullable=False)
    user_role = db.Column(db.String(50), nullable=False)
    resource_key = db.Column(db.String(50), nullable=False)
    resource_name = db.Column(db.String(100), nullable=False)
    trust_score = db.Column(db.Float, nullable=False)
    justification = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default='Pending') # 'Pending', 'Approved', 'Denied'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)

