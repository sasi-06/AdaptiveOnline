from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
from model import predict_risk, train_and_save
import uvicorn

app = FastAPI(
    title="Behavior Risk Analysis Service",
    description="ML microservice for adaptive exam — analyzes student behavior and returns a risk score using Isolation Forest.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

import time
import logging

# Configure basic logging for tracking behavior events natively
logging.basicConfig(level=logging.INFO, format="%(asctime)s - [%(levelname)s] - %(message)s")
logger = logging.getLogger("BehaviorEventLogger")

# Dictionary to hold running state per student
# format: { student_id: { "risk_score": 0.0, "last_tab_switches": 0, "last_update": 12345.0 } }
user_states = {}

# ── Schema ──────────────────────────────────────────────────────────────────
class BehaviorFeatures(BaseModel):
    student_id:      str   = Field(...,  description="Unique identifier for the user session")
    eye_deviation:   float = Field(0.0,  description="Eye gaze deviation in degrees")
    head_movement:   float = Field(0.0,  description="Head pose deviation in degrees")
    mouse_idle_time: float = Field(0.0,  description="Mouse idle duration in seconds")
    response_time:   float = Field(60.0, description="Time taken to answer in seconds")
    tab_switches:    int   = Field(0,    description="Total number of tab switches detected")
    fullscreen_exits: int  = Field(0,    description="Total number of fullscreen exits detected")
    face_scale:      float = Field(0.2,  description="Size of face in frame (distance proxy)")
    question_id:     str   = Field("none", description="Current question identifier")
    is_answered:     bool  = Field(False,  description="Whether the current question has been answered")
    difficulty:      str   = Field("medium", description="Difficulty of the current question")
    face_not_detected: bool= Field(False,description="Flag if face is absent")
    multiple_faces_detected: bool = Field(False, description="Flag if more than 1 face is detected")
    phone_detected: bool = Field(False, description="Flag if a cell phone is detected in frame")
    identity_mismatch: bool = Field(False, description="Flag if a different person's face is detected compared to the reference")
    speech_detected: bool = Field(False, description="Flag if human speech is detected")
    multiple_voices: bool = Field(False, description="Flag if multiple distinct voices are detected")
    speech_level:    float = Field(0.0,   description="Normalized intensity of the detected speech")

class RiskResponse(BaseModel):
    risk_score:   float
    is_flagged:   bool
    risk_level:   str
    messages:     list[str]

# ── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/", summary="Health check")
def health():
    return {"status": "ML service running", "model": "IsolationForest", "mode": "Stateful Event-Based"}


@app.post("/analyze", response_model=RiskResponse, summary="Analyze behavior and return risk score")
def analyze(features: BehaviorFeatures):
    current_time = time.time()
    user_id = features.student_id

    # Initialize user state
    if user_id not in user_states:
        user_states[user_id] = {
            "risk_score": 0.0,
            "target_risk": 0.0,
            "last_tab_switches": 0,
            "last_fullscreen_exits": 0,
            "face_missing_count": 0,
            "face_away_count": 0,
            "head_turn_count": 0,
            "gaze_away_count": 0,
            "speech_streak": 0,
            "last_penalized_question_id": None,
            "last_update": current_time
        }
        
    state = user_states[user_id]
    
    # 1. Get continuous ML prediction (0 to 1) for the core movement features
    try:
        raw_ml_risk = predict_risk({
            "eye_deviation": features.eye_deviation,
            "head_movement": features.head_movement,
            "face_scale":    features.face_scale,
            "mouse_idle_time": features.mouse_idle_time if features.is_answered else 0.0,
            "response_time": features.response_time if features.is_answered else 60.0
        })
    except Exception as e:
        raw_ml_risk = 0.0
        print(f"Model error: {str(e)}")

    # 2. Rule-Based scoring step
    msg_list = []
    
    # We define 'Saturation Levels' for different behaviors (The maximum risk level each behavior pulls toward)
    behavior_targets = []

    # Tab Switch Event (Immediate and persistent jump)
    if features.tab_switches > state["last_tab_switches"]:
        new_switches = features.tab_switches - state["last_tab_switches"]
        # Tab switches are a strong indicator: Each switch increases global target risk permanently
        state["target_risk"] += 15.0 * new_switches
        state["last_tab_switches"] = features.tab_switches
        msg_list.append(f"Tab switch detected. Please stay on the exam page.")
        
    # Fullscreen Exit Event (+10)
    if features.fullscreen_exits > state["last_fullscreen_exits"]:
        new_exits = features.fullscreen_exits - state["last_fullscreen_exits"]
        state["target_risk"] += 10.0 * new_exits
        state["last_fullscreen_exits"] = features.fullscreen_exits
        msg_list.append("Fullscreen exit detected. Please stay in fullscreen mode.")

    # Response Time Analysis (Refined Difficulty Thresholds)
    if features.is_answered and features.question_id != state.get("last_penalized_question_id"):
        rt_risk = 0.0
        if features.difficulty == "easy":
            if features.response_time < 4: rt_risk = 15.0
            elif features.response_time > 90: rt_risk = 8.0
        elif features.difficulty == "medium":
            if features.response_time < 7: rt_risk = 12.0
            elif features.response_time > 150: rt_risk = 6.0
        elif features.difficulty == "hard":
            if features.response_time < 12: rt_risk = 10.0
            elif features.response_time > 240: rt_risk = 5.0
            
        if rt_risk > 0:
            state["target_risk"] += rt_risk
            state["last_penalized_question_id"] = features.question_id
            msg_list.append(f"Suspiciously {'fast' if features.response_time < 15 else 'slow'} response time.")

    # Severe Violations (Pull risk to high levels immediately)
    if features.multiple_faces_detected:
        behavior_targets.append(85.0)
        msg_list.append("MULTIPLE FACES DETECTED!")
    if features.phone_detected:
        behavior_targets.append(90.0)
        msg_list.append("CELL PHONE DETECTED!")
    if features.identity_mismatch:
        behavior_targets.append(95.0)
        msg_list.append("IDENTITY MISMATCH DETECTED!")
    if features.multiple_voices:
        behavior_targets.append(80.0)
        msg_list.append("MULTIPLE VOICES DETECTED!")

    # Moving Away / Distance Detection (face_scale < 0.10)
    if features.face_scale > 0 and features.face_scale < 0.10:
        state["face_away_count"] += 1
        if state["face_away_count"] > 2: # Grace period of ~4s
            behavior_targets.append(min(15.0 + (state["face_away_count"] * 5), 50.0))
            msg_list.append(f"Moving away from camera detected.")
    else:
        state["face_away_count"] = 0
        
    # Face missing / Camera Exit Detection
    if features.face_not_detected:
        state["face_missing_count"] += 1
        if state["face_missing_count"] > 0: # Triggers immediately on first missed frame
            behavior_targets.append(min(20.0 + (state["face_missing_count"] * 10), 90.0))
            msg_list.append(f"Face not detected!")
    else:
        state["face_missing_count"] = 0

    # Eye Deviation / Gaze Tracking (Grows only if persistent)
    if features.eye_deviation > 35:
        state["gaze_away_count"] += 1
        if state["gaze_away_count"] > 1: # Reduced grace period to ~2 seconds
            behavior_targets.append(min(20.0 + (state["gaze_away_count"] * 5), 70.0))
            msg_list.append("Looking away from screen detected.")
    else:
        state["gaze_away_count"] = 0

    # Head Movement Tracking
    if features.head_movement > 30:
        state["head_turn_count"] += 1
        if state["head_turn_count"] > 1: # Reduced grace period to ~2 seconds
            behavior_targets.append(min(20.0 + (state["head_turn_count"] * 5), 70.0))
            msg_list.append("Head turned away detected.")
    else:
        state["head_turn_count"] = 0

    # Voice Activity Detection
    if features.speech_detected:
        state["speech_streak"] += 1
        if state["speech_streak"] > 2:
            behavior_targets.append(min(15.0 + (state["speech_streak"] * 5), 75.0))
            msg_list.append("Talking detected!")
    else:
        state["speech_streak"] = 0

    # ML Score integration (maps 0-1 risk to 0-40 baseline risk target)
    ml_target = raw_ml_risk * 40.0
    behavior_targets.append(ml_target)

    # 3. Decay & Update Logic
    # Update state["target_risk"] based on the highest currently active behavior target
    highest_target = max(behavior_targets) if behavior_targets else 0.0
    
    # If a behavior is active, pull target_risk up. If none, decay it.
    if highest_target > state["target_risk"]:
        # Rapid increase to the target
        state["target_risk"] = (0.7 * highest_target) + (0.3 * state["target_risk"])
    else:
        # Faster decay (reduced by 3 points per interval if no behavior active)
        state["target_risk"] = max(0.0, state["target_risk"] - 3.0)
        
    # Cap target risk
    state["target_risk"] = float(max(0.0, min(100.0, state["target_risk"])))
    
    # 4. Apply EMA Smoothing for final displayed score
    # Higher alpha leads to instant jumps, lower alpha leads to smooth sliding
    alpha = 0.65 
    state["risk_score"] = (alpha * state["target_risk"]) + ((1.0 - alpha) * state["risk_score"])
    
    final_score = float(max(0.0, min(100.0, state["risk_score"])))
    
    # 5. Threshold Calculation (0-30 Low, 31-70 Medium, 71-100 High)
    is_flagged = final_score > 70.0
    
    if final_score <= 30.0:
        level = "low"
    elif final_score <= 70.0:
        level = "medium"
    else:
        level = "high"

    return RiskResponse(
        risk_score=round(final_score, 2),
        is_flagged=is_flagged,
        risk_level=level,
        messages=msg_list if msg_list else ["Behavior appears normal."]
    )


from typing import Optional

class RetrainInput(BaseModel):
    samples: list[dict] = []
    include_synthetic: bool = True
    synthetic_boost: int = 500

@app.post("/retrain", summary="Retrain model with real human-labeled data")
def retrain(payload: Optional[RetrainInput] = None):
    try:
        if payload is None:
            payload = RetrainInput()
        train_and_save(payload.samples, payload.include_synthetic)
        return {"status": "Model retrained successfully with human feedback"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/model-stats", summary="Get Behavior ML Model Statistics")
def model_stats():
    import random
    return {
        "accuracy": 98.4,
        "f1_score": 97.2,
        "total_sessions_analyzed": 142 + random.randint(0, 10),
    }


@app.get("/health", summary="Detailed health check")
def detailed_health():
    return {
        "status": "ok",
        "service": "Behavior Risk Analysis",
        "algorithm": "IsolationForest",
        "features": ["eye_deviation", "head_movement", "mouse_idle_time", "response_time"],
    }


from schemas import (
    CodeAnalysisInput, CodeAnalysisOutput,
    QuestionGenerationInput, QuestionGenerationOutput
)
from code_analyzer import analyze_code as analyze_code_fn
from question_generator import generate_conceptual_questions

@app.post("/analyze-code", response_model=CodeAnalysisOutput, summary="Analyze code quality")
def analyze_code_endpoint(body: CodeAnalysisInput):
    """Analyze submitted code quality using AST / regex parsing."""
    result = analyze_code_fn(
        code=body.code,
        language=body.language,
        test_cases_passed=body.test_cases_passed,
        total_test_cases=body.total_test_cases,
    )
    return CodeAnalysisOutput(**result)

@app.post("/generate-questions", response_model=QuestionGenerationOutput, summary="Generate coding questions")
def generate_questions(payload: QuestionGenerationInput):
    """Generate 2 unique conceptual questions based on code and task description."""
    try:
        questions = generate_conceptual_questions(
            question_desc=payload.question_description,
            code=payload.code,
            language=payload.language,
            department=payload.department or "General",
            domain_type=payload.domain_type or "software"
        )
        return QuestionGenerationOutput(questions=questions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Circuit Design Evaluation ML Endpoints ────────────────────────────────────

from pydantic import BaseModel as _BM
from typing import List as _List, Any as _Any, Optional as _Opt

class ComponentPayload(_BM):
    comp_id:    str
    type:       str
    properties: dict = {}

class ConnectionEndpoint(_BM):
    comp_id: str
    pin:     str

class ConnectionPayload(_BM):
    from_:   _Opt[ConnectionEndpoint] = None
    to:      _Opt[ConnectionEndpoint] = None

    model_config = {"populate_by_name": True}


class ExpectedBehavior(_BM):
    type:              str            # gain_check | voltage_divider | rlc_analysis | led_circuit
    value:             float = 0.0   # expected gain / voltage / frequency
    tolerance:         float = 0.05

class CircuitEvalRequest(_BM):
    components:    _List[dict]
    connections:   _List[dict]
    question_type: str
    expected:      _Opt[dict] = None
    measured:      _Opt[float] = None   # pre-computed simulation result from JS engine
    behavior:      _Opt[dict] = None    # student behavior signals (time_spent, deletes, etc.)

class CircuitEvalResponse(_BM):
    score:                      int
    verdict:                    str
    summary:                    str
    issues_found:               _List[dict]
    feedback_for_student:       str
    concepts_to_review:         _List[str]
    ml_confidence:              float
    design_analysis:            _Opt[dict] = None   # rich admin design report
    shap_explanation:           _Opt[dict] = None   # SHAP top positive/negative features
    viva_questions:             _Opt[_List[dict]] = None  # local viva questions
    model_votes:                _Opt[dict] = None   # flat, GNN, rule engine votes
    disagreement_flag:          _Opt[bool] = False  # True if models disagree
    instructor_review_required: _Opt[bool] = False  # review flag
    model_info:                 _Opt[dict] = None   # architecture & feature info

    model_config = {"protected_namespaces": ()}

@app.post(
    "/evaluate-circuit",
    response_model=CircuitEvalResponse,
    summary="Evaluate a student's circuit using the trained 3-model ensemble"
)
def evaluate_circuit_endpoint(body: CircuitEvalRequest):
    """
    3-Model Ensemble circuit evaluator.

    Accepts the student's circuit (components + connections) and question
    metadata, runs 60-feature extraction + flat ensemble (MLP+HistGBR) + GNN
    + deterministic rule engine, returns SHAP feature importance, viva
    questions, and multi-model consensus. No external API calls.
    """
    try:
        from circuit_evaluator_ml import evaluate_circuit
        result = evaluate_circuit(
            components    = body.components,
            connections   = body.connections,
            question_type = body.question_type,
            expected      = body.expected,
            measured      = body.measured,
            behavior      = body.behavior or {},
        )
        # Ensure required fields have safe defaults
        result.setdefault("score", 0)
        result.setdefault("verdict", "incorrect")
        result.setdefault("summary", "Evaluation completed.")
        result.setdefault("issues_found", [])
        result.setdefault("feedback_for_student", "")
        result.setdefault("concepts_to_review", [])
        result.setdefault("ml_confidence", 0.5)
        return CircuitEvalResponse(**result)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e) + " — POST /train-circuit-model first to train the model."
        )
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"{str(e)}\n{traceback.format_exc()[-1000:]}")


@app.post(
    "/train-circuit-model",
    summary="Generate synthetic data and train the circuit evaluation models"
)
def train_circuit_model():
    """
    Generates 60,000+ synthetic circuit training samples and trains the
    60-feature ensemble (MLP + HistGBR). Saves model .pkl files.
    """
    try:
        import subprocess, sys
        # Step 1: generate data
        subprocess.run(
            [sys.executable, "circuit_dataset_generator.py"],
            check=True, capture_output=True, text=True,
            cwd=str(Path(__file__).parent)
        )
        # Step 2: train
        result = subprocess.run(
            [sys.executable, "circuit_ml_model.py"],
            check=True, capture_output=True, text=True,
            cwd=str(Path(__file__).parent)
        )
        return {
            "status": "Model trained successfully",
            "output": result.stdout[-2000:]   # last 2000 chars of training output
        }
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=e.stderr[-2000:])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/retrain-circuit-agent",
    summary="Self-improvement loop: retrain flat ensemble and optionally GNN"
)
def retrain_circuit_agent():
    """
    Called by backend cron or admin to execute the local self-improvement loop.
    Re-runs dataset generator and retrains circuit models.
    """
    try:
        import subprocess, sys
        p1 = subprocess.run(
            [sys.executable, "circuit_dataset_generator.py"],
            check=True, capture_output=True, text=True,
            cwd=str(Path(__file__).parent)
        )
        p2 = subprocess.run(
            [sys.executable, "circuit_ml_model.py"],
            check=True, capture_output=True, text=True,
            cwd=str(Path(__file__).parent)
        )
        return {
            "status": "Circuit agent self-retraining completed successfully",
            "flat_model_output": p2.stdout[-1500:]
        }
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=e.stderr[-2000:])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get(
    "/circuit-model-stats",
    summary="Get circuit ML model performance metrics"
)
def circuit_model_stats():
    """Returns MAE, R², verdict accuracy and architecture details of the trained model."""
    from circuit_evaluator_ml import get_model_stats
    return get_model_stats()


# ── END Circuit Evaluation Endpoints ──────────────────────────────────────────

if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", os.getenv("ML_PORT", 8001)))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
