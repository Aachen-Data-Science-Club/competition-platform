
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
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     
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

After seeding, the terminal prints all access codes. The admin code is configured in `backend/.env` (default: `admin-secret-code`).

### Access Code Emails

Access codes are emailed automatically when a team is created and when a member is added. The admin Teams page also offers **Send Codes** (resends the existing codes unchanged) and **Regenerate** (issues new codes, invalidating the old ones). Delivery requires the `SMTP_*` variables; without them the codes are still created and displayed in the admin UI.

## Environment Variables

Copy `backend/.env.example` to `backend/.env`. The file **must** live in `backend/` — `config.py` resolves `.env` relative to the process working directory, and the backend runs from `backend/`. A `.env` in the repo root is silently ignored.

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Database connection string | `sqlite:///./adsc.db` |
| `SECRET_KEY` | JWT signing key | `dev-secret-key-...` |
| `ADMIN_ACCESS_CODE` | Admin login code | `admin-secret-code` |
| `SMTP_HOST` | Mail server for sending access codes | — |
| `SMTP_PORT` | Mail server port (587 = STARTTLS, 465 = SSL) | `587` |
| `SMTP_USER` | Mail login, also used as the sender address | — |
| `SMTP_PASSWORD` | Mailbox password | — |
| `ENVIRONMENT` | `development` or `production` | `development` |
| `DATA_DIR` | Where training/test uploads are stored | `<repo>/data` |

If `SMTP_HOST` is empty, access codes are still generated but no emails are sent.

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
*Production secrets are read from `backend/.env` — set a real `SECRET_KEY` and `ADMIN_ACCESS_CODE` there before deploying. The compose file no longer carries placeholder values, so a copied development `.env` would run in production unnoticed.*

## Project Structure

```
├── backend/
│   ├── api/
│   │   ├── main.py            # FastAPI app
│   │   ├── config.py          # Environment settings
│   │   ├── auth.py            # JWT handling
│   │   ├── email.py           # SMTP access code delivery
│   │   ├── dependencies.py    # DB session injection
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   └── routes/            # API endpoints
│   ├── seed.py                # Dummy data seeder
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api.js             # API client
│   │   ├── context/           # Auth context
│   │   ├── components/        # Reusable UI components
│   │   └── pages/             # Page components
│   └── package.json
├── data/                      # Training/test data (gitignored)
├── docker-compose.yml
└── docker-compose.prod.yml
```
