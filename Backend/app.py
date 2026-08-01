import os
import sys

# Ensure Backend directory is in Python path for Gunicorn on Render
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from config import Config
from models import db, User
from auth_routes import auth_bp
from admin_routes import admin_bp

is_vercel = bool(os.environ.get('VERCEL') or os.environ.get('VERCEL_ENV'))
frontend_dir = os.path.abspath(os.path.join(backend_dir, '..', 'Frontend'))

if not is_vercel:
    db_dir = os.path.abspath(os.path.join(backend_dir, '..', 'Database'))
    try:
        os.makedirs(db_dir, exist_ok=True)
    except Exception:
        pass

app = Flask(__name__, static_folder=frontend_dir, static_url_path='')

app.config.from_object(Config)

# Enable CORS for frontend communication
CORS(app)

# Initialize Database
db.init_app(app)

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(admin_bp, url_prefix='/api/admin')

with app.app_context():
    db.create_all()
    from flask_bcrypt import Bcrypt
    bcrypt = Bcrypt(app)
    
    # Create / update initial HR Admin user
    hr_user = User.query.filter_by(username='hr').first()
    hashed_hr_pw = bcrypt.generate_password_hash('hr123456').decode('utf-8')
    if not hr_user:
        hr_user = User(username='hr', email='hr@zerotrust.local', password_hash=hashed_hr_pw, role='Admin', department='HR')
        db.session.add(hr_user)
    else:
        hr_user.password_hash = hashed_hr_pw
        hr_user.role = 'Admin'
        hr_user.department = 'HR'

    # Create / update initial rgm Admin user
    rgm_user = User.query.filter(db.func.lower(User.username) == 'rgm').first()
    hashed_rgm_pw = bcrypt.generate_password_hash('rgmcet123').decode('utf-8')
    if not rgm_user:
        rgm_user = User(username='rgm', email='rgm@zerotrust.local', password_hash=hashed_rgm_pw, role='Admin', department='Security', is_active=True)
        db.session.add(rgm_user)
    else:
        rgm_user.password_hash = hashed_rgm_pw
        rgm_user.role = 'Admin'
        rgm_user.department = 'Security'
        rgm_user.is_active = True

    # Create initial admin user
    admin_user = User.query.filter(db.func.lower(User.username) == 'admin').first()
    hashed_pw = bcrypt.generate_password_hash('admin123').decode('utf-8')
    if not admin_user:
        admin = User(username='admin', email='admin@zerotrust.local', password_hash=hashed_pw, role='Admin', department='IT', is_active=True)
        db.session.add(admin)
    else:
        admin_user.password_hash = hashed_pw
        admin_user.role = 'Admin'
        admin_user.is_active = True

    # Create initial student user
    if not User.query.filter_by(username='student').first():
        student_pw = bcrypt.generate_password_hash('student123').decode('utf-8')
        student = User(username='student', email='student@zerotrust.local', password_hash=student_pw, role='Student', department='Engineering')
        db.session.add(student)

    # Create initial general user
    if not User.query.filter_by(username='user').first():
        user_pw = bcrypt.generate_password_hash('user123').decode('utf-8')
        user_obj = User(username='user', email='user@zerotrust.local', password_hash=user_pw, role='Employee', department='HR')
        db.session.add(user_obj)

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/')

def index():
    return send_from_directory(frontend_dir, 'login.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(frontend_dir, path)):
        return send_from_directory(frontend_dir, path)
    return jsonify({"message": "Not found"}), 404

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        "status": "success",
        "message": "Zero Trust Security API is running",
        "version": "1.0.0"
    })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

