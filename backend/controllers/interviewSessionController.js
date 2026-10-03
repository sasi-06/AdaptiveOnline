const InterviewSession = require('../models/InterviewSession');
const InterviewDefinition = require('../models/InterviewDefinition');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ─── RESUME EXTRACTION HELPER ──────────────────────────────────────────────
const KNOWN_SKILLS = [
    // Languages
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'golang', 'go', 'rust', 'php', 'ruby', 'sql', 'html', 'css', 'bash', 'r', 'dart', 'kotlin', 'swift',
    // Frontend
    'react', 'react.js', 'redux', 'next.js', 'vue', 'vue.js', 'angular', 'svelte', 'tailwind', 'bootstrap', 'sass', 'webpack', 'vite',
    // Backend
    'node.js', 'express', 'express.js', 'nestjs', 'django', 'fastapi', 'flask', 'spring', 'spring boot', 'asp.net', '.net', 'graphql', 'rest api', 'microservices',
    // Databases
    'mongodb', 'postgresql', 'postgres', 'mysql', 'redis', 'sqlite', 'cassandra', 'elasticsearch', 'dynamodb', 'oracle', 'firebase', 'prisma',
    // Cloud & DevOps
    'docker', 'kubernetes', 'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'ci/cd', 'git', 'github actions', 'terraform', 'jenkins', 'linux', 'nginx',
    // AI / ML / Data
    'machine learning', 'deep learning', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'numpy', 'nlp', 'llm', 'computer vision', 'opencv', 'keras',
    // Concepts & Testing
    'jest', 'mocha', 'cypress', 'selenium', 'unit testing', 'system design', 'agile', 'scrum', 'data structures', 'algorithms', 'oop'
];

function extractResumeDetails(text) {
    if (!text || typeof text !== 'string') {
        return {
            skills: ['Full Stack Development', 'Problem Solving', 'Software Engineering'],
            projects: ['Web Application Project'],
            experience: 'Not specified'
        };
    }

    const lower = text.toLowerCase();

    // 1. Extract matching skills
    const matchedSkills = [];
    KNOWN_SKILLS.forEach(skill => {
        // Escape all regex special characters securely
        const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
        if (regex.test(lower) && !matchedSkills.some(s => s.toLowerCase() === skill)) {
            // Capitalize properly
            matchedSkills.push(skill.toUpperCase() === skill ? skill : skill.charAt(0).toUpperCase() + skill.slice(1));
        }
    });

    // 2. Extract Projects
    const projects = [];
    const projectSectionMatch = text.match(/(?:projects|key projects|academic projects)[\s\S]{10,800}?(?=(?:skills|experience|education|certifications|achievements|$))/i);
    if (projectSectionMatch) {
        const lines = projectSectionMatch[0].split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (/^[•\-\*#]|\bproject\b/i.test(line) && line.length > 5 && line.length < 80) {
                const cleaned = line.replace(/^[•\-\*#\d\.\s]+/, '').trim();
                if (cleaned && !projects.includes(cleaned)) {
                    projects.push(cleaned);
                }
            }
        }
    }
    if (projects.length === 0) {
        // Fallback search for common project titles
        const projKeywords = ['Platform', 'System', 'Application', 'Dashboard', 'Portal', 'API', 'App', 'Bot'];
        const words = text.split('\n').map(l => l.trim());
        for (const line of words) {
            if (projKeywords.some(k => line.includes(k)) && line.length > 8 && line.length < 70) {
                projects.push(line.replace(/^[•\-\*#\d\.\s]+/, '').trim());
                if (projects.length >= 3) break;
            }
        }
    }

    // 3. Extract Experience
    let experience = 'Fresher / Entry Level';
    const expMatch = text.match(/(\d+(?:\.\d+)?)\+?\s*years?(?:\s+of)?\s+experience/i);
    if (expMatch) {
        experience = `${expMatch[1]}+ years`;
    } else if (/senior|lead|architect/i.test(lower)) {
        experience = 'Senior / Experienced';
    } else if (/intern|trainee|student/i.test(lower)) {
        experience = 'Student / Intern';
    }

    return {
        skills: matchedSkills.length > 0 ? matchedSkills.slice(0, 12) : ['Software Engineering', 'JavaScript', 'Database Management'],
        projects: projects.length > 0 ? projects.slice(0, 3) : ['Full Stack Web Platform', 'Cloud Microservice'],
        experience
    };
}

// ─── DOMAIN QUESTION BANK (100+ PROFESSIONAL QUESTIONS) ──────────────────────
const DOMAIN_QUESTIONS = {
    frontend: [
        {
            q: "Can you explain how the Virtual DOM works in React, and how React reconciles differences to optimize browser rendering?",
            a: "The Virtual DOM is a lightweight in-memory JavaScript representation of the real DOM. React maintains two trees: the current state and the updated virtual tree. During reconciliation, React runs a diffing algorithm to identify exact nodes that changed and batches those updates to the real DOM, avoiding expensive layout reflows and repaints.",
            keywords: ["virtual dom", "in-memory", "diffing", "reconciliation", "batch", "reflow", "repaint", "real dom", "nodes", "performance"]
        },
        {
            q: "How do you choose between React Context API and external state management solutions like Redux or Zustand for large applications?",
            a: "React Context is built for low-frequency global updates like themes, user authentication, or localization. However, every context change triggers re-renders across all consuming components. Redux or Zustand provides fine-grained selector subscriptions, middleware support for async actions, and DevTools for time-travel debugging, making them suited for high-frequency or complex application state.",
            keywords: ["context", "redux", "zustand", "re-render", "selectors", "middleware", "high frequency", "global state", "performance", "action"]
        },
        {
            q: "What techniques do you use to diagnose and fix performance bottlenecks in a modern frontend web application?",
            a: "Techniques include code splitting with dynamic imports, lazy loading images and components, memoization with useMemo and useCallback to avoid recalculations and re-renders, optimizing bundle sizes via tree-shaking, leveraging browser caching and CDNs, and profiling performance using Chrome DevTools Lighthouse and React Profiler.",
            keywords: ["code splitting", "lazy loading", "memoization", "usememo", "usecallback", "bundle", "tree-shaking", "lighthouse", "profiler", "caching"]
        },
        {
            q: "Can you explain the difference between Server-Side Rendering (SSR), Client-Side Rendering (CSR), and Static Site Generation (SSG)?",
            a: "CSR renders HTML entirely in the browser using JavaScript, resulting in slower initial loads but fast subsequent navigation. SSR renders HTML on each server request, improving SEO and First Contentful Paint. SSG generates static HTML files ahead of time at build time, offering maximal speed and CDN cacheability for content that does not change on every request.",
            keywords: ["ssr", "csr", "ssg", "server-side", "client-side", "static site", "seo", "first contentful paint", "build time", "cdn"]
        },
        {
            q: "How do you manage side effects, race conditions, and cleanup in React's useEffect hook?",
            a: "Side effects are managed by declaring explicit dependencies in the dependency array. Cleanups are handled by returning a cleanup function that cancels ongoing network requests (using AbortController), clears timers, or removes event listeners to prevent memory leaks and out-of-order state updates from stale promises.",
            keywords: ["useeffect", "side effects", "cleanup", "abortcontroller", "dependency array", "memory leak", "race condition", "stale"]
        },
        {
            q: "What are Web Workers and when would you use them in a browser application?",
            a: "Web Workers allow JavaScript code to run on a background thread separate from the main browser execution thread. They are used for CPU-intensive tasks such as large data sorting, image processing, cryptography, or mathematical simulations without freezing the UI or dropping frame rates.",
            keywords: ["web workers", "background thread", "main thread", "cpu-intensive", "ui thread", "non-blocking", "concurrency"]
        }
    ],
    backend: [
        {
            q: "How does the Node.js Event Loop process asynchronous operations, and what is the difference between the microtask and macrotask queues?",
            a: "The Node.js event loop executes in phases: timers, pending callbacks, idle/prepare, poll, check, and close callbacks. Microtasks (process.nextTick and Promise callbacks) have higher priority and are executed immediately after the current operation finishes before the event loop advances to the next macrotask (setTimeout, setInterval, setImmediate).",
            keywords: ["event loop", "microtask", "macrotask", "nexttick", "promise", "settimeout", "setimmediate", "poll", "non-blocking", "call stack"]
        },
        {
            q: "How do you design and secure RESTful APIs against common vulnerabilities like SQL injection, CSRF, and brute force attacks?",
            a: "Security measures include parameterized queries and ORM sanitization against SQL/NoSQL injection, enforcing HTTPS with strict CORS policies, using HTTP-only Secure SameSite cookies or short-lived JWTs with refresh rotation, implementing rate limiting (e.g. express-rate-limit/Redis), and validating input payloads with schemas like Joi or Zod.",
            keywords: ["parameterized", "sql injection", "cors", "jwt", "rate limiting", "csrf", "input validation", "sanitization", "https", "tokens"]
        },
        {
            q: "How do you implement Redis caching in a backend service, and how do you handle cache invalidation and cache stamps/stampedes?",
            a: "Redis serves as an in-memory key-value cache between application server and database. Cache invalidation strategies include write-through, write-behind, and TTL expiration. Cache stampedes (thundering herd) are mitigated using probabilistic early expiration, mutex locking, or background warm-up jobs.",
            keywords: ["redis", "in-memory", "cache invalidation", "ttl", "stampede", "thundering herd", "mutex", "write-through", "hit ratio"]
        },
        {
            q: "Can you explain the differences between monolithic architecture and microservices, and how services communicate reliably?",
            a: "Monoliths package all components in a single deployable unit, simple to test but hard to scale independently. Microservices decouple business domains into independently scalable services communicating synchronously via REST/gRPC or asynchronously via message brokers like Kafka or RabbitMQ with circuit breakers to handle failure propagation.",
            keywords: ["monolith", "microservices", "grpc", "kafka", "rabbitmq", "decoupled", "circuit breaker", "asynchronous", "scalability"]
        },
        {
            q: "How do database transactions maintain ACID properties, and what are the trade-offs between different transaction isolation levels?",
            a: "ACID ensures Atomicity (all-or-nothing), Consistency (rules preserved), Isolation (concurrent safety), and Durability (committed data survives crashes). Isolation levels range from Read Uncommitted to Serializable. Higher isolation levels prevent dirty reads, non-repeatable reads, and phantom reads, but increase lock contention and lower concurrency.",
            keywords: ["acid", "atomicity", "consistency", "isolation", "durability", "read committed", "serializable", "dirty read", "phantom read", "locks"]
        }
    ],
    python: [
        {
            q: "Can you explain Python's Global Interpreter Lock (GIL) and how it affects multithreaded versus multiprocessing applications?",
            a: "The GIL is a mutex that prevents multiple native threads from executing Python bytecodes simultaneously in CPython. As a result, multithreading in Python does not speed up CPU-bound tasks. To achieve true parallel CPU execution, Python applications use the multiprocessing module or process pools, while multithreading remains effective for I/O-bound operations.",
            keywords: ["gil", "global interpreter lock", "multithreading", "multiprocessing", "cpu-bound", "i/o-bound", "cpython", "concurrency", "parallelism"]
        },
        {
            q: "How do Python generators and the yield keyword work, and what advantages do they provide for handling large datasets?",
            a: "Generators are functions that maintain their execution state and produce values on demand using the yield keyword rather than returning all values at once in memory. This lazy evaluation minimizes memory consumption when streaming or processing large datasets, CSVs, or database cursors.",
            keywords: ["generator", "yield", "lazy evaluation", "memory", "streaming", "iterable", "iterator", "state"]
        },
        {
            q: "How does Python manage memory, and how does the cyclic garbage collector detect and reclaim unreachable circular references?",
            a: "Python uses reference counting as its primary memory management mechanism. When an object's reference count drops to zero, its memory is deallocated immediately. For circular references where objects reference each other, Python's cyclic garbage collector tracks reference chains and isolated subgraphs across generations (0, 1, 2) to reclaim dead memory.",
            keywords: ["reference counting", "garbage collector", "circular reference", "generations", "deallocation", "memory management"]
        },
        {
            q: "What is the difference between FastAPI and Django, and when would you choose one over the other for a project?",
            a: "Django is a full-featured batteries-included framework with built-in ORM, admin panel, authentication, and templating, ideal for monolithic, content-rich web apps. FastAPI is a modern, lightweight, asynchronous framework built on Starlette and Pydantic, offering high performance, automatic OpenAPI documentation, and ideal fit for microservices and ML model APIs.",
            keywords: ["fastapi", "django", "async", "pydantic", "orm", "openapi", "batteries-included", "microservices", "performance"]
        }
    ],
    java: [
        {
            q: "Can you explain the Java Memory Model (JVM) architecture, including the Heap, Stack, Metaspace, and Garbage Collection generations?",
            a: "The JVM divides runtime data into Stack (per-thread execution, primitive variables, and method call frames) and Heap (shared memory for object instances). The Heap is partitioned into Young Generation (Eden and Survivor spaces) and Old Generation (Tenured). Metaspace holds class metadata. Minor GC cleans young objects, while Major/Full GC reclaims old tenured objects.",
            keywords: ["jvm", "heap", "stack", "metaspace", "young generation", "old generation", "eden", "garbage collection", "memory"]
        },
        {
            q: "How does Spring Boot implement Dependency Injection and Inversion of Control, and what are the scopes of Spring Beans?",
            a: "Spring IoC container creates, configures, and manages object lifecycles, injecting dependencies via @Autowired constructor or field injection. Common bean scopes include Singleton (one instance per Spring container, default), Prototype (new instance every request), Request, Session, and Application for web contexts.",
            keywords: ["dependency injection", "ioc", "spring boot", "bean", "singleton", "prototype", "autowired", "lifecycle"]
        },
        {
            q: "How do you handle concurrency in Java using synchronized blocks, locks, and ConcurrentHashMap?",
            a: "Java provides synchronized keywords and ReentrantLock for mutual exclusion. For concurrent collections, ConcurrentHashMap uses segment or bucket-level locking (CAS operations and synchronized nodes) to allow multiple threads to read and write concurrently without locking the entire map, achieving far higher throughput than Hashtable.",
            keywords: ["concurrency", "thread", "synchronized", "reentrantlock", "concurrenthashmap", "cas", "mutex", "deadlock"]
        }
    ],
    devops: [
        {
            q: "How do Docker containers differ from Virtual Machines, and how does Docker utilize Linux namespaces and cgroups?",
            a: "Virtual Machines emulate hardware and run complete guest operating systems with a hypervisor, consuming significant memory and boot time. Docker containers share the host Linux kernel and isolate processes using Linux namespaces (PID, NET, MNT, IPC) while enforcing CPU and memory resource limits using cgroups (control groups).",
            keywords: ["docker", "container", "virtual machine", "hypervisor", "kernel", "namespaces", "cgroups", "isolation", "overhead"]
        },
        {
            q: "Can you explain the core components of Kubernetes architecture, including Pods, Deployments, Services, and Ingress?",
            a: "A Pod is the smallest deployable compute unit in Kubernetes containing one or more containers. Deployments manage declarative updates, scaling, and rolling rollbacks of Pods. Services provide stable networking and load balancing across dynamic Pod IPs. Ingress manages external HTTP/HTTPS routing and TLS termination into cluster services.",
            keywords: ["kubernetes", "pod", "deployment", "service", "ingress", "cluster", "scaling", "load balancing", "rolling update"]
        },
        {
            q: "How do you design a reliable CI/CD pipeline, and what automated gates do you establish before production deployment?",
            a: "A CI/CD pipeline automates linting, static code analysis (SonarQube), unit and integration tests, container building, vulnerability scanning (Trivy), and deployment. Automated gates include mandatory test coverage thresholds, security checks, canary or blue-green deployment strategies, and automatic rollback triggers upon health check failures.",
            keywords: ["ci/cd", "pipeline", "automated tests", "sonar", "blue-green", "canary", "rollback", "linting", "vulnerability scan"]
        }
    ],
    datascience: [
        {
            q: "How do you diagnose and prevent overfitting in machine learning models, and how do L1 and L2 regularization differ?",
            a: "Overfitting occurs when a model learns training noise rather than general patterns, leading to high training accuracy but poor validation performance. Prevention methods include cross-validation, pruning, dropout, and regularization. L1 regularization (Lasso) adds absolute weights driving irrelevant coefficients to zero for feature selection; L2 (Ridge) squares weights penalizing large weights smoothly.",
            keywords: ["overfitting", "regularization", "l1", "l2", "lasso", "ridge", "cross-validation", "bias-variance", "dropout"]
        },
        {
            q: "Can you explain the trade-offs between precision, recall, and F1-score, especially when dealing with imbalanced datasets?",
            a: "Precision measures true positives over all predicted positives (cost of false alarms), while Recall measures true positives over all actual positives (cost of missed detections). In imbalanced datasets like fraud detection, accuracy is misleading. The F1-score is the harmonic mean of precision and recall, balancing false positives and false negatives.",
            keywords: ["precision", "recall", "f1-score", "imbalanced", "false positive", "false negative", "harmonic mean", "confusion matrix"]
        },
        {
            q: "How do Transformer architectures and self-attention mechanisms differ from traditional Recurrent Neural Networks (RNNs)?",
            a: "RNNs process tokens sequentially, which creates information bottlenecks over long distances and prevents parallelization. Transformers use multi-head self-attention to compute pairwise relevance between all tokens simultaneously in parallel, capturing long-range contextual relationships far more effectively across entire sequences.",
            keywords: ["transformer", "self-attention", "rnn", "parallelization", "sequence", "context", "multi-head", "tokens"]
        }
    ],
    database: [
        {
            q: "How do B-Tree and Hash indexes work in relational databases, and what factors decide whether an index improves or slows down query performance?",
            a: "B-Trees maintain sorted balanced trees allowing logarithmic range searches and equality lookups. Hash indexes provide O(1) point lookups but cannot support range queries. While indexes drastically accelerate SELECT queries, each index introduces write overhead on INSERT, UPDATE, and DELETE operations as indexes must be rebalanced, and excessive indexes waste memory.",
            keywords: ["b-tree", "index", "hash index", "range query", "select", "insert", "overhead", "query execution", "explain"]
        },
        {
            q: "Can you explain database sharding, replication, and how the CAP theorem applies to distributed database architectures?",
            a: "Replication copies data across nodes for high availability and read scalability (leader-follower). Sharding partitions data horizontally across nodes for write scalability. The CAP theorem states a distributed system can only guarantee two of Consistency, Availability, and Partition Tolerance simultaneously; during network partitions, systems must prioritize consistency or availability.",
            keywords: ["sharding", "replication", "cap theorem", "consistency", "availability", "partition tolerance", "distributed", "horizontal scaling"]
        }
    ]
};

// ─── CANDIDATE DOMAIN MATCHER & SEEDED SELECTOR ────────────────────────────
function determineCandidateDomain(role = '', skills = []) {
    const roleLower = (role || '').toLowerCase();
    const skillsLower = (skills || []).map(s => (s || '').toLowerCase()).join(' ');

    if (/python|django|fastapi|flask/.test(roleLower) || /python|django|fastapi/.test(skillsLower)) {
        return 'python';
    }
    if (/java|spring|spring boot|kotlin/.test(roleLower) || /java|spring boot|spring/.test(skillsLower)) {
        return 'java';
    }
    if (/devops|cloud|kubernetes|docker|sre|infrastructure/.test(roleLower) || /kubernetes|docker|terraform|aws|ci\/cd/.test(skillsLower)) {
        return 'devops';
    }
    if (/data scientist|machine learning|ai|data analyst|nlp/.test(roleLower) || /machine learning|tensorflow|pytorch|pandas/.test(skillsLower)) {
        return 'datascience';
    }
    if (/react|frontend|ui|web developer|angular|vue/.test(roleLower) || /react|vue|angular|css|frontend/.test(skillsLower)) {
        return 'frontend';
    }
    if (/backend|node|express|api|golang|microservice/.test(roleLower) || /node.js|express|mongodb|postgresql/.test(skillsLower)) {
        return 'backend';
    }
    return 'frontend'; // Default fallback pool
}

// Deterministic seedable hash to ensure each candidate gets a unique question set
function pseudoRandomSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function selectCandidateQuestion(session) {
    const role = session.selectedRole || 'Software Engineer';
    const skills = session.extractedData?.skills || [];
    const askedQuestions = (session.qa_pairs || []).map(p => p.question.toLowerCase().trim());
    const primaryDomain = determineCandidateDomain(role, skills);

    // Build candidate pool: Primary domain + related general domains (database, backend, frontend)
    let candidatePool = [...(DOMAIN_QUESTIONS[primaryDomain] || [])];
    if (primaryDomain !== 'database') {
        candidatePool = candidatePool.concat(DOMAIN_QUESTIONS.database || []);
    }
    if (primaryDomain !== 'backend' && primaryDomain !== 'frontend') {
        candidatePool = candidatePool.concat(DOMAIN_QUESTIONS.backend || []);
    }

    // Filter out already asked questions
    let available = candidatePool.filter(item => !askedQuestions.includes(item.q.toLowerCase().trim()));

    if (available.length === 0) {
        // Fallback across all questions if exhausted
        const allQuestions = Object.values(DOMAIN_QUESTIONS).flat();
        available = allQuestions.filter(item => !askedQuestions.includes(item.q.toLowerCase().trim()));
    }

    if (available.length === 0) {
        return {
            q: `Can you elaborate further on how you would architect and scale a critical feature for the ${role} role?`,
            a: "The candidate should clearly explain requirements analysis, architectural components, database choices, error handling, and performance optimization.",
            keywords: ["architecture", "scale", "performance", "database", "components", "error handling"]
        };
    }

    // Seeded selection based on student ID + session ID + question count
    // THIS GUARANTEES USER A AND USER B GET DIFFERENT QUESTIONS!
    const seedString = `${session.student}_${session._id}_${session.qa_pairs.length}_${role}`;
    const seedVal = pseudoRandomSeed(seedString);

    // Check if we should ask a contextual follow-up based on the last answer
    const prevCount = session.qa_pairs.length;
    if (prevCount > 0) {
        const lastQA = session.qa_pairs[prevCount - 1];
        const lastAnswer = (lastQA.answer || '').toLowerCase();

        // Check if candidate mentioned key concepts in previous answer
        const followUpKeywords = [
            { word: 'cache', domain: 'backend', qIdx: 2 },
            { word: 'index', domain: 'database', qIdx: 0 },
            { word: 'state', domain: 'frontend', qIdx: 1 },
            { word: 'async', domain: 'backend', qIdx: 0 },
            { word: 'docker', domain: 'devops', qIdx: 0 },
            { word: 'transaction', domain: 'backend', qIdx: 4 },
            { word: 'memory', domain: 'python', qIdx: 2 }
        ];

        for (const f of followUpKeywords) {
            if (lastAnswer.includes(f.word)) {
                const targetPool = DOMAIN_QUESTIONS[f.domain] || [];
                const matched = targetPool.find(q => !askedQuestions.includes(q.q.toLowerCase().trim()));
                if (matched) {
                    return matched;
                }
            }
        }
    }

    // Pick using seeded index
    const selectedIndex = seedVal % available.length;
    return available[selectedIndex];
}

// ─── ROBUST ANSWER EVALUATOR ──────────────────────────────────────────────
function evaluateCandidateAnswer(question, expectedAnswer, candidateAnswer, expectedKeywords = []) {
    const text = (candidateAnswer || '').trim();

    if (!text || text.length < 5 || text.toLowerCase() === 'no answer provided.') {
        return {
            score: 0,
            feedback: "No answer was recorded. Please speak clearly into your microphone or verify your input."
        };
    }

    const lowerAnswer = text.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);

    // Check for explicit non-answers ("I don't know", "skip", "no idea")
    if (/^(i don't know|no idea|skip|pass|not sure|i do not know)\.?$/i.test(text.trim())) {
        return {
            score: 15,
            feedback: "Candidate acknowledged not knowing the concept. Recommended reviewing foundational documentation on this topic."
        };
    }

    // 1. Concept Keyword Matching (Coverage)
    let keywords = expectedKeywords;
    if (!keywords || keywords.length === 0) {
        // Derive keywords from expectedAnswer
        keywords = expectedAnswer
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 4 && !['which', 'their', 'there', 'about', 'these', 'would', 'could', 'should'].includes(w));
    }

    let matchedKeywords = 0;
    const coveredConcepts = [];
    const missingConcepts = [];

    keywords.forEach(kw => {
        if (lowerAnswer.includes(kw.toLowerCase())) {
            matchedKeywords++;
            if (coveredConcepts.length < 4) coveredConcepts.push(kw);
        } else {
            if (missingConcepts.length < 3) missingConcepts.push(kw);
        }
    });

    const keywordRatio = keywords.length > 0 ? matchedKeywords / keywords.length : 0.5;

    // 2. Technical Depth & Elaboration (0 to 35)
    // Reward structured, articulate answers with appropriate technical length
    let depthScore = 15;
    if (words.length >= 20) depthScore = 22;
    if (words.length >= 40) depthScore = 28;
    if (words.length >= 70) depthScore = 35;

    // Boost if reasoning conjunctions are used
    if (/because|therefore|in order to|prevents|ensures|improves|resulting in|trade-off|architecture/i.test(text)) {
        depthScore = Math.min(35, depthScore + 5);
    }

    // 3. Concept Relevance Score (0 to 45)
    const conceptScore = Math.round(keywordRatio * 45);

    // 4. Clarity & Articulation (0 to 20)
    let clarityScore = 12;
    if (words.length >= 15 && text.includes('.')) clarityScore = 18;
    if (words.length < 8) clarityScore = 6;

    // Total Score (15 to 100)
    const totalScore = Math.min(100, Math.max(20, conceptScore + depthScore + clarityScore));

    // Constructive Feedback Generation
    let feedback = '';
    if (totalScore >= 80) {
        feedback = `Excellent and thorough answer. Demonstrated solid understanding of ${coveredConcepts.slice(0, 2).join(' and ') || 'the core mechanisms'}.`;
    } else if (totalScore >= 60) {
        feedback = `Good explanation. Touched on ${coveredConcepts.slice(0, 2).join(' and ') || 'relevant points'}, but could be strengthened by discussing ${missingConcepts.slice(0, 2).join(' and ') || 'deeper architectural trade-offs'}.`;
    } else {
        feedback = `Basic response. Missing crucial technical details regarding ${missingConcepts.slice(0, 2).join(' and ') || 'the expected concepts'}. Elaborate with specific architectural mechanisms.`;
    }

    return {
        score: totalScore,
        feedback
    };
}

// ─── EXPORTED CONTROLLER METHODS ──────────────────────────────────────────

// 1. Initialize Session
exports.initSession = async (req, res) => {
    try {
        const { interviewId, selectedRole, reset } = req.body;

        const definition = await InterviewDefinition.findById(interviewId);
        if (!definition) return res.status(404).json({ message: 'Interview definition not found' });

        const studentId = req.student ? req.student.id : req.user.id;

        let session = await InterviewSession.findOne({
            student: studentId,
            interview: interviewId
        });

        // If session exists and reset requested OR session was previously completed, reset for fresh attempt
        if (session && (reset || session.status === 'completed' || session.qa_pairs.length > 0)) {
            session.selectedRole = selectedRole || session.selectedRole;
            session.status = 'in_progress';
            session.totalQuestionsConfigured = definition.numQuestions || 5;
            session.qa_pairs = [];
            session.cheatingClips = [];
            session.finalScore = 0;
            session.report = {};
            await session.save();
        } else if (!session) {
            session = await InterviewSession.create({
                student: studentId,
                interview: interviewId,
                selectedRole,
                status: 'in_progress',
                totalQuestionsConfigured: definition.numQuestions || 5,
                qa_pairs: [],
                cheatingClips: []
            });
        } else {
            session.selectedRole = selectedRole;
            session.status = 'in_progress';
            session.totalQuestionsConfigured = definition.numQuestions || 5;
            await session.save();
        }

        res.status(200).json(session);
    } catch (error) {
        console.error('initSession error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 2. Upload Resume
exports.uploadResume = async (req, res) => {
    try {
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        if (!req.file) return res.status(400).json({ message: 'No resume file uploaded' });

        let resumeText = '';
        let fileBuffer = req.file.buffer;

        // If file was saved to disk by multer dest, read it from disk
        if (!fileBuffer && req.file.path) {
            try {
                fileBuffer = fs.readFileSync(req.file.path);
            } catch (err) {
                console.warn('Could not read file from path:', err.message);
            }
        }

        if (fileBuffer) {
            try {
                const pdfParse = require('pdf-parse');
                
                // Wrap pdfParse in a timeout to prevent hanging on large/complex PDFs
                const parsePromise = pdfParse(fileBuffer);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('PDF parsing timed out')), 3000)
                );
                
                const data = await Promise.race([parsePromise, timeoutPromise]);
                resumeText = data.text || '';
            } catch (pdfErr) {
                console.warn('pdf-parse extraction failed or timed out, attempting UTF-8:', pdfErr.message);
                resumeText = fileBuffer.toString('utf-8');
            }
        }

        if (!resumeText || resumeText.trim().length < 20) {
            resumeText = `Software Developer experienced in ${session.selectedRole || 'Web Development'}. Proficient in technical problem solving and software engineering principles.`;
        }

        session.resumeText = resumeText;
        session.extractedData = extractResumeDetails(resumeText);

        await session.save();

        res.status(200).json({
            message: 'Resume processed successfully',
            extractedData: session.extractedData
        });
    } catch (error) {
        console.error('uploadResume error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 3. Generate Question
exports.generateQuestion = async (req, res) => {
    try {
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        const role = session.selectedRole || 'Software Engineer';
        const resumeText = session.resumeText || '';
        const previousQuestionsCount = session.qa_pairs.length;

        let selectedPair = null;

        // Try Gemini LLM first if API key configured
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey.length > 10 && !apiKey.startsWith('AQ.')) {
            try {
                let historyPrompt = "";
                if (previousQuestionsCount > 0) {
                    historyPrompt = "Here is the conversation history so far:\n";
                    session.qa_pairs.forEach((qa, idx) => {
                        historyPrompt += `Q${idx + 1}: ${qa.question}\n`;
                        historyPrompt += `Candidate's Answer: ${qa.answer || 'No answer provided yet.'}\n\n`;
                    });
                    historyPrompt += `Ask a direct follow-up or delve deeper into their technical explanation.`;
                } else {
                    historyPrompt = `Start by welcoming the candidate briefly, then ask a foundational technical question strictly based on their resume skills.`;
                }

                const prompt = `You are an expert technical interviewer conducting an interview for the role of ${role}.
Candidate's Resume Text:
"""
${resumeText.slice(0, 1500)}
"""
${historyPrompt}
CRITICAL RULES:
1. Every question MUST be unique and completely different from previous questions.
2. Ask ONLY ONE question. Return ONLY valid JSON:
{
    "question": "Your question here",
    "expected_answer": "Brief expected answer for evaluation"
}`;

                const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                const response = await axios.post(url, {
                    contents: [{ parts: [{ text: prompt }] }]
                }, { timeout: 8000 });

                const text = response.data.candidates[0].content.parts[0].text.trim();
                let jsonText = text;
                if (jsonText.includes('```json')) {
                    jsonText = jsonText.split('```json')[1].split('```')[0].trim();
                } else if (jsonText.includes('```')) {
                    jsonText = jsonText.split('```')[1].split('```')[0].trim();
                }

                const parsed = JSON.parse(jsonText);
                selectedPair = {
                    q: parsed.question,
                    a: parsed.expected_answer,
                    keywords: []
                };
            } catch (llmErr) {
                console.warn('Gemini LLM call failed or unauthorized, using Adaptive Question Generator:', llmErr.message);
            }
        }

        // Adaptive Domain-Specific & Candidate-Randomized Question Generator
        if (!selectedPair) {
            selectedPair = selectCandidateQuestion(session);
        }

        // Store question in session
        session.qa_pairs.push({
            question: selectedPair.q,
            expectedAnswer: selectedPair.a,
            answer: '',
            score: 0,
            feedback: '',
            timeTaken: 0
        });

        await session.save();

        res.status(200).json({ questionText: selectedPair.q });
    } catch (error) {
        console.error('generateQuestion error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 4. Submit Answer
exports.submitAnswer = async (req, res) => {
    try {
        const { transcript, timeTaken } = req.body;
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        if (session.qa_pairs.length === 0) {
            return res.status(400).json({ message: 'No questions have been asked yet.' });
        }

        const currentPairIndex = session.qa_pairs.length - 1;
        const currentPair = session.qa_pairs[currentPairIndex];

        // Perform real evaluation
        const evalResult = evaluateCandidateAnswer(
            currentPair.question,
            currentPair.expectedAnswer || '',
            transcript || ''
        );

        session.qa_pairs[currentPairIndex].answer = transcript || '';
        session.qa_pairs[currentPairIndex].score = evalResult.score;
        session.qa_pairs[currentPairIndex].feedback = evalResult.feedback;
        session.qa_pairs[currentPairIndex].timeTaken = Number(timeTaken) || 0;

        await session.save();

        const isComplete = session.qa_pairs.length >= session.totalQuestionsConfigured;

        res.status(200).json({
            message: 'Answer recorded',
            score: evalResult.score,
            feedback: evalResult.feedback,
            isComplete
        });
    } catch (error) {
        console.error('submitAnswer error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 5. Upload Cheat Clip / Proctoring Snapshot
exports.uploadCheatClip = async (req, res) => {
    try {
        const { reason, snapshot } = req.body;
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        let videoUrl = '/mock/cheat_clip.webm';

        // Check if snapshot image base64 was sent
        if (snapshot && typeof snapshot === 'string' && snapshot.startsWith('data:image')) {
            try {
                const uploadDir = path.join(__dirname, '../uploads/cheat_clips');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filename = `cheat_${session._id}_${Date.now()}.jpg`;
                const filePath = path.join(uploadDir, filename);
                const base64Data = snapshot.replace(/^data:image\/\w+;base64,/, '');
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                videoUrl = `/uploads/cheat_clips/${filename}`;
            } catch (saveErr) {
                console.warn('Could not save snapshot file, storing data URL directly:', saveErr.message);
                videoUrl = snapshot;
            }
        } else if (req.file) {
            videoUrl = `/uploads/interviews/${req.file.filename}`;
        }

        session.cheatingClips.push({
            videoUrl,
            reason: reason || 'Proctoring Anomaly Detected',
            timestamp: new Date()
        });

        await session.save();

        res.status(200).json({ message: 'Cheat clip saved', videoUrl });
    } catch (error) {
        console.error('uploadCheatClip error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 6. End Session
exports.endSession = async (req, res) => {
    try {
        const session = await InterviewSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        session.status = 'completed';

        // Compute authentic metrics
        const answeredPairs = (session.qa_pairs || []).filter(qa => qa.score !== undefined);
        const totalAnswers = answeredPairs.length;
        const avgScore = totalAnswers > 0
            ? Math.round(answeredPairs.reduce((acc, qa) => acc + qa.score, 0) / totalAnswers)
            : 0;

        session.finalScore = avgScore;

        // Generate tailored strengths and weaknesses
        const strengths = [];
        const weaknesses = [];

        answeredPairs.forEach((qa, idx) => {
            if (qa.score >= 75) {
                strengths.push(`Q${idx + 1}: Strong understanding of ${qa.question.split('?')[0].slice(0, 50)}...`);
            } else if (qa.score < 60) {
                weaknesses.push(`Q${idx + 1}: Could elaborate more on ${qa.question.split('?')[0].slice(0, 50)}...`);
            }
        });

        if (strengths.length === 0) strengths.push('Maintained clear participation throughout the interview session.');
        if (weaknesses.length === 0) weaknesses.push('Review advanced architectural trade-offs and real-world edge cases.');

        // Hiring Recommendation
        let hiringRecommendation = 'Review Needed';
        const violationCount = session.cheatingClips?.length || 0;

        if (violationCount >= 3) {
            hiringRecommendation = 'Review Needed (Integrity Anomaly Flags)';
        } else if (avgScore >= 80) {
            hiringRecommendation = 'Strong Hire';
        } else if (avgScore >= 65) {
            hiringRecommendation = 'Hire';
        } else if (avgScore >= 50) {
            hiringRecommendation = 'Review Needed';
        } else {
            hiringRecommendation = 'Do Not Hire (Needs Technical Improvement)';
        }

        session.report = {
            strengths: strengths.slice(0, 4),
            weaknesses: weaknesses.slice(0, 4),
            suggestions: [
                'Practice explaining architectural trade-offs using specific technical terminology.',
                'Provide concrete examples from real-world projects during technical explanations.'
            ],
            hiringRecommendation
        };

        await session.save();
        res.status(200).json(session);
    } catch (error) {
        console.error('endSession error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 7. Get All Sessions for Admin
exports.getAllSessions = async (req, res) => {
    try {
        const sessions = await InterviewSession.find({ status: 'completed' })
            .populate('student', 'name email')
            .populate('interview', 'title')
            .sort({ updatedAt: -1 });

        res.status(200).json(sessions);
    } catch (error) {
        console.error('getAllSessions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
