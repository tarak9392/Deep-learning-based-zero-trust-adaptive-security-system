import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from config import Config
from models import db, User
from auth_routes import auth_bp
from admin_routes import admin_bp

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Frontend'))

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

    # Create initial admin user
    if not User.query.filter_by(username='admin').first():
        hashed_pw = bcrypt.generate_password_hash('admin123').decode('utf-8')
        admin = User(username='admin', email='admin@zerotrust.local', password_hash=hashed_pw, role='Admin', department='IT')
        db.session.add(admin)

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

    db.session.commit()

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
    app.run(debug=True, port=5000)

