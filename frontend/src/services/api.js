import axios from 'axios';

const BASE = '/api';
const getToken = () => localStorage.getItem('token');
const authHeaders = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

// Response Interceptor for global 401 Unauthorized handling
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('name');
            localStorage.removeItem('studentId');
            if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
                window.location.href = '/login?expired=true';
            }
        }
        return Promise.reject(error);
    }
);

// ── AUTH ──────────────────────────────────────────────────────────────────
export const adminLogin   = (data) => axios.post(`${BASE}/auth/admin/login`,   data);
export const studentLogin = (data) => axios.post(`${BASE}/auth/student/login`, data);

// ── STUDENTS ──────────────────────────────────────────────────────────────
export const getStudents        = ()         => axios.get   (`${BASE}/students`,                       authHeaders());
export const getStudentProfile  = (id)       => axios.get   (`${BASE}/students/${id}`,                 authHeaders());
export const createStudent      = (data)     => axios.post  (`${BASE}/students`,        data,          authHeaders());
export const updateStudent      = (id, data) => axios.put   (`${BASE}/students/${id}`,  data,          authHeaders());
export const deleteStudent      = (id)       => axios.delete(`${BASE}/students/${id}`,                 authHeaders());
export const bulkUploadStudents = (formData) => axios.post  (`${BASE}/students/bulk-upload`, formData, {
    headers: { ...authHeaders().headers },
});

// ── EXAMS ─────────────────────────────────────────────────────────────────
export const getExams        = ()          => axios.get   (`${BASE}/exams`,                      authHeaders());
export const getExam         = (id)        => axios.get   (`${BASE}/exams/${id}`,                authHeaders());
export const createExam      = (data)      => axios.post  (`${BASE}/exams`,          data,       authHeaders());
export const updateExam      = (id, data)  => axios.put   (`${BASE}/exams/${id}`,    data,       authHeaders());
export const deleteExam      = (id)        => axios.delete(`${BASE}/exams/${id}`,                authHeaders());
export const assignExam      = (data)      => axios.put   (`${BASE}/exams/assign`,   data,       authHeaders());
export const getStudentExams = (studentId) => axios.get   (`${BASE}/exams/student/${studentId}`, authHeaders());

// ── KEY: save the selected question list for an exam ──────────────────────
// Body: { questionIds: ['id1', 'id2', ...] }
// Backend replaces exam.questions with this array
export const updateExamQuestions = (examId, data) =>
    axios.put(`${BASE}/exams/${examId}/questions`, data, authHeaders());

// ── QUESTIONS (global bank) ───────────────────────────────────────────────
export const getQuestions   = (examId) => axios.get (`${BASE}/questions${examId ? `?examId=${examId}` : ''}`, authHeaders());
export const createQuestion = (data)   => axios.post(`${BASE}/questions`,   data,     authHeaders());
export const updateQuestion = (id, d)  => axios.put (`${BASE}/questions/${id}`, d,    authHeaders());
export const deleteQuestion = (id)     => axios.delete(`${BASE}/questions/${id}`,     authHeaders());

// Bulk upload — saves questions to global bank, returns { questions: createdDocs }
// Each question: { question_text, options, correct_answer, topic, concept,
//                 difficulty, structure_type, marks }
export const bulkUploadQ = (data) =>
    axios.post(`${BASE}/questions/bulk`, data, authHeaders());

// ── BEHAVIOR ──────────────────────────────────────────────────────────────
export const logBehavior            = (data)             => axios.post(`${BASE}/behavior`,                       data, authHeaders());
export const getNextAdaptiveQuestion = (data)            => axios.post(`${BASE}/behavior/get-next-question`,     data, authHeaders());
export const getBehaviorLogs        = (studentId, examId)=> axios.get (`${BASE}/behavior/${studentId}/${examId}`,      authHeaders());
export const getAllBehaviorLogs      = ()                 => axios.get (`${BASE}/behavior/all`,                         authHeaders());
export const getStudentBehaviorLogs = (studentId)        => axios.get (`${BASE}/behavior/student/${studentId}`,        authHeaders());

// ── RESULTS ───────────────────────────────────────────────────────────────
export const submitResult         = (data) => axios.post  (`${BASE}/results`,                data,          authHeaders());

// ── CODING ASSESSMENTS ────────────────────────────────────────────────────
export const getCodingAssessments = () => axios.get(`${BASE}/coding/assessments`, authHeaders());
export const createCodingAssessment = (data) => axios.post(`${BASE}/coding/assessments`, data, authHeaders());
export const assignCodingAssessment = (data) => axios.put(`${BASE}/coding/assessments/assign`, data, authHeaders());
export const updateCodingAssessmentQuestions = (id, data) => axios.put(`${BASE}/coding/assessments/${id}/questions`, data, authHeaders());
export const deleteCodingAssessment = (id) => axios.delete(`${BASE}/coding/assessments/${id}`, authHeaders());

// ── TECHNICAL INTERVIEWS ──────────────────────────────────────────────────
export const getInterviews = () => axios.get(`${BASE}/interviews`, authHeaders());
export const createInterview = (data) => axios.post(`${BASE}/interviews`, data, authHeaders());
export const assignInterview = (data) => axios.put(`${BASE}/interviews/assign`, data, authHeaders());
export const deleteInterview = (id) => axios.delete(`${BASE}/interviews/${id}`, authHeaders());
export const getStudentInterviews = (studentId) => axios.get(`${BASE}/interviews/student/${studentId}`, authHeaders());
export const initInterviewSession = (data) => axios.post(`${BASE}/interviews/session/init`, data, authHeaders());
export const uploadInterviewResume = (id, formData) => axios.post(`${BASE}/interviews/session/${id}/resume`, formData, { headers: { ...authHeaders().headers, 'Content-Type': 'multipart/form-data' } });
export const generateInterviewQuestion = (id) => axios.post(`${BASE}/interviews/session/${id}/question`, {}, authHeaders());
export const submitInterviewAnswer = (id, data) => axios.post(`${BASE}/interviews/session/${id}/answer`, data, authHeaders());
export const uploadInterviewCheatClip = (id, formData) => axios.post(`${BASE}/interviews/session/${id}/cheat-clip`, formData, { headers: { ...authHeaders().headers, 'Content-Type': 'multipart/form-data' } });
export const endInterviewSession = (id) => axios.post(`${BASE}/interviews/session/${id}/end`, {}, authHeaders());

// ── DEFAULT EXPORT FOR CODING ASSESSMENT ───────────────────────────────────
const api = {
    get: (url) => axios.get(`${BASE}${url}`, authHeaders()),
    post: (url, data) => axios.post(`${BASE}${url}`, data, authHeaders()),
    put: (url, data) => axios.put(`${BASE}${url}`, data, authHeaders()),
    delete: (url) => axios.delete(`${BASE}${url}`, authHeaders()),
};
export default api;
export const getResult         = (sid, eid)  => axios.get (`${BASE}/results/${sid}/${eid}`,            authHeaders());
export const getAllResults      = ()          => axios.get (`${BASE}/results/all`,                      authHeaders());
export const getStudentResults = (studentId) => axios.get (`${BASE}/results/student/${studentId}`,     authHeaders());

// ── DEPARTMENTS ───────────────────────────────────────────────────────────
export const getDepartments     = ()          => axios.get (`${BASE}/departments`,                  authHeaders());
export const createDepartment   = (data)      => axios.post(`${BASE}/departments`,       data,       authHeaders());
export const updateDepartment   = (id, data)  => axios.put  (`${BASE}/departments/${id}`, data,       authHeaders());
export const deleteDepartment   = (id)        => axios.delete(`${BASE}/departments/${id}`,            authHeaders());
export const updateStudentRoundProgress = (studentId, data) => 
    axios.put(`${BASE}/departments/student/${studentId}/progress`, data, authHeaders());

// ── Interview Behavior Logging (NEW) ──
export const logInterviewBehavior = (payload) => api.post('/interviews/behavior/log', payload);
export const getInterviewBehaviorLogs = (sessionId) => api.get(`/interviews/behavior/${sessionId}`);

// ── CIRCUIT DESIGN PLATFORM ─────────────────────────────────────────────────
export const getCircuitQuestions       = ()           => axios.get (`${BASE}/circuit/questions`,                        authHeaders());
export const getCircuitQuestionsByExam = (examId)     => axios.get (`${BASE}/circuit/questions/exam/${examId}`,         authHeaders());
export const getCircuitQuestion        = (id)         => axios.get (`${BASE}/circuit/questions/${id}`,                  authHeaders());
export const createCircuitQuestion     = (data)       => axios.post(`${BASE}/circuit/questions`,          data,         authHeaders());
export const updateCircuitQuestion     = (id, data)   => axios.put (`${BASE}/circuit/questions/${id}`,    data,         authHeaders());
export const deleteCircuitQuestion     = (id)         => axios.delete(`${BASE}/circuit/questions/${id}`,                authHeaders());

export const assignCircuitExam             = (data)       => axios.post(`${BASE}/circuit/assign`,             data,         authHeaders());
export const saveCircuitDraft          = (data)       => axios.post(`${BASE}/circuit/submissions`,        data,         authHeaders());
export const getCircuitDraft           = (sid, qid)   => axios.get (`${BASE}/circuit/submissions/${sid}/${qid}`,        authHeaders());
export const submitCircuitForEval      = (subId)      => axios.post(`${BASE}/circuit/submissions/${subId}/submit`, {},  authHeaders());
export const getCircuitSubmissionsByStudent = (sid)   => axios.get (`${BASE}/circuit/submissions/student/${sid}`,       authHeaders());
export const getCircuitSubmissionsByExam    = (eid)   => axios.get (`${BASE}/circuit/submissions/exam/${eid}`,          authHeaders());
export const getAllCircuitSubmissions       = ()      => axios.get (`${BASE}/circuit/submissions/all`,                 authHeaders());

// ── AUTOCAD / CIVIL ENGINEERING ASSESSMENTS ──────────────────────────────
export const getCadAssessments          = ()           => axios.get (`${BASE}/cad/assessments`,                         authHeaders());
export const getCadAssessmentById       = (id)         => axios.get (`${BASE}/cad/assessments/${id}`,                   authHeaders());
export const createCadAssessment        = (data)       => axios.post(`${BASE}/cad/assessments`,           data,         authHeaders());
export const updateCadAssessment        = (id, data)   => axios.put (`${BASE}/cad/assessments/${id}`,     data,         authHeaders());
export const deleteCadAssessment        = (id)         => axios.delete(`${BASE}/cad/assessments/${id}`,                 authHeaders());
export const assignCadAssessment        = (data)       => axios.put (`${BASE}/cad/assessments/assign`,    data,         authHeaders());
export const getStudentCadAssessments   = (studentId)  => axios.get (`${BASE}/cad/assessments/student/${studentId}`,  authHeaders());

// ── CAD QUESTIONS & PHOTO UPLOAD ──────────────────────────────────────────
export const getCadQuestions   = (assessmentId) => axios.get(`${BASE}/cad/assessments/${assessmentId}/questions`, authHeaders());
export const createCadQuestion = (assessmentId, formData) => axios.post(`${BASE}/cad/assessments/${assessmentId}/questions`, formData, { headers: { ...authHeaders().headers, 'Content-Type': 'multipart/form-data' } });
export const updateCadQuestion = (questionId, formData) => axios.put(`${BASE}/cad/questions/${questionId}`, formData, { headers: { ...authHeaders().headers, 'Content-Type': 'multipart/form-data' } });
export const deleteCadQuestion = (questionId) => axios.delete(`${BASE}/cad/questions/${questionId}`, authHeaders());

// ── CAD SUBMISSIONS & DRAFTS ──────────────────────────────────────────────
export const saveCadDraft = (data) => axios.post(`${BASE}/cad/assessments/submissions/draft`, data, authHeaders());
export const getCadDraft = (studentId, assessmentId, questionId) => axios.get(`${BASE}/cad/assessments/submissions/draft/${studentId}/${assessmentId}/${questionId}`, authHeaders());
export const getStudentCadSubmissions = (studentId, assessmentId) => axios.get(`${BASE}/cad/assessments/submissions/student/${studentId}/assessment/${assessmentId}`, authHeaders());
export const submitCadAssessment = (data) => axios.post(`${BASE}/cad/assessments/submissions/submit`, data, authHeaders());
export const getCadSubmissionsForAdmin = (assessmentId) => axios.get(`${BASE}/cad/assessments/${assessmentId}/all-submissions`, authHeaders());

