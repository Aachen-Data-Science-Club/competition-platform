# ADSC Competition Platform

The official Data Science Competition Platform for the [Aachen Data Science Club](https://data-science-club.de/).

This platform enables the club to host flexible, Kaggle-style machine learning competitions. Participating teams train their models locally and upload their predictions as `submission.csv` files along with their code. A background evaluator compares these predictions daily against a hidden solution dataset and updates the live leaderboard.

## 🚀 Architecture

The platform consists of three main microservices orchestrated via Docker:

1. **Frontend:** React + Vite (Port 80)
2. **Backend:** FastAPI + SQLite (Port 8000)
3. **ML Evaluator:** A Python background daemon that automatically evaluates the uploaded CSV files against the solution data.
