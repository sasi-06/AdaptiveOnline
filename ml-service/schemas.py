from pydantic import BaseModel
from typing import Optional, List


# ─── BEHAVIORAL PREDICTION ────────────────────────────────────────────────────

class FeatureInput(BaseModel):
    typing_speed: float = 0.0
    average_pause_duration: float = 0.0
    paste_ratio: float = 0.0
    edit_frequency: float = 0.0
    compile_attempts: float = 0.0
    error_frequency: float = 0.0
    code_growth_rate: float = 0.0
    idle_ratio: float = 0.0
    focus_loss_count: float = 0.0
    off_screen_events_count: float = 0.0   # ← new feature (dynamic feature support)
    backspace_ratio: float = 0.0


class PredictionOutput(BaseModel):
    authenticityScore: int
    classification: str
    confidence: float
    riskLevel: str
    featureImportance: dict
    alerts: list


# ─── CODE ANALYSIS ───────────────────────────────────────────────────────────

class CodeAnalysisInput(BaseModel):
    code: str
    language: str
    test_cases_passed: int = 0
    total_test_cases: int = 0


class CodeAnalysisOutput(BaseModel):
    syntax_error: bool
    syntax_error_msg: Optional[str] = None
    complexity: int
    function_count: int
    class_count: int
    has_functions: bool
    has_classes: bool
    avg_name_length: float
    good_naming: bool
    comment_ratio: float
    total_lines: int
    code_lines: int
    nested_depth: int
    loop_count: int
    condition_count: int
    return_count: int
    try_except_count: int
    quality_score: int
    code_quality_score: int


# ─── SELF-LEARNING / RETRAIN ─────────────────────────────────────────────────

class TrainingSample(BaseModel):
    typing_speed: float = 0.0
    average_pause_duration: float = 0.0
    paste_ratio: float = 0.0
    edit_frequency: float = 0.0
    compile_attempts: float = 0.0
    error_frequency: float = 0.0
    code_growth_rate: float = 0.0
    idle_ratio: float = 0.0
    focus_loss_count: float = 0.0
    off_screen_events_count: float = 0.0
    backspace_ratio: float = 0.0
    label: int   # 0 = Suspicious, 1 = Review Needed, 2 = Genuine


class RetrainRequest(BaseModel):
    samples: List[TrainingSample]
    include_synthetic: bool = True
    synthetic_boost: int = 500   # synthetic samples to pad with when real data < threshold


class RetrainResponse(BaseModel):
    success: bool
    message: str
    real_samples: int
    synthetic_samples: int
    total_samples: int
    accuracy: float
    timestamp: str


# ─── MODEL STATS ─────────────────────────────────────────────────────────────

class ModelStatsOutput(BaseModel):
    model_config = {'protected_namespaces': ()}
    model_loaded: bool
    model_type: str
    feature_count: int
    feature_names: list
    last_trained: Optional[str]
    total_samples_used: int
    real_samples: int
    synthetic_samples: int
    accuracy: float


# ─── QUESTION GENERATION ─────────────────────────────────────────────────────

class QuestionGenerationInput(BaseModel):
    question_description: str
    code: str
    language: str
    department: Optional[str] = "General"
    domain_type: Optional[str] = "software"


class QuestionItem(BaseModel):
    questionText: str
    contextCodeSnippet: Optional[str] = ""


class QuestionGenerationOutput(BaseModel):
    questions: List[QuestionItem]
