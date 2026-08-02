import os
import json

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-key-zero-trust'
    
    # Base directory of the project
    BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    
    # SQLite Database connection (use /tmp on Vercel or local Database directory)
    if os.environ.get('VERCEL') or os.environ.get('VERCEL_ENV'):
        db_path = '/tmp/zerotrust.db'
    else:
        db_path = os.path.join(BASE_DIR, 'Database', 'zerotrust.db').replace('\\', '/')
        
    db_url = os.environ.get('DATABASE_URL')
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_DATABASE_URI = db_url or f'sqlite:///{db_path}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # JWT Settings
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-secret-key-zero-trust'

    # SMTP Email OTP Settings
    SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

    # Load local Twilio Credentials safely
    _tw_json = os.path.join(BASE_DIR, 'Backend', 'twilio_credentials.json')
    _tw_data = {}
    if os.path.exists(_tw_json):
        try:
            with open(_tw_json, 'r') as _f:
                _tw_data = json.load(_f)
        except Exception:
            pass

    # Multi-Provider Real-Time SMS & Instant Messaging Authentication APIs
    TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID') or _tw_data.get('TWILIO_ACCOUNT_SID', '')
    TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN') or _tw_data.get('TWILIO_AUTH_TOKEN', '')
    FAST2SMS_API_KEY = os.environ.get('FAST2SMS_API_KEY') or _tw_data.get('FAST2SMS_API_KEY', '')
    TEXTBELT_API_KEY = os.environ.get('TEXTBELT_API_KEY', '')
    CALLMEBOT_API_KEY = os.environ.get('CALLMEBOT_API_KEY', '')


