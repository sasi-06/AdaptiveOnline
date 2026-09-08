# AdaptExam — AI-Based Adaptive Online Examination System

An AI-powered online exam platform with real-time behavior monitoring and adaptive question replacement using Isolation Forest anomaly detection.

---

## Tech Stack

| Layer     | Technology                            |
|-----------|---------------------------------------|
| Frontend  | React 18 + Vite, React Router v6      |
| Backend   | Node.js + Express 4, JWT              |
| Database  | MongoDB + Mongoose                    |
| ML Service| Python FastAPI + scikit-learn         |
| Behavior  | Webcam (MediaPipe-ready), Visibility API |

---

## Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10
- MongoDB (local or Atlas)

---

## Installation & Setup

### 1. Clone / open project

```bash
cd AdaptiveOnlineExam
```

### 2. Backend

```bash
cd backend
npm install
# Copy and edit environment file:
copy .env.example .env
npm run dev          # starts on http://localhost:5000
```

### 3. Seed database (first time only)

```bash
cd ../database
node seedData.js
```

Seed creates:
- Admin: `admin` / `admin123`
- Students: `alice@exam.com`, `bob@exam.com`, `carol@exam.com` (password: `student123`)
- 16 tagged questions + 1 sample exam assigned to all students

### 4. Python ML Service

```bash
cd ../ml-service
python -m venv venv
# Windows:
venv\Scripts\activate
pip install -r requirements.txt
python app.py         # starts on http://localhost:8000
```

API docs available at `http://localhost:8000/docs`

### 5. Frontend

```bash
cd ../frontend
npm install
npm run dev           # starts on http://localhost:3000
```

---

## Environment Variables

### `backend/.env`

| Variable         | Default                                       | Description              |
|------------------|-----------------------------------------------|--------------------------|
| `PORT`           | `5000`                                        | Backend port             |
| `MONGO_URI`      | `mongodb://localhost:27017/adaptive_exam`     | MongoDB connection string |
| `JWT_SECRET`     | *(change this)*                               | JWT signing secret       |
| `ML_SERVICE_URL` | `http://localhost:8000`                       | ML microservice URL       |
| `RISK_THRESHOLD` | `0.6`                                         | Risk score cutoff [0–1]  |
| `ADMIN_USERNAME` | `admin`                                       | Default admin username   |
| `ADMIN_PASSWORD` | `admin123`                                    | Default admin password   |

---

## API Overview

| Method | Endpoint                             | Auth   | Description                         |
|--------|--------------------------------------|--------|-------------------------------------|
| POST   | `/api/auth/admin/login`              | –      | Admin login                         |
| POST   | `/api/auth/student/login`            | –      | Student login                       |
| GET    | `/api/students`                      | Admin  | List all students                   |
| POST   | `/api/students`                      | Admin  | Create student                      |
| GET    | `/api/exams`                         | Auth   | List all exams                      |
| POST   | `/api/exams`                         | Admin  | Create exam                         |
| PUT    | `/api/exams/assign`                  | Admin  | Assign exam to students             |
| GET    | `/api/exams/student/:id`             | Auth   | Get student's assigned exams        |
| GET    | `/api/questions`                     | Auth   | List questions (with filters)       |
| POST   | `/api/questions/bulk`                | Admin  | Bulk upload questions               |
| POST   | `/api/behavior`                      | Auth   | Log behavior + get risk + adaptive Q|
| GET    | `/api/behavior/all`                  | Admin  | All behavior logs                   |
| POST   | `/api/results`                       | Auth   | Submit exam + get result            |
| GET    | `/api/results/all`                   | Admin  | All exam results                    |

---

## ML Service Endpoints

| Method | Endpoint    | Description                          |
|--------|-------------|--------------------------------------|
| POST   | `/analyze`  | Analyze behavior, return risk score  |
| POST   | `/retrain`  | Retrain Isolation Forest model       |
| GET    | `/health`   | Service health check                 |

**Request body for `/analyze`:**
```json
{
  "eye_deviation": 12.5,
  "head_movement": 8.3,
  "mouse_idle_time": 45.0,
  "response_time": 22.0
}
```

---

## Running All Services Together

Open 3 separate terminals:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — ML Service
cd ml-service && venv\Scripts\activate && python app.py

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Then open `http://localhost:3000`

---

## Project Structure

```
AdaptiveOnlineExam/
├── frontend/src/
│   ├── pages/          Login · StudentDashboard · ExamPage · AdminDashboard · ExamConfig
│   ├── components/     CameraMonitor · QuestionCard · Timer · BehaviorTracker
│   └── services/       api.js
├── backend/
│   ├── models/         Admin · Student · Exam · Question · BehaviorLog · Result
│   ├── controllers/    auth · student · exam · question · behavior · result
│   ├── routes/         (mirrors controllers)
│   ├── services/       riskEngine.js · adaptiveQuestionEngine.js
│   ├── middleware/     authMiddleware.js
│   └── config/         db.js
├── ml-service/         app.py · model.py · requirements.txt
├── database/           seedData.js
└── docs/               system_architecture.md
```
