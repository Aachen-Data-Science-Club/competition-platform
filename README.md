# ADSC Competition Platform

Die offizielle Data Science Competition Plattform für den [Aachen Data Science Club](https://data-science-club.de/).

Diese Plattform ermöglicht es dem Verein, Machine Learning Wettbewerbe auszurichten. Teilnehmerteams laden trainierte neuronale Netze (als `.onnx` Dateien) hoch. Ein im Hintergrund laufender Evaluator führt diese Modelle täglich gegen einen geheimen Testdatensatz aus und generiert ein Leaderboard.

## 🚀 Architektur

Die Plattform besteht aus drei Hauptkomponenten (Microservices), die über Docker orchestriert werden:

1. **Frontend:** React + Vite (Port 80)
2. **Backend:** FastAPI + SQLite (Port 8000)
3. **ML Evaluator:** Ein Python-Hintergrundprozess (Daemon), der die ONNX-Modelle der Teilnehmer automatisch skaliert, testet und bewertet.

---

## 🧠 Machine Learning & Evaluierung

Die Plattform ist aktuell primär für **Image Classification** ausgelegt. 

### Regeln für Admins (Testdaten)
Wenn du als Admin Testdaten hochlädst, muss die hochgeladene `.zip` Datei zwei Dinge enthalten:
1. Eine Datei, deren Name auf `labels.csv` endet.
2. Die Bilder (Ordnerstruktur ist egal, die Plattform findet sie automatisch).

**Wichtig:** Die `labels.csv` muss eine Spalte namens `filename` haben. In der Spalte für die Lösung *müssen* numerische Klassen-IDs stehen (z.B. `0` für Hund, `1` für Katze), da das Backend `np.argmax()` auf die Ausgabe der ONNX-Modelle anwendet.

### Regeln für Teilnehmer (ONNX Modelle)
- Das Modell muss als `.onnx` Datei vorliegen.
- Der Evaluator skaliert alle Bilder automatisch auf **224x224 RGB**.
- Das System besitzt eine Auto-Erkennung: Es unterstützt sowohl das PyTorch-Format (`CHW`: Channels, Height, Width) als auch das TensorFlow-Format (`HWC`: Height, Width, Channels).

---

## 🛠 Server Deployment & Workflow (Produktion)

Die Plattform läuft als produktives Docker-Setup auf dem Vereins-Server.

### 1. Update / Änderungen einspielen
Wenn du auf deinem Laptop Code geändert und auf GitHub gepusht hast, führst du auf dem Server folgenden Workflow aus:

```bash
# 1. Den neuesten Code herunterladen
git pull

# 2. Container neu bauen und ohne Downtime starten
sudo docker compose -f docker-compose.prod.yml up -d --build
```
*Deine Datenbank (`prod_db`) und alle Uploads (`data/`) sind in Volumes gesichert und bleiben bei diesem Vorgang zu 100% erhalten!*

### 2. Logs prüfen
Wenn die Evaluierung fehlschlägt oder das Backend Fehler wirft:
```bash
sudo docker logs -f adsc-evaluator-prod
sudo docker logs -f adsc-backend-prod
```

### 3. Geheimnisse (.env)
Auf dem Server existiert eine `.env` Datei im Ordner `backend/.env`. Diese wird nicht auf GitHub gepusht! Sie enthält kritische Produktionsdaten:
```ini
ENVIRONMENT=production
SECRET_KEY=eine-sehr-lange-zufaellige-zeichenkette
ADMIN_ACCESS_CODE=dein-admin-passwort
CORS_ORIGINS=https://challenge.adsc.de
```

---

## 💻 Lokale Entwicklung (Development)

Wenn du am Code der Plattform arbeiten willst, klone das Repo auf deinen Laptop und nutze das Development-Setup. Dieses bietet Hot-Reloading, d.h. wenn du Code speicherst, aktualisiert sich die App sofort.

```bash
# Erstellt Dummy-Daten und startet alle Services lokal
docker compose up --build
```
Das Frontend erreichst du unter `http://localhost:5173`, das Backend unter `http://localhost:8000`.
