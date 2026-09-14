import sys
import os
import time
from datetime import datetime

# Important to import api module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.models.database import SessionLocal
from api.models.competition import Competition

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
                if active_comp.evaluation_time == current_time_str:
                    if last_evaluated.get(active_comp.id) != current_date:
                        print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] STARTING EVALUATION FOR: {active_comp.name}", flush=True)
                        
                        # TODO: Insert actual ML evaluation logic here
                        
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