import pandas as pd
import numpy as np
import pickle
import os
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.preprocessing import LabelEncoder

def train_models():
    print("Loading dataset...")
    df = pd.read_csv('../Dataset/user_behavior.csv')
    
    # Initialize and fit encoders for categorical data
    encoders = {}
    categorical_features = ['location', 'device', 'browser']
    
    for cat in categorical_features:
        le = LabelEncoder()
        df[cat] = le.fit_transform(df[cat])
        encoders[cat] = le
        
    features = ['typing_speed', 'mouse_movements', 'time_of_day', 'failed_attempts', 'location', 'device', 'browser', 'download_count']
    X = df[features]
    y_anomaly = df['is_anomaly']
    y_risk = df['risk_label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y_risk, test_size=0.2, random_state=42)
    
    print("Training Isolation Forest (Anomaly Detection)...")
    # Isolation forest doesn't need labels for training (unsupervised)
    iso_forest = IsolationForest(contamination=0.1, random_state=42)
    iso_forest.fit(X_train)
    
    print("Training Random Forest (Risk Classification)...")
    rf_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_classifier.fit(X_train, y_train)
    
    # Evaluate RF
    y_pred = rf_classifier.predict(X_test)
    print("Random Forest Performance:")
    print(classification_report(y_test, y_pred))
    
    # Save Models and Encoders
    print("Saving models and encoders...")
    os.makedirs('saved_models', exist_ok=True)
    with open('saved_models/isolation_forest.pkl', 'wb') as f:
        pickle.dump(iso_forest, f)
        
    with open('saved_models/random_forest.pkl', 'wb') as f:
        pickle.dump(rf_classifier, f)
        
    with open('saved_models/label_encoders.pkl', 'wb') as f:
        pickle.dump(encoders, f)
        
    print("Models saved successfully in AI Models/saved_models/")

if __name__ == "__main__":
    # Go to script directory to ensure relative paths work
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    train_models()
