# Deep Learning Based Adaptive Zero Trust Security System

## Final Year Major Project

An enterprise-grade Zero Trust architecture implementing continuous authentication, dynamic Trust Scores, and AI-driven behavior analytics using Machine Learning.

### Features
* **Adaptive AI Trust Engine**: Calculates dynamic trust scores (0-100) based on user behavior and context.
* **Continuous Authentication**: Tracks mouse movements, typing speed, and idle time in the background.
* **Smart Resource Access**: Real-time locking and unlocking of resources (RBAC & ABAC).
* **Machine Learning Models**: Uses **Isolation Forest** (Anomaly Detection) and **Random Forest** (Risk Classification).
* **Glassmorphism UI**: Modern, sleek frontend using Bootstrap 5 and Chart.js.

### Tech Stack
* **Frontend:** HTML5, CSS3, JS, Bootstrap 5, Chart.js
* **Backend:** Python, Flask, Flask-SQLAlchemy, JWT
* **AI/ML:** Scikit-Learn, Pandas, Numpy, Pickle
* **Database:** SQLite (Seamlessly upgradable to MySQL)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd ZeroTrustSecurity
   ```

2. **Install Python Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Generate Synthetic AI Data & Train Models:**
   *Navigate to the AI Models directory and run the training script.*
   ```bash
   cd "AI Models"
   python train_model.py
   cd ..
   ```

4. **Run the Backend Server:**
   You can use the provided batch script or run it manually:
   ```bash
   ./run_backend.bat
   ```
   *Note: On first run, it will automatically create the `zerotrust.db` SQLite database and a default `admin` user (password: `admin123`).*

5. **Access the Application:**
   Open `Frontend/login.html` in your web browser.

### Author
Designed as a Major Project to demonstrate advanced AI and Cybersecurity concepts.
