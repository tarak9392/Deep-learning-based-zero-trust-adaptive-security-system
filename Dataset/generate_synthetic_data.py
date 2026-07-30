import pandas as pd
import numpy as np
import random
import os

def generate_data(num_samples=1000):
    data = []
    for _ in range(num_samples):
        # Normal behavior
        is_anomaly = np.random.choice([0, 1], p=[0.9, 0.1])
        
        if is_anomaly == 0:
            typing_speed = np.random.normal(60, 10)  # WPM
            mouse_movements = np.random.normal(150, 30)
            time_of_day = np.random.normal(12, 4)  # Hour of day (8 AM to 4 PM mostly)
            failed_attempts = np.random.choice([0, 1], p=[0.95, 0.05])
            
            # New Srivalli Baseline Context
            location = np.random.choice(['Anantapur', 'Hyderabad'], p=[0.8, 0.2])
            device = np.random.choice(['Dell Laptop', 'Office Desktop'], p=[0.7, 0.3])
            browser = 'Chrome'
            downloads = np.random.choice([0, 1, 2], p=[0.8, 0.15, 0.05])
            
            risk_label = 0 # Low Risk
        else:
            # Abnormal behavior (Hacker/Bot)
            typing_speed = np.random.choice([np.random.normal(150, 20), np.random.normal(10, 5)]) # Too fast or too slow
            mouse_movements = np.random.choice([np.random.normal(500, 100), np.random.normal(20, 10)])
            time_of_day = np.random.choice([np.random.normal(3, 1), np.random.normal(23, 1)]) # Midnight logins
            failed_attempts = np.random.randint(2, 6)
            
            # New Attacker Context
            location = np.random.choice(['Unknown IP', 'Russia', 'Tor Node', 'Anantapur'], p=[0.4, 0.3, 0.2, 0.1])
            device = np.random.choice(['Unknown Mobile', 'MacBook', 'Dell Laptop'], p=[0.5, 0.4, 0.1])
            browser = np.random.choice(['Firefox', 'Tor Browser', 'Chrome'], p=[0.4, 0.4, 0.2])
            downloads = np.random.randint(5, 50) # High volume downloads
            
            risk_label = 1 # High Risk

        data.append({
            'typing_speed': max(0, typing_speed),
            'mouse_movements': max(0, mouse_movements),
            'time_of_day': time_of_day % 24,
            'failed_attempts': failed_attempts,
            'location': location,
            'device': device,
            'browser': browser,
            'download_count': downloads,
            'is_anomaly': is_anomaly,
            'risk_label': risk_label
        })
        
    df = pd.DataFrame(data)
    
    # Ensure directory exists
    os.makedirs('Dataset', exist_ok=True)
    df.to_csv('Dataset/user_behavior.csv', index=False)
    print(f"Generated {num_samples} samples and saved to Dataset/user_behavior.csv")

if __name__ == "__main__":
    generate_data(2000)
