import os
import pandas as pd # type: ignore
from pymongo import MongoClient # type: ignore
from dotenv import load_dotenv # type: ignore

# Features used by the Isolation Forest model
FEATURES = ['eye_deviation', 'head_movement', 'face_scale', 'mouse_idle_time', 'response_time']

def extract_data():
    # Load URI from backend .env
    env_path = r'c:\Users\Anitha\Desktop\AdaptiveOnlineExam\AdaptiveOnlineExam\backend\.env'
    load_dotenv(env_path)
    uri = os.getenv('MONGO_URI')
    
    if not uri:
        print("Error: MONGO_URI not found in .env")
        return

    try:
        client = MongoClient(uri)
        # Explicitly use the 'Exams' database if provided in URI or default to it
        db = client.get_database() 
        
        print("--- MongoDB Data Extraction ---\n")
        print(f"Connecting to database: {db.name}")
        
        # 1. Identify the Baseline Students
        baseline_student = db.students.find_one({"name": {"$regex": "^baseline_normal$", "$options": "i"}})
        baseline_id = baseline_student['_id'] if baseline_student else None

        suspicious_student = db.students.find_one({"name": {"$regex": "^baseline_suspicious$", "$options": "i"}})
        suspicious_id = suspicious_student['_id'] if suspicious_student else None
        
        if baseline_id:
            print(f"Found Honest baseline student: (ID: {baseline_id})")
        
        if suspicious_id:
            print(f"Found Suspicious baseline student: (ID: {suspicious_id})")

        # 2. Fetch all behavior logs
        # We project only the fields we need to save memory
        cursor = db.behaviorlogs.find({}, {
            "eyeDeviation": 1, 
            "headMovement": 1, 
            "faceScale": 1, 
            "mouseIdleTime": 1, 
            "responseTime": 1,
            "student_id": 1,
            "_id": 0
        })
        
        logs = list(cursor)
        print(f"Extracted {len(logs)} total logs from 'behaviorlogs'.")
        
        if not logs:
            print("No logs found. Extraction aborted.")
            return

        # 3. Process into DataFrame
        df = pd.DataFrame(logs)
        
        # Rename columns to match FEATURES
        df = df.rename(columns={
            "eyeDeviation": "eye_deviation",
            "headMovement": "head_movement",
            "faceScale": "face_scale",
            "mouseIdleTime": "mouse_idle_time",
            "responseTime": "response_time"
        })
        
        # Ensure all FEATURES exist (default to 0 if missing)
        for feat in FEATURES:
            if feat not in df.columns:
                df[feat] = 0.0
                
        # 4. Balancing Strategy
        # We separate Baseline (Honest & Suspicious) from the rest
        if baseline_id:
            baseline_df = df[df['student_id'] == baseline_id].copy()
            suspicious_df = df[df['student_id'] == suspicious_id].copy() if suspicious_id else pd.DataFrame()
            
            others_df = df[(df['student_id'] != baseline_id) & (df['student_id'] != suspicious_id)].copy()
            
            print(f"Baseline Honest Logs: {len(baseline_df)}")
            print(f"Baseline Suspicious Logs: {len(suspicious_df)}")
            print(f"Background Logs: {len(others_df)}")
            
            # We want to train on a balanced mix. The model shouldn't just see the extremes.
            limit = max(100, int(len(baseline_df) * 0.4)) 
            others_sample = others_df.sample(n=min(len(others_df), limit), random_state=42)
            
            # EXCLUDE suspicious_df from training so the model doesn't learn it as "normal"!
            final_df = pd.concat([baseline_df, others_sample])
        else:
            final_df = df

        # Final Prep
        final_df = final_df[FEATURES]
        print(f"Final training set size: {len(final_df)} records.")
        
        # 5. Save to CSV in ml-service folder
        output_path = 'behavior_dataset.csv'
        final_df.to_csv(output_path, index=False)
        print(f"Dataset successfully saved to {output_path}")
        
        client.close()
        
    except Exception as e:
        print(f"Extraction error: {str(e)}")

if __name__ == "__main__":
    extract_data()
