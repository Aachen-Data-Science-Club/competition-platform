import secrets
from datetime import date, timedelta
from api.models.database import engine, SessionLocal
from api.models import Base, Team, Member, Competition, DailyScore, Submission


def generate_code(team_name):
    return f"{team_name}-{secrets.token_hex(4)}"


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(Team).count() > 0:
        print("Database already seeded. Skipping.")
        db.close()
        return

    teams_data = [
        {"name": "AlphaAI", "members": [
            {"name": "Max Müller", "email": "max@example.com"},
            {"name": "Lisa Schmidt", "email": "lisa@example.com"},
            {"name": "Tom Weber", "email": "tom@example.com"},
        ]},
        {"name": "DataDragons", "members": [
            {"name": "Anna Koch", "email": "anna@example.com"},
            {"name": "Felix Bauer", "email": "felix@example.com"},
        ]},
        {"name": "NeuralNinjas", "members": [
            {"name": "Sophie Richter", "email": "sophie@example.com"},
            {"name": "Jan Hoffmann", "email": "jan@example.com"},
            {"name": "Marie Wagner", "email": "marie@example.com"},
            {"name": "Luca Fischer", "email": "luca@example.com"},
        ]},
        {"name": "ByteBusters", "members": [
            {"name": "Leon Braun", "email": "leon@example.com"},
            {"name": "Emma Schulz", "email": "emma@example.com"},
        ]},
        {"name": "TensorTitans", "members": [
            {"name": "Niklas Wolf", "email": "niklas@example.com"},
            {"name": "Clara Neumann", "email": "clara@example.com"},
            {"name": "Moritz Schwarz", "email": "moritz@example.com"},
        ]},
        {"name": "DeepDive", "members": [
            {"name": "Hannah Zimmermann", "email": "hannah@example.com"},
            {"name": "David Krüger", "email": "david@example.com"},
        ]},
        {"name": "PixelPredictors", "members": [
            {"name": "Julia Maier", "email": "julia@example.com"},
            {"name": "Tim Hartmann", "email": "tim@example.com"},
            {"name": "Sarah Lange", "email": "sarah@example.com"},
        ]},
        {"name": "GradientGurus", "members": [
            {"name": "Kevin Berger", "email": "kevin@example.com"},
            {"name": "Laura Keller", "email": "laura@example.com"},
        ]},
    ]

    created_teams = []
    print("\n=== Seeding Teams & Members ===")
    for td in teams_data:
        team = Team(name=td["name"], total_points=0)
        db.add(team)
        db.flush()
        created_teams.append(team)

        for md in td["members"]:
            code = generate_code(td["name"])
            member = Member(
                team_id=team.id,
                name=md["name"],
                email=md["email"],
                access_code=code,
            )
            db.add(member)
            print(f"  Team '{td['name']}' | {md['name']} | Code: {code}")

    comp = Competition(
        name="Car Classification Challenge",
        description="Classify car images by brand and manufacturing year. "
                    "Upload your ONNX model and earn points for accurate predictions.",
        start_date=date.today() - timedelta(days=10),
        end_date=date.today() + timedelta(days=20),
        evaluation_time="20:00",
        is_active=True,
        classification_schema=[
            {"field": "brand", "type": "boolean"},
            {"field": "year", "type": "range", "min": 1900, "max": 2026},
        ],
    )
    db.add(comp)
    db.flush()
    print(f"\n=== Competition: {comp.name} (ID: {comp.id}) ===")

    import random
    random.seed(42)
    for day_offset in range(10):
        eval_date = date.today() - timedelta(days=10 - day_offset)
        for team in created_teams:
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

    for team in created_teams:
        total = sum(
            s.points for s in db.query(DailyScore).filter(DailyScore.team_id == team.id).all()
        )
        team.total_points = total
    db.commit()

    print("\n=== Final Leaderboard ===")
    for team in sorted(created_teams, key=lambda t: t.total_points, reverse=True):
        print(f"  {team.name}: {team.total_points} pts")

    print("\n=== Access Codes ===")
    print("Admin code: admin-secret-code")
    all_members = db.query(Member).filter(Member.is_active == True).all()
    for m in all_members:
        print(f"  {m.name} ({m.email}): {m.access_code}")

    db.close()
    print("\nSeeding complete!")


if __name__ == "__main__":
    seed()
