# AI-Based Behaviour-Responsive Adaptive Online Examination System

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENT                        │
│  React + Vite (port 3000)                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Login   │ │ Student  │ │ ExamPage │ │    Admin     │  │
│  │  Page    │ │Dashboard │ │ (Engine) │ │  Dashboard   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Components: CameraMonitor, QuestionCard, Timer,       │  │
│  │              BehaviorTracker, QuestionNavigator        │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API (axios)
┌────────────────────────────▼────────────────────────────────┐
│                    EXPRESS BACKEND  (port 5000)              │
│                                                             │
│  Routes: /auth  /students  /exams  /questions               │
│          /behavior  /results                                │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │   riskEngine.js       │  │  adaptiveQuestionEngine.js   │ │
│  │  Calls ML service -->  │  │  Queries MongoDB for alt Q  │ │
│  └──────────┬───────────┘  └──────────────────────────────┘ │
└─────────────┼─────────────────────────────┬─────────────────┘
              │ HTTP POST /analyze           │ Mongoose
┌─────────────▼────────────┐  ┌─────────────▼────────────────┐
│   PYTHON ML SERVICE       │  │   MONGODB  (port 27017)      │
│   FastAPI  (port 8000)    │  │                              │
│                           │  │  Collections:                │
│  POST /analyze            │  │   admins                     │
│   ↓ Isolation Forest      │  │   students                   │
│   ↓ MinMaxScaler          │  │   exams                      │
│   ↓ risk_score [0,1]     │  │   questions                  │
│                           │  │   behaviorlogs               │
│  POST /retrain            │  │   results                    │
│  GET  /health             │  │                              │
└───────────────────────────┘  └──────────────────────────────┘
```

## Data Flow — Adaptive Exam Cycle

```
1. Student opens ExamPage
       ↓
2. Load Exam + Questions from MongoDB via Express
       ↓
3. Start BehaviorTracker (mouse idle, tab switches)
   Start CameraMonitor   (eye deviation, head pose via webcam)
       ↓
4. Every 10 seconds:
   ┌─────────────────────────────────────────────────────┐
   │ Browser → POST /api/behavior                        │
   │  { eyeDeviation, headMovement,                      │
   │    mouseIdleTime, responseTime,                     │
   │    student_id, exam_id, question_id }               │
   └──────────────────────────┬──────────────────────────┘
                              ↓
   Express: riskEngine.js → POST /analyze (ML service)
                              ↓
   IsolationForest → risk_score [0.0 – 1.0]
                              ↓
   risk_score < 0.6 → Continue same question
   risk_score ≥ 0.6 → adaptiveQuestionEngine.js
                         find question where:
                           concept = current.concept
                           structure_type ≠ current.structure_type
                              ↓
   Backend response: { riskScore, adaptiveQuestion? }
                              ↓
   Frontend: replace current question if adaptiveQuestion present
       ↓
5. Student submits exam
   POST /api/results → grade answers + behavior risk summary
```

## Project Structure

```
AdaptiveOnlineExam/
├── frontend/              React + Vite SPA
│   └── src/
│       ├── pages/         Login, StudentDashboard, ExamPage,
│       │                  AdminDashboard, ExamConfig
│       ├── components/    CameraMonitor, QuestionCard,
│       │                  Timer, BehaviorTracker
│       └── services/      api.js (all Axios calls)
│
├── backend/               Node.js + Express API
│   ├── models/            Mongoose schemas
│   ├── controllers/       Business logic per resource
│   ├── routes/            Express routers
│   ├── middleware/        JWT auth + role guards
│   ├── services/          riskEngine + adaptiveQuestionEngine
│   └── config/            MongoDB connection
│
├── ml-service/            Python FastAPI microservice
│   ├── app.py             FastAPI routes (/analyze, /retrain)
│   └── model.py           IsolationForest + MinMaxScaler
│
└── database/
    └── seedData.js        Admin + students + questions seed
```

## Security Design

| Layer    | Mechanism                                         |
|----------|---------------------------------------------------|
| Auth     | JWT (1-day expiry), hashed passwords (bcryptjs)   |
| Routes   | Role-based guards: `adminOnly`, `studentOnly`      |
| Exam     | Tab-switch detection via Visibility API           |
| Behavior | All logs timestamped and stored in MongoDB        |

## Adaptive Engine Logic

```
IF   risk_score < 0.6  → keep current question
ELSE
     query Question WHERE
       concept        = current.concept
       structure_type ≠ current.structure_type
       difficulty     = current.difficulty        (preferred)
     → replace in-flight without interrupting student
```
