import sys
import os
import time
import math
from datetime import datetime
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

MAX_CELL_POINTS = 10.0

BOOL_TRUE = {"true", "yes", "y", "t"}
BOOL_FALSE = {"false", "no", "n", "f"}
ID_COLUMN_NAMES = {"filename", "pure_filename", "id", "sofifa_id"}


def _read_csv_from_zip(zip_path):
    with zipfile.ZipFile(zip_path, "r") as z:
        for item in z.infolist():
            if item.filename.endswith(".csv") and "__MACOSX" not in item.filename:
                with z.open(item.filename) as f:
                    return pd.read_csv(f)
    return None


def _normalize_key(val, is_filename=False):
    if pd.isna(val):
        return ""
    if is_filename:
        return os.path.basename(str(val).strip())
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        if math.isfinite(float(val)) and float(val).is_integer():
            return str(int(val))
    s = str(val).strip()
    try:
        f = float(s)
        if math.isfinite(f) and f.is_integer():
            return str(int(f))
    except ValueError:
        pass
    return s


def _parse_numeric(val):
    if pd.isna(val):
        return None
    if isinstance(val, bool):
        return 1.0 if val else 0.0
    if isinstance(val, (int, float)):
        f = float(val)
        return f if math.isfinite(f) else None
    s = str(val).strip().lower()
    if s in BOOL_TRUE:
        return 1.0
    if s in BOOL_FALSE:
        return 0.0
    try:
        f = float(s)
        return f if math.isfinite(f) else None
    except ValueError:
        return None


def score_cell(pred_val, true_val, spec=None):
    if pd.isna(true_val) or pd.isna(pred_val):
        return 0.0
    if str(pred_val).strip() == "":
        return 0.0

    t_num = _parse_numeric(true_val)
    p_num = _parse_numeric(pred_val)

    if t_num is not None:
        if p_num is None:
            return 0.0
        if spec and spec.get("type") == "boolean" and t_num in (0.0, 1.0) and p_num in (0.0, 1.0):
            return MAX_CELL_POINTS if t_num == p_num else 0.0
        if t_num == p_num:
            return MAX_CELL_POINTS
        if t_num == 0.0:
            if spec and spec.get("type") == "range" and spec.get("min") is not None and spec.get("max") is not None:
                span = float(spec["max"]) - float(spec["min"])
                if 0.0 < span <= 10.0:
                    return max(0.0, 1.0 - abs(p_num - t_num) / span) * MAX_CELL_POINTS
            return max(0.0, 1.0 - abs(p_num)) * MAX_CELL_POINTS
        return max(0.0, 1.0 - abs(p_num - t_num) / abs(t_num)) * MAX_CELL_POINTS

    t_str = str(true_val).strip().lower()
    p_str = str(pred_val).strip().lower()
    return MAX_CELL_POINTS if t_str == p_str else 0.0


def _resolve_target_columns(labels_df, active_comp, daily_datasets):
    col_map = {c.strip().lower(): c for c in labels_df.columns}
    schema = active_comp.required_predictions or []
    target_specs = {}

    for item in schema:
        field_name = (item.get("field") or "").strip().lower()
        if field_name in col_map and field_name not in ID_COLUMN_NAMES:
            actual_col = col_map[field_name]
            target_specs[actual_col] = item

    if target_specs:
        return target_specs

    unlabeled_path = (daily_datasets or {}).get("unlabeled")
    if unlabeled_path and os.path.exists(unlabeled_path):
        try:
            unlabeled_df = _read_csv_from_zip(unlabeled_path)
            if unlabeled_df is not None:
                unlabeled_cols = {c.strip().lower() for c in unlabeled_df.columns}
                diff_cols = [c for c in labels_df.columns if c.strip().lower() not in unlabeled_cols]
                if diff_cols:
                    return {c: {"field": c, "type": "range"} for c in diff_cols}
        except Exception:
            pass

    fallback_cols = [c for c in labels_df.columns if c.strip().lower() not in ID_COLUMN_NAMES]
    return {c: {"field": c, "type": "range"} for c in fallback_cols}


def _find_join_column(labels_df, sub_df, target_cols):
    sub_col_map = {c.strip().lower(): c for c in sub_df.columns}
    target_lower = {c.strip().lower() for c in target_cols}

    for fname in ["filename", "pure_filename"]:
        if fname in sub_col_map and fname not in target_lower:
            for c in labels_df.columns:
                if c.strip().lower() == fname:
                    return c, sub_col_map[fname], True

    for pname in ["id", "sofifa_id"]:
        if pname in sub_col_map and pname not in target_lower:
            for c in labels_df.columns:
                if c.strip().lower() == pname and labels_df[c].notna().all() and labels_df[c].is_unique:
                    return c, sub_col_map[pname], False

    for c in labels_df.columns:
        c_low = c.strip().lower()
        if c_low in target_lower or c_low not in sub_col_map:
            continue
        if c_low.endswith("_id") and labels_df[c].notna().all() and labels_df[c].is_unique:
            return c, sub_col_map[c_low], False

    return None, None, False


def _resolve_labeled_zip(active_comp, evaluation_date):
    datasets = active_comp.evaluation_datasets or {}
    daily = datasets.get(evaluation_date.isoformat(), {})
    labeled_path = daily.get("labeled") or active_comp.test_data_path
    if labeled_path and os.path.exists(labeled_path):
        return labeled_path, daily

    for date_key in sorted(datasets.keys(), reverse=True):
        candidate = (datasets.get(date_key) or {}).get("labeled")
        if candidate and os.path.exists(candidate):
            return candidate, datasets.get(date_key) or {}

    return None, {}


def run_single_evaluation(db, active_comp):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] STARTING EVALUATION FOR: {active_comp.name}", flush=True)

    evaluation_date = datetime.now().date()
    test_data_path, daily_datasets = _resolve_labeled_zip(active_comp, evaluation_date)
    if not test_data_path:
        print(f"Error: no labeled test data configured for {evaluation_date}", flush=True)
        return

    try:
        labels_df = _read_csv_from_zip(test_data_path)
        if labels_df is None:
            print("Error: test labels csv not found", flush=True)
            return
    except Exception as e:
        print(f"Error loading test data: {e}", flush=True)
        return

    target_specs = _resolve_target_columns(labels_df, active_comp, daily_datasets)
    target_cols = list(target_specs.keys())
    if not target_cols:
        print("Error: no target columns found for evaluation", flush=True)
        return

    label_rows = labels_df.to_dict("records")
    teams = db.query(Team).all()

    for team in teams:
        latest_submission = (
            db.query(Submission)
            .filter(
                Submission.team_id == team.id,
                Submission.competition_id == active_comp.id,
            )
            .order_by(Submission.submitted_at.desc())
            .first()
        )

        if not latest_submission:
            print(f"Team {team.name} has no submission", flush=True)
            continue

        try:
            sub_df = pd.read_csv(latest_submission.file_path)
            sub_col_map = {c.strip().lower(): c for c in sub_df.columns}
            sub_rows = sub_df.to_dict("records")

            true_key_col, sub_key_col, is_filename = _find_join_column(labels_df, sub_df, target_cols)

            if true_key_col and sub_key_col:
                true_records = {}
                for row in label_rows:
                    k = _normalize_key(row[true_key_col], is_filename)
                    if k:
                        true_records[k] = row
                sub_records = {}
                for row in sub_rows:
                    k = _normalize_key(row[sub_key_col], is_filename)
                    if k:
                        sub_records[k] = row
            else:
                true_records = {i: row for i, row in enumerate(label_rows)}
                sub_records = {i: row for i, row in enumerate(sub_rows)}

            total_points = 0.0
            total_matches = 0
            column_points = {col: 0.0 for col in target_cols}

            for key, true_row in true_records.items():
                sub_row = sub_records.get(key)
                if sub_row is None:
                    continue
                total_matches += 1
                for col in target_cols:
                    if pd.isna(true_row[col]):
                        continue
                    sub_col = sub_col_map.get(col.strip().lower())
                    if sub_col is None:
                        continue
                    cell_pts = score_cell(sub_row[sub_col], true_row[col], target_specs.get(col))
                    total_points += cell_pts
                    column_points[col] += cell_pts

            points = int(round(total_points))
            details = {
                "matched_rows": total_matches,
                "target_columns": {col: round(column_points[col], 2) for col in target_cols},
            }

            print(f"Team {team.name} scored {points} points ({total_matches} matches, targets: {target_cols})", flush=True)

            existing_score = (
                db.query(DailyScore)
                .filter(
                    DailyScore.competition_id == active_comp.id,
                    DailyScore.team_id == team.id,
                    DailyScore.date == evaluation_date,
                )
                .first()
            )

            if existing_score:
                existing_score.points = points
                existing_score.details = details
            else:
                new_score = DailyScore(
                    competition_id=active_comp.id,
                    team_id=team.id,
                    points=points,
                    date=evaluation_date,
                    details=details,
                )
                db.add(new_score)

            db.flush()
            team.total_points = int(
                db.query(func.sum(DailyScore.points))
                .filter(DailyScore.team_id == team.id)
                .scalar()
                or 0
            )
            db.commit()

        except Exception as e:
            db.rollback()
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
                eval_days = [d.strip() for d in (active_comp.evaluation_days or "").split(",") if d.strip()]
                is_eval_day = (not eval_days) or (current_date.isoformat() in eval_days)
                if is_eval_day and active_comp.evaluation_time == current_time_str:
                    if last_evaluated.get(active_comp.id) != current_date:
                        run_single_evaluation(db, active_comp)
                        last_evaluated[active_comp.id] = current_date

            db.close()

        except Exception as e:
            print(f"Error during evaluation check: {e}", flush=True)
            if "db" in locals():
                db.close()

        now = datetime.now()
        seconds_to_sleep = 60 - now.second - (now.microsecond / 1_000_000)
        time.sleep(seconds_to_sleep)


if __name__ == "__main__":
    run_evaluator()
