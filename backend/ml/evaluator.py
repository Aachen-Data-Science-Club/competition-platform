import sys
import os
import time
from datetime import datetime

import zipfile
import pandas as pd
from api.models.submission import Submission
from api.models.team import Team
from api.models.score import DailyScore

# Important to import api module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.models.database import SessionLocal
from api.models.competition import Competition

from api.config import settings

import io
import onnxruntime as ort
import numpy as np
from PIL import Image

def run_single_evaluation(db, active_comp):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] STARTING EVALUATION FOR: {active_comp.name}", flush=True)
    
    try:
        with zipfile.ZipFile(active_comp.test_data_path, "r") as z:
            csv_filename = None
            for item in z.infolist():
                if item.filename.endswith('labels.csv') and '__MACOSX' not in item.filename:
                    csv_filename = item.filename
                    break
                    
            if not csv_filename:
                print("...labels.csv not found", flush=True)
                return
                
            with z.open(csv_filename) as f:
                labels_df = pd.read_csv(f)
                labels_df['pure_filename'] = labels_df['filename'].apply(os.path.basename)
                true_labels = labels_df.set_index('pure_filename').to_dict('index')

    except Exception as e:
        print(f"Error loading test data: {e}", flush=True)
        return

    teams = db.query(Team).all()

    for team in teams:
        latest_submission = db.query(Submission).filter(
            Submission.team_id == team.id,
            Submission.competition_id == active_comp.id).order_by(Submission.submitted_at.desc()).first()


        if not latest_submission:
            print(f"Team {team.name} has no submission", flush=True)
            continue

        print(f"Evaluating submission of team {team.name}", flush=True)

        try:
            session = ort.InferenceSession(latest_submission.file_path)
            input_name = session.get_inputs()[0].name
        except Exception as e:
            print(f"Team {team.name}: ONNX Model error! ({e})", flush=True)
            continue
            
        points = 0
        total_images = 0

        with zipfile.ZipFile(active_comp.test_data_path, 'r') as z:
            for file_info in z.infolist():
                filename = file_info.filename
                
                if file_info.is_dir() or filename.endswith('.csv') or '__MACOSX' in filename:
                    continue
                    
                pure_name = os.path.basename(filename)
                if pure_name not in true_labels:
                    continue

                total_images += 1
                
                img_bytes = z.read(filename)
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                img = img.resize((224, 224))
                img_array = np.array(img).astype(np.float32) / 255.0
                img_array = np.expand_dims(img_array, axis=0)
                
                prediction = session.run(None, {input_name: img_array})[0]
                
                # Scoring
                # prediction
                # true_labels[pure_name]
                
        print(f"Team {team.name} finished. Images processed: {total_images}", flush=True)

def run_evaluator():
    print("Evaluator started. Waiting for evaluation times...", flush=True)

    # To prevent double evaluation
    last_evaluated = {}

    while True:
        try:
            now = datetime.now()
            current_time_str = now.strftime("%H:%M")
            current_date = now.date()

            db = SessionLocal()
            
            active_comp = db.query(Competition).filter(Competition.is_active).first()
            
            if active_comp:
                if active_comp.evaluation_time == current_time_str or (settings.ENVIRONMENT == "development"):
                    if last_evaluated.get(active_comp.id) != current_date:
                        run_single_evaluation(db, active_comp)
                        last_evaluated[active_comp.id] = current_date
            
            db.close()
            
        except Exception as e:
            print(f"Error during evaluation check: {e}", flush=True)
            if 'db' in locals():
                db.close()

        now = datetime.now()
        seconds_to_sleep = 60 - now.second - (now.microsecond / 1_000_000)
        time.sleep(seconds_to_sleep)

if __name__ == "__main__":
    run_evaluator()