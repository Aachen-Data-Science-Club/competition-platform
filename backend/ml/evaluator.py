import sys
import os
import time
from datetime import datetime
import zipfile
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.models.database import SessionLocal
from api.models.competition import Competition
from api.models.submission import Submission
from api.models.team import Team
from api.models.score import DailyScore
from api.config import settings

def run_single_evaluation(db, active_comp):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] STARTING EVALUATION FOR: {active_comp.name}", flush=True)

    evaluation_date = datetime.now().date()
    daily_datasets = (active_comp.evaluation_datasets or {}).get(evaluation_date.isoformat(), {})
    test_data_path = daily_datasets.get("labeled") or active_comp.test_data_path
    if not test_data_path:
        print(f"Error: no labeled test data configured for {evaluation_date}", flush=True)
        return
    
    try:
        with zipfile.ZipFile(test_data_path, "r") as z:
            csv_filename = None
            for item in z.infolist():
                if item.filename.endswith('.csv') and '__MACOSX' not in item.filename:
                    csv_filename = item.filename
                    break
                    
            if not csv_filename:
                print("Error: test labels csv not found", flush=True)
                return
                
            with z.open(csv_filename) as f:
                labels_df = pd.read_csv(f)
                if 'filename' in labels_df.columns:
                    labels_df['pure_filename'] = labels_df['filename'].apply(os.path.basename)
                    true_labels = labels_df.set_index('pure_filename').to_dict('index')
                else:
                    true_labels = labels_df.to_dict('index')
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

        try:
            sub_df = pd.read_csv(latest_submission.file_path)
            
            if 'filename' in sub_df.columns:
                sub_df['pure_filename'] = sub_df['filename'].apply(os.path.basename)
                sub_labels = sub_df.set_index('pure_filename').to_dict('index')
            else:
                sub_labels = sub_df.to_dict('index')

            points = 0
            total_matches = 0

            for key, true_val in true_labels.items():
                if key in sub_labels:
                    total_matches += 1
                    is_correct = True
                    for col in true_val.keys():
                        if col != 'filename' and col != 'pure_filename':
                            if str(true_val[col]).strip().lower() != str(sub_labels[key].get(col, "")).strip().lower():
                                is_correct = False
                                break
                    
                    if is_correct:
                        points += 100

            print(f"Team {team.name} scored {points} points ({total_matches} matches)", flush=True)
            
            new_score = DailyScore(
                competition_id=active_comp.id,
                team_id=team.id,
                points=points,
                date=evaluation_date
            )
            db.add(new_score)
            db.commit()

        except Exception as e:
            print(f"Team {team.name}: Submission evaluation failed ({e})", flush=True)
            continue

def run_evaluator():
    print("Evaluator started. Waiting for evaluation times...", flush=True)

    last_evaluated = {}

    while True:
        try:
            now = datetime.now()
            current_time_str = now.strftime("%H:%M")
            current_date = now.date()

            db = SessionLocal()
            
            active_comp = db.query(Competition).filter(Competition.is_active).first()
            
            if active_comp:
                if active_comp.evaluation_time == current_time_str:
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
