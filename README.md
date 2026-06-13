# NeuroWatch
### Neuromorphic Crowd Crush Intelligence — Hackathon 2025

---

## Project Structure

```
NeuroWatch/
├── backend/        ← Member 1 & 2 (Python/Flask)
├── frontend/       ← Member 3, 4, 5 (React/Vite)
└── data/           ← Member 4 (venue layout JSON)
```

---

## Backend Setup (M1 & M2)

```bash
cd backend
pip install -r requirements.txt
python app.py
```
Server starts at: `http://localhost:5000`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Server status |
| `/api/risk` | GET | Current risk score + spike grid |
| `/api/alerts` | GET | Last 20 alerts |
| `/api/scenario` | POST | Set scenario (`normal` / `kumbh_surge` / `crush`) |

### Change Scenario (PowerShell)
```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/scenario" -Method POST -ContentType "application/json" -Body '{"scenario":"crush"}'
```

---

## Frontend Setup (M3, M4, M5)

```bash
cd frontend
npm install
npm run dev
```
App starts at: `http://localhost:3000`

Backend is auto-proxied — no CORS issues.

> Connect to backend Socket.IO at `http://localhost:5000`
> Event name: `neurowatch_update`

---

## Team Division

| Member | Role | Files |
|--------|------|-------|
| M1 | CV & Backend Core | `backend/app.py`, `crowd_detector.py` |
| M2 | Neuromorphic Engine | `backend/risk_engine.py`, `spike_generator.py` |
| M3 | Frontend Dashboard | `frontend/src/pages/Dashboard.jsx`, `HeatMap.jsx`, `RiskGauge.jsx` |
| M4 | Map & Rescue | `frontend/src/components/VenueMap.jsx`, `RescuePanel.jsx` |
| M5 | Integration & PPT | `frontend/src/components/AlertFeed.jsx`, demo script, slides |
