import sys
import os
import time
from datetime import datetime, time as dtime
import zipfile
import pandas as pd
from sqlalchemy import func

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.models.database import SessionLocal
from api.models.competition import Competition
from api.models.submission import Submission
from api.models.team import Team
from api.models.score import DailyScore
from api.config import settings

def extract_csv_from_zip(zip_path):
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            for item in z.namelist():
                if item.endswith('.csv') and '__MACOSX' not in item:
                    with z.open(item) as f:
                        return pd.read_csv(f)
    except Exception as e:
        print(f"Error extracting csv from zip: {e}")
    return None

def score_range(pred, truth, min_val, max_val):
    try:
        p = float(pred)
        t = float(truth)
    except Exception:
        return 0.0
    span = max_val - min_val
    if span <= 0:
        return 100.0 if p == t else 0.0
    diff = abs(p - t)
    score = 100.0 * (1.0 - (diff / span))
    return max(0.0, min(100.0, score))

def evaluate_submission(sub, truth_df, schema_dict, db, current_date, team, active_comp):
    print(f"Evaluating submission for team: {team.name}")
    try:
        sub_df = pd.read_csv(sub.file_path)
    except Exception as e:
        print(f"Failed to read submission {sub.file_path}: {e}")
        return

    # Lowercase all string columns in submission
    for col in sub_df.columns:
        if sub_df[col].dtype == object:
            sub_df[col] = sub_df[col].astype(str).str.lower()
            
    # Normalize truth dataframe too
    truth_df_norm = truth_df.copy()
    for col in truth_df_norm.columns:
        if truth_df_norm[col].dtype == object:
            truth_df_norm[col] = truth_df_norm[col].astype(str).str.lower()

    # Determine join key (prefer 'filename', fallback to 'id' or index)
    join_key = None
    if 'filename' in truth_df_norm.columns and 'filename' in sub_df.columns:
        join_key = 'filename'
    elif 'id' in truth_df_norm.columns and 'id' in sub_df.columns:
        join_key = 'id'
        
    truth_df_norm = truth_df_norm.add_suffix('_truth')
    sub_df = sub_df.add_suffix('_pred')

    if join_key:
        merged = pd.merge(truth_df_norm, sub_df, left_on=f"{join_key}_truth", right_on=f"{join_key}_pred")
    else:
        if len(truth_df_norm) == len(sub_df):
            merged = pd.concat([truth_df_norm.reset_index(drop=True), sub_df.reset_index(drop=True)], axis=1)
        else:
            print(f"Cannot merge DataFrames for team {team.name}: no common join key and unequal rows")
            return
            
    total_score = 0.0
    valid_cols = 0
    
    for col, spec in schema_dict.items():
        truth_col = f"{col}_truth"
        pred_col = f"{col}_pred"
        
        if truth_col not in merged.columns or pred_col not in merged.columns:
            print(f"Missing column '{col}' for evaluation.")
            continue
            
        col_score = 0.0
        row_count = 0
        for _, row in merged.iterrows():
            t_val = row[truth_col]
            p_val = row[pred_col]
            
            if pd.isna(t_val) or pd.isna(p_val):
                continue
                
            if spec['type'] == 'boolean':
                t_bool = str(t_val).strip() in ['1', 'true', 'yes', '1.0']
                p_bool = str(p_val).strip() in ['1', 'true', 'yes', '1.0']
                col_score += 100.0 if t_bool == p_bool else 0.0
            elif spec['type'] == 'range':
                min_v = spec.get('min', 0)
                max_v = spec.get('max', 100)
                col_score += score_range(p_val, t_val, min_v, max_v)
            
            row_count += 1
            
        if row_count > 0:
            total_score += (col_score / row_count)
            valid_cols += 1
            
    final_score = int(round(total_score / valid_cols)) if valid_cols > 0 else 0
    
    daily_score = db.query(DailyScore).filter_by(
        team_id=team.id,
        competition_id=active_comp.id,
        date=current_date
    ).first()
    
    if not daily_score:
        daily_score = DailyScore(
            team_id=team.id,
            competition_id=active_comp.id,
            date=current_date,
            points=final_score,
            details={"evaluated_columns": valid_cols, "file": sub.file_path}
        )
        db.add(daily_score)
    else:
        daily_score.points = final_score
        daily_score.details = {"evaluated_columns": valid_cols, "file": sub.file_path}
        
    db.flush()
    team.total_points = db.query(func.sum(DailyScore.points)).filter(DailyScore.team_id == team.id).scalar() or 0
    db.commit()
    print(f"Team {team.name} scored {final_score}")

def run_single_evaluation(db, active_comp, current_date):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] STARTING EVALUATION FOR: {active_comp.name}", flush=True)
    
    current_date_str = current_date.strftime("%Y-%m-%d")
    eval_datasets = active_comp.evaluation_datasets or {}
    
    if current_date_str not in eval_datasets or not eval_datasets[current_date_str].get("labeled"):
        print(f"No labeled dataset found for evaluation day {current_date_str}")
        return
        
    labeled_zip = eval_datasets[current_date_str]["labeled"]
    if not os.path.exists(labeled_zip):
        print(f"Labeled zip file not found on disk: {labeled_zip}")
        return
        
    truth_df = extract_csv_from_zip(labeled_zip)
    if truth_df is None:
        print(f"No valid .csv found in labeled zip: {labeled_zip}")
        return
        
    schema = getattr(active_comp, 'required_predictions', getattr(active_comp, 'classification_schema', []))
    schema_dict = { p['field']: p for p in schema }
    
    today_start = datetime.combine(current_date, dtime.min)
    today_end = datetime.combine(current_date, dtime.max)
    
    teams = db.query(Team).all()
    for team in teams:
        latest_sub = db.query(Submission).filter(
            Submission.competition_id == active_comp.id,
            Submission.team_id == team.id,
            Submission.submitted_at >= today_start,
            Submission.submitted_at <= today_end
        ).order_by(Submission.submitted_at.desc()).first()
        
        if latest_sub:
            evaluate_submission(latest_sub, truth_df, schema_dict, db, current_date, team, active_comp)
        else:
            print(f"No submission for team {team.name} today.")

def run_evaluator():
    print("Evaluator started. Waiting for evaluation times...", flush=True)

    last_evaluated = {}

    while True:
        try:
            now = datetime.now()
            current_time_str = now.strftime("%H:%M")
            current_date = now.date()
            current_date_str = current_date.strftime("%Y-%m-%d")

            db = SessionLocal()
            
            active_comp = db.query(Competition).filter(Competition.is_active).first()
            
            if active_comp:
                eval_days = [d.strip() for d in (active_comp.evaluation_days or "").split(",") if d.strip()]
                
                # Check if today is an evaluation day
                if current_date_str in eval_days:
                    if active_comp.evaluation_time == current_time_str:
                        if last_evaluated.get(active_comp.id) != current_date:
                            run_single_evaluation(db, active_comp, current_date)
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
