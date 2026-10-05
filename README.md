# ADSC Competition Platform

The official Data Science Competition Platform for the [Aachen Data Science Club](https://data-science-club.de/).

This platform enables the club to host flexible, Kaggle-style machine learning competitions. Participating teams train their models locally and upload their predictions as `submission.csv` files along with their code. A background evaluator compares these predictions daily against a hidden solution dataset and updates the live leaderboard.

## 🚀 Architecture

The platform consists of three main microservices orchestrated via Docker:

1. **Frontend:** React + Vite (Port 80)
2. **Backend:** FastAPI + SQLite (Port 8000)
3. **ML Evaluator:** A Python background daemon that automatically evaluates the uploaded CSV files against the solution data.

---

## 🧠 Evaluation (The Kaggle Approach)

The platform is highly flexible and can be used for Image Classification, Object Detection, NLP, or Time Series analysis. The server does not execute any heavy models; it strictly compares `.csv` prediction files.

### Rules for Admins (Test Data)
When uploading test data for a challenge, the `.zip` file must contain a CSV file holding the ground truth (the correct solutions).
- The CSV must contain an ID column (e.g., `filename`).
- The backend matches the rows of this column 1:1 against the participants' submissions.

### Rules for Participants (Submissions)
- Teams upload a `.csv` file with their predictions and a `.zip` file containing their code.
- The `.csv` must have exactly the same column names as required by the challenge description.
- For every exact row match, the backend automatically awards points.

---

## 🛠 Server Deployment & Workflow (Production)

The platform runs as a production-ready Docker setup on the club's server.

### 1. Applying Updates
Whenever you change the code locally and push to GitHub, run the following workflow on the server to update the platform:

```bash
# 1. Download the latest code
git pull

# 2. Rebuild and restart containers without downtime
sudo docker compose -f docker-compose.prod.yml up -d --build
```
*Your database (`prod_db`) and all uploads (`data/`) are stored in secure Docker volumes and remain 100% intact during this process!*

### 2. Checking Logs
If the evaluation fails or the backend throws errors, check the logs:
```bash
sudo docker logs -f adsc-evaluator-prod
sudo docker logs -f adsc-backend-prod
```

### 3. Secrets (.env)
A `.env` file exists on the server inside the `backend/.env` folder. It is never pushed to GitHub! It contains critical production secrets:
```ini
ENVIRONMENT=production
SECRET_KEY=your-very-long-random-secret-string
ADMIN_ACCESS_CODE=your-secure-admin-password
CORS_ORIGINS=https://challenge.adsc.de
```

---

## 💻 Local Development

If you want to work on the codebase, clone the repository to your laptop and use the development setup. It features hot-reloading (changes are reflected immediately upon saving).

```bash
docker compose up --build
```
The frontend will be available at `http://localhost:5173`, and the backend at `http://localhost:8000`.
