# ADSC Competition Platform

A data science competition platform built for the [Aachen Data Science Club](https://data-science-club.de/). Teams compete by uploading ONNX classification models that are evaluated daily against hidden test datasets.

## Tech Stack

- **Frontend:** React 19 + Vite 8 (vanilla CSS)
- **Backend:** FastAPI + SQLAlchemy
- **Database:** SQLite (dev) / PostgreSQL (prod)
- **Auth:** JWT via access codes

## Quick Start (Development)

### Prerequisites
- Python 3.11+
- Node.js 20+

### Backend

```bash
cd backend
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
python -m seed              # populate with dummy data
uvicorn api.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` with the API at `http://localhost:8000`.

### Test Access Codes

After seeding, the terminal prints all access codes. The admin code is configured in `.env` (default: `admin-secret-code`).

## Environment Variables

Copy `.env.example` to `.env` in the project root:

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Database connection string | `sqlite:///./adsc.db` |
| `SECRET_KEY` | JWT signing key | `dev-secret-key-...` |
| `ADMIN_ACCESS_CODE` | Admin login code | `admin-secret-code` |
| `SMTP_HOST` | Mail server for sending access codes | — |
| `SMTP_PORT` | Mail server port | `587` |
| `SMTP_USER` | Mail sender address | — |
| `SMTP_PASSWORD` | Mail sender password | — |

## Docker (Development)

Run the local development environment using Docker. The backend will automatically seed the database if it's empty.

```bash
docker-compose up --build
```
*Note: In development, your local source code directories are mounted into the containers. Changes you make to the code will trigger hot-reloads (for both React and FastAPI).*

## Docker (Production)

For a production deployment, use the production compose file. This builds a static React bundle served by Nginx, removes hot-reloading, and prevents local code mounts from overwriting the container.

```bash
docker-compose -f docker-compose.prod.yml up --build -d
```
*Make sure to change the `SECRET_KEY` and `ADMIN_ACCESS_CODE` in `docker-compose.prod.yml` before deploying!*

## Project Structure

```
├── backend/
│   ├── api/
│   │   ├── main.py            # FastAPI app
│   │   ├── config.py          # Environment settings
│   │   ├── auth.py            # JWT handling
│   │   ├── dependencies.py    # DB session injection
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   └── routes/            # API endpoints
│   ├── seed.py                # Dummy data seeder
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api.js             # API client
│   │   ├── context/           # Auth context
│   │   ├── components/        # Reusable UI components
│   │   └── pages/             # Page components
│   └── package.json
├── data/                      # Training/test data (gitignored)
├── docker-compose.yml
└── .env.example
```
