import pickle
import os
import numpy as np
from datetime import datetime

class TrustEngine:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.iso_forest_path = os.path.join(self.base_dir, 'saved_models', 'isolation_forest.pkl')
        self.rf_path = os.path.join(self.base_dir, 'saved_models', 'random_forest.pkl')
        self.encoders_path = os.path.join(self.base_dir, 'saved_models', 'label_encoders.pkl')
        self.iso_forest = None
        self.rf_classifier = None
        self.encoders = None
        self._load_models()

    def _load_models(self):
        try:
            with open(self.iso_forest_path, 'rb') as f:
                self.iso_forest = pickle.load(f)
            with open(self.rf_path, 'rb') as f:
                self.rf_classifier = pickle.load(f)
            with open(self.encoders_path, 'rb') as f:
                self.encoders = pickle.load(f)
            print("AI Trust Engine (Contextual V2) initialized successfully.")
        except Exception as e:
            print(f"Warning: AI models not found. Please run train_model.py first. Error: {e}")

    def evaluate_trust(self, typing_speed, mouse_movements, failed_attempts, 
                       location='Unknown', device='Unknown', browser='Unknown', 
                       download_count=0, current_time=None):
        if not self.iso_forest or not self.rf_classifier or not self.encoders:
            return 85.0, [] # Default mock score if models aren't loaded

        if current_time is None:
            current_time = datetime.now()
        
        hour = current_time.hour
        
        # Safely encode text variables, fallback to 0 if unseen
        def safe_encode(cat_name, value):
            try:
                return self.encoders[cat_name].transform([value])[0]
            except:
                return 0 # Handle completely unseen labels by defaulting to 0
                
        loc_encoded = safe_encode('location', location)
        dev_encoded = safe_encode('device', device)
        brow_encoded = safe_encode('browser', browser)
        
        # features = ['typing_speed', 'mouse_movements', 'time_of_day', 'failed_attempts', 'location', 'device', 'browser', 'download_count']
        features = np.array([[typing_speed, mouse_movements, hour, failed_attempts, loc_encoded, dev_encoded, brow_encoded, download_count]])
        
        # 1. Anomaly Detection (-1 for anomaly, 1 for normal)
        is_anomaly = self.iso_forest.predict(features)[0]
        anomaly_score = self.iso_forest.score_samples(features)[0] # negative value
        
        # 2. Risk Classification (0 for low, 1 for high risk)
        risk_class = self.rf_classifier.predict(features)[0]
        risk_proba = self.rf_classifier.predict_proba(features)[0][1] # Probability of being high risk
        
        # 3. Calculate Dynamic Trust Score (0-100)
        trust_score = 100.0
        reasons = []

        if risk_class == 1:
            trust_score -= (risk_proba * 50)
            
        if is_anomaly == -1:
            trust_score -= 20
            
        # Add exact reasons matching presentation slides
        attacker_locations = ['Russia', 'Unknown IP', 'Tor Node']
        if location in attacker_locations:
            reasons.append(f"Login from highly suspicious location ({location})")
            trust_score -= 10
        elif location not in ['Anantapur', 'Hyderabad'] and not location:
             # Just in case location is completely empty
             reasons.append(f"Login from unrecognized location")
             trust_score -= 5
            
        if device not in ['Dell Laptop', 'Office Desktop']:
            reasons.append(f"Unknown device ({device})")
            trust_score -= 10
            
        if browser not in ['Chrome']:
            reasons.append(f"Different browser ({browser} instead of Chrome)")
            trust_score -= 5
            
        if failed_attempts > 2:
            trust_score -= (failed_attempts * 10)
            reasons.append(f"Many failed password attempts before success ({failed_attempts})")
            
        if hour < 5 or hour > 22:
            trust_score -= 10
            reasons.append(f"Unusual login time ({hour}:00 instead of 10:00 AM)")
            
        if download_count > 3:
            trust_score -= (download_count * 5)
            reasons.append(f"Downloading too many files in a short time ({download_count} files)")
            
        if typing_speed > 100 or typing_speed < 20:
            reasons.append("Different typing pattern (Bot behavior)")

        trust_score = max(0.0, min(100.0, trust_score))
        return trust_score, reasons

# Singleton instance
trust_engine = TrustEngine()
