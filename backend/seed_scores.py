from datetime import date, timedelta
import random
from api.models.database import SessionLocal
from api.models import Team, Competition, DailyScore

def seed_scores():
    db = SessionLocal()
    
    # Get all teams
    teams = db.query(Team).all()
    if not teams:
        print("No teams found. Please run seed.py first.")
        return

    # Get the active challenge or the first one
    comp = db.query(Competition).filter(
        Competition.start_date <= date.today(),
        Competition.end_date >= date.today()
    ).first()
    
    if not comp:
        comp = db.query(Competition).first()
        
    if not comp:
        print("No competition found. Please create one first.")
        return

    print(f"Adding scores for competition: {comp.name}")
    
    # Delete existing dummy scores for this comp to avoid duplicates
    db.query(DailyScore).filter(DailyScore.competition_id == comp.id).delete()

    random.seed(42)
    
    # Generate scores for the last 10 days (or since start_date if shorter)
    days_to_seed = min(10, (date.today() - comp.start_date).days + 1)
    if days_to_seed <= 0:
        days_to_seed = 5 # force some days if it just started
        
    for day_offset in range(days_to_seed):
        eval_date = date.today() - timedelta(days=days_to_seed - 1 - day_offset)
        for team in teams:
            num_images = 5
            total_day_points = 0
            details = {}
            for img_idx in range(num_images):
                brand_correct = random.random() > 0.3
                brand_points = 100 if brand_correct else 0
                year_points = random.randint(40, 100)
                img_points = brand_points + year_points
                total_day_points += img_points
                details[f"image_{img_idx + 1}"] = {
                    "brand": brand_points,
                    "year": year_points,
                    "total": img_points,
                }

            score = DailyScore(
                team_id=team.id,
                competition_id=comp.id,
                date=eval_date,
                points=total_day_points,
                details=details,
            )
            db.add(score)

    db.commit()

    # Update total points for teams
    for team in teams:
        total = sum(
            s.points for s in db.query(DailyScore).filter(DailyScore.team_id == team.id).all()
        )
        team.total_points = total
    db.commit()
    
    print("Scores seeded successfully!")
    db.close()

if __name__ == "__main__":
    seed_scores()
