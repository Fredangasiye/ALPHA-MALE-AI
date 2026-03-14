import { QA_DATABASE, POPULAR_QUESTIONS, CATEGORIES } from './questions.js';

// ── STATE ──────────────────────────────────────────────────────────
const STATE = {
    profile: null,
    hasAnsweredFirstQuestion: false,
    hasCompletedAssessment: false,
};

// ── DOM REFS ───────────────────────────────────────────────────────
const screens = {
    onboarding: document.getElementById('onboarding'),
    popular: document.getElementById('popular'),
    chat: document.getElementById('chat'),
    assessment: document.getElementById('assessment'),
};
const globalNav = document.getElementById('global-nav');
const onboardingForm = document.getElementById('onboarding-form');
const questionGrid = document.getElementById('question-grid');
const popularGridView = document.getElementById('popular-grid-view');
const popularAnswerView = document.getElementById('popular-answer-view');
const backToGrid = document.getElementById('back-to-grid');
const ansTruth = document.getElementById('ans-truth');
const ansInsight = document.getElementById('ans-insight');
const ansAction = document.getElementById('ans-action');
const ansSolution = document.getElementById('ans-solution');
const ansAudit = document.getElementById('ans-audit');
const relatedGrid = document.getElementById('related-grid');
const sharePopularBtn = document.getElementById('share-popular-answer');
const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const calcScoreBtn = document.getElementById('calc-score-btn');
const assessError = document.getElementById('assess-error');
const scoreResult = document.getElementById('score-result');
const assessmentForm = document.getElementById('assessment-form');
const scoreValue = document.getElementById('score-value');
const scoreTier = document.getElementById('score-tier');
const scoreMessage = document.getElementById('score-message');
const doneScoreBtn = document.getElementById('done-score-btn');

let _lastTruth = '';

// ══════════════════════════════════════════════════════════════════
// SCREEN NAVIGATION
// ══════════════════════════════════════════════════════════════════
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name]?.classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.screen === name);
    });

    // Show/hide global nav (hidden only on onboarding)
    if (name === 'onboarding') {
        globalNav.classList.add('hidden');
    } else {
        globalNav.classList.remove('hidden');
    }
}

// Nav button clicks
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.screen;
        if (target === 'popular') {
            popularAnswerView.classList.add('hidden');
            popularGridView.classList.remove('hidden');
        }
        showScreen(target);
    });
});

// ══════════════════════════════════════════════════════════════════
// FUZZY SEARCH ENGINE
// Trigram Dice Coefficient + Levenshtein for short tokens
// ══════════════════════════════════════════════════════════════════

function trigrams(str) {
    const s = ` ${str.toLowerCase()} `;
    const set = new Set();
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
    return set;
}

function diceSimilarity(a, b) {
    const ta = trigrams(a);
    const tb = trigrams(b);
    if (ta.size === 0 && tb.size === 0) return 1;
    let intersection = 0;
    for (const t of ta) if (tb.has(t)) intersection++;
    return (2 * intersection) / (ta.size + tb.size);
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
            else dp[i][j] = 1 + Math.min(
                (dp[i - 1] || [])[j] || 99,
                (dp[i][j - 1]) || 99,
                (dp[i - 1][j - 1]) || 99
            );
        }
    }
    return dp[m][n];
}

function tokenSimilarity(token, keyword) {
    if (token === keyword) return 1.0;
    if (keyword.includes(token) && token.length > 3) return 0.85;
    if (token.length > 3 && keyword.startsWith(token)) return 0.8;

    const dice = diceSimilarity(token, keyword);
    if (dice > 0.5) return dice;

    if (token.length <= 8 && keyword.length <= 8) {
        const maxLen = Math.max(token.length, keyword.length);
        const lev = levenshtein(token, keyword);
        const norm = 1 - lev / maxLen;
        return norm > 0.6 ? norm : 0;
    }
    return 0;
}

function fuzzyScore(entry, text) {
    const lowerText = text.toLowerCase().trim();
    const tokens = lowerText.split(/\s+/).filter(t => t.length > 1);
    let total = 0;

    for (const kw of entry.keywords) {
        const lowerKw = kw.toLowerCase();

        // Exact phrase match
        if (lowerText.includes(lowerKw)) { total += 20; continue; }

        // Token-level fuzzy
        let kwBest = 0;
        for (const token of tokens) {
            const sim = tokenSimilarity(token, lowerKw);
            if (sim > kwBest) kwBest = sim;
        }

        // Full-text dice vs keyword
        const fullDice = diceSimilarity(lowerText, lowerKw);
        if (fullDice > kwBest) kwBest = fullDice;

        if (kwBest > 0.6) total += kwBest * 10;
    }
    return total;
}

function findBestMatch(text) {
    if (!text || !text.trim()) return null;
    const lowerText = text.toLowerCase().trim().replace(/[?.!,]/g, '');

    // 1. Try exact question match first
    for (const entry of QA_DATABASE) {
        const q = entry.question.toLowerCase().trim().replace(/[?.!,]/g, '');
        if (q === lowerText) return entry;
    }

    // 2. Fallback to fuzzy scoring
    let best = null, bestScore = 0;
    for (const entry of QA_DATABASE) {
        const s = fuzzyScore(entry, text);
        if (s > bestScore) { bestScore = s; best = entry; }
    }
    return bestScore >= 6 ? best : null;
}

// ══════════════════════════════════════════════════════════════════
// AUDIT MESSAGE FROM PURPOSE SCORE
// ══════════════════════════════════════════════════════════════════
function generateAudit(purposeLevel) {
    const lvl = parseInt(purposeLevel || 5);
    if (lvl <= 3) return "— Alpha Filter: You are in a purpose void. The principles above only work for a man who has a mission to return to.";
    if (lvl <= 6) return "— Alpha Filter: Your mission is forming. Apply these principles daily and your clarity will grow.";
    return "— Alpha Filter: You are operating from a foundation of purpose. These principles amplify what you already have.";
}

// ══════════════════════════════════════════════════════════════════
// SHARE CARD
// ══════════════════════════════════════════════════════════════════
function buildShareCard(truth) {
    const canvas = document.getElementById('share-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1080; canvas.height = 1920;
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 20;
    ctx.strokeRect(40, 40, 1000, 1840);
    ctx.fillStyle = '#D4AF37'; ctx.font = 'bold 80px Inter';
    ctx.textAlign = 'center'; ctx.fillText('THE TRUTH', 540, 380);
    ctx.fillStyle = '#FFFFFF'; ctx.font = '52px Inter';
    const words = truth.split(' '); let line = '', y = 720;
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > 900 && line) {
            ctx.fillText(line.trim(), 540, y); line = word + ' '; y += 85;
        } else line = test;
    }
    ctx.fillText(line.trim(), 540, y);
    ctx.fillStyle = '#7F8C8D'; ctx.font = '36px Inter';
    ctx.fillText('ALPHA MALE AI', 540, 1750);
    const link = document.createElement('a');
    link.download = 'the-truth.png'; link.href = canvas.toDataURL(); link.click();
}
window.buildShareCard = buildShareCard;

// ══════════════════════════════════════════════════════════════════
// POST-QUESTION ASSESSMENT PROMPT
// Called once after the user answers their first question
// ══════════════════════════════════════════════════════════════════
function maybePromptAssessment() {
    if (STATE.hasAnsweredFirstQuestion && !STATE.hasCompletedAssessment) {
        // Show nav badge on MY SCORE button
        const assessBtn = document.getElementById('nav-assess');
        if (assessBtn && !assessBtn.querySelector('.nav-badge')) {
            const badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.textContent = '!';
            assessBtn.appendChild(badge);
        }
        // In chat: append a soft prompt message
        if (screens.chat.classList.contains('active')) {
            const div = document.createElement('div');
            div.className = 'message ai assess-prompt-msg';
            div.innerHTML = `<p class="truth" style="color:var(--gold)">📊 TAP "MY SCORE" IN THE NAV TO TAKE YOUR PURPOSE ASSESSMENT</p>
      <p class="insight">Your purpose score shapes the Alpha Filter on every answer. It takes 2 minutes.</p>`;
            chatHistory.appendChild(div);
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }
}

// ══════════════════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════════════════
onboardingForm?.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(onboardingForm);
    STATE.profile = {
        age: fd.get('age'),
        income: fd.get('income'),
        dating_intent: fd.get('dating_intent'),
        relationship_frame: fd.get('relationship_frame'),
        fatherhood_context: fd.get('fatherhood_context'),
        purpose_level: 5,
    };
    localStorage.setItem('alpha_profile', JSON.stringify(STATE.profile));
    buildPopularQuestions();
    showScreen('popular');
});

// ══════════════════════════════════════════════════════════════════
// POPULAR QUESTIONS
// ══════════════════════════════════════════════════════════════════
function buildPopularQuestions() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';

    // ── TOP 10 CARD ──────────────────────────────────────────────
    const top10Card = document.createElement('div');
    top10Card.className = 'section-card top10-card';
    top10Card.innerHTML = `
        <div class="section-card-header static-header">
            <span class="section-icon">⚡</span>
            <div>
                <p class="section-title">MOST ASKED QUESTIONS</p>
                <p class="section-count">${POPULAR_QUESTIONS.length} questions</p>
            </div>
        </div>
        <div class="section-question-list" id="top10-list">
            ${POPULAR_QUESTIONS.map((q, i) => `
                <button class="section-q-btn" data-question="${q.replace(/"/g, '&quot;')}">
                    <span class="q-num">${String(i + 1).padStart(2, '0')}</span>
                    <span>${q}</span>
                </button>`).join('')}
        </div>
    `;
    grid.appendChild(top10Card);

    // ── CATEGORY CARDS ────────────────────────────────────────────
    CATEGORIES.forEach(cat => {
        const entries = QA_DATABASE.filter(e => e.category === cat.id);
        if (!entries.length) return;

        const card = document.createElement('div');
        card.className = 'section-card category-card';
        card.innerHTML = `
            <button class="section-card-header section-card-toggle" data-cat="${cat.id}">
                <span class="section-icon">${cat.icon}</span>
                <div>
                    <p class="section-title">${cat.label}</p>
                    <p class="section-count">${entries.length} question${entries.length !== 1 ? 's' : ''}</p>
                </div>
                <span class="toggle-arrow">▾</span>
            </button>
            <div class="section-question-list collapsed" id="cat-${cat.id}">
                ${entries.map((e, i) => `
                    <button class="section-q-btn" data-question="${e.question.replace(/"/g, '&quot;')}">
                        <span class="q-num">${String(i + 1).padStart(2, '0')}</span>
                        <span>${e.question}</span>
                    </button>`).join('')}
            </div>
        `;
        grid.appendChild(card);
    });

    // Collapse/expand toggles
    grid.querySelectorAll('.section-card-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const list = document.getElementById(`cat-${btn.dataset.cat}`);
            const arrow = btn.querySelector('.toggle-arrow');
            const isOpen = !list.classList.contains('collapsed');
            list.classList.toggle('collapsed', isOpen);
            arrow.textContent = isOpen ? '▾' : '▴';
        });
    });

    // Question click — both Top 10 and category lists
    grid.querySelectorAll('.section-q-btn').forEach(btn => {
        btn.addEventListener('click', () => showAnswer(btn.dataset.question));
    });
}

function showAnswer(questionText, entryOverride) {
    const match = entryOverride || findBestMatch(questionText);
    const audit = generateAudit(STATE.profile?.purpose_level);

    const response = match || {
        truth: "Be more specific. Use words like: 'ghosted', 'depressed', 'alpha', 'purpose', 'father', 'breakup'.",
        insight: "The Alpha AI searches your words against a knowledge base built from The Boy Crisis and Alpha Male Strategies.",
        action: "Rephrase and try again, or browse the topic tiles for the area closest to your question.",
        solution: "The more precise your language, the more targeted the answer.",
        related: [],
    };

    ansTruth.textContent = response.truth;
    ansInsight.textContent = response.insight;
    ansAction.textContent = response.action;
    ansSolution.textContent = response.solution;
    ansAudit.textContent = audit;
    _lastTruth = response.truth;

    // Build related questions
    relatedGrid.innerHTML = '';
    if (response.related && response.related.length > 0) {
        response.related.forEach(rq => {
            const btn = document.createElement('button');
            btn.className = 'related-tile';
            btn.textContent = rq;
            btn.addEventListener('click', () => showAnswer(rq));
            relatedGrid.appendChild(btn);
        });
        document.getElementById('related-section').classList.remove('hidden');
    } else {
        document.getElementById('related-section').classList.add('hidden');
    }

    popularGridView.classList.add('hidden');
    popularAnswerView.classList.remove('hidden');

    // Track first question answered
    if (!STATE.hasAnsweredFirstQuestion) {
        STATE.hasAnsweredFirstQuestion = true;
        maybePromptAssessment();
    }
}

backToGrid?.addEventListener('click', () => {
    popularAnswerView.classList.add('hidden');
    popularGridView.classList.remove('hidden');
});

sharePopularBtn?.addEventListener('click', () => buildShareCard(_lastTruth));

// ══════════════════════════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════════════════════════
function addMessage(type, content) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    if (type === 'ai') {
        const safeT = (content.truth || '').replace(/'/g, "\\'");
        div.innerHTML = `
      <p class="truth">THE TRUTH: ${content.truth}</p>
      <p class="insight"><strong>INSIGHT:</strong> ${content.insight}</p>
      <p class="action"><strong>ACTION:</strong> ${content.action}</p>
      <p class="solution"><strong>FULL SOLUTION:</strong> ${content.solution}</p>
      <p class="audit">${content.audit}</p>
      ${content.related && content.related.length
                ? `<div class="chat-related">
             <p class="chat-related-label">EXPLORE FURTHER</p>
             ${content.related.map(rq => `<button class="chat-related-btn" onclick="window.askRelated('${rq.replace(/'/g, "\\'")}')">${rq}</button>`).join('')}
           </div>`
                : ''}
      <button class="btn-share" onclick="window.buildShareCard('${safeT}')">SHARE THE TRUTH</button>
    `;
    } else {
        div.innerHTML = `<p>${content}</p>`;
    }
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

window.askRelated = function (question) {
    addMessage('user', question);
    setTimeout(() => {
        const match = findBestMatch(question);
        const audit = generateAudit(STATE.profile?.purpose_level);
        if (match) addMessage('ai', { ...match, audit });
        else addMessage('ai', genericFallback(audit));
    }, 300);
};

function genericFallback(audit) {
    return {
        truth: "Try a more specific term — 'depressed', 'ghosted', 'purpose', 'alpha', 'father', 'breakup', 'porn', 'confident', 'finance'.",
        insight: "The Alpha AI knowledge base is built from The Boy Crisis and Alpha Male Strategies. The closer your words match a topic in those books, the sharper the answer.",
        action: "Browse the TOPICS screen to find the closest matching question and start there.",
        solution: "Use the related questions at the bottom of each answer to navigate the full knowledge base.",
        related: [],
        audit,
    };
}

function processInput() {
    const text = userInput.value.trim();
    if (!text) return;
    userInput.value = '';
    addMessage('user', text);

    setTimeout(() => {
        const match = findBestMatch(text);
        const audit = generateAudit(STATE.profile?.purpose_level);
        if (match) addMessage('ai', { ...match, audit });
        else addMessage('ai', genericFallback(audit));

        // Track first question + prompt assessment
        if (!STATE.hasAnsweredFirstQuestion) {
            STATE.hasAnsweredFirstQuestion = true;
            maybePromptAssessment();
        }
    }, 400);
}

sendBtn?.addEventListener('click', processInput);
userInput?.addEventListener('keypress', e => { if (e.key === 'Enter') processInput(); });

// ══════════════════════════════════════════════════════════════════
// PURPOSE ASSESSMENT
// ══════════════════════════════════════════════════════════════════
const SCORE_TIERS = [
    { max: 3, tier: 'PURPOSE VOID', message: "You have no mission anchoring you. Your mind has turned inward and is attacking itself. This is where the most dangerous spirals begin. The first step is brutal honesty: you are living without direction. Read the Purpose Void answer on the Topics screen." },
    { max: 5, tier: 'EARLY FOUNDATION', message: "You have glimpsing moments of clarity but no consistent mission. You are capable of more than you're currently doing. The seeds are there — they need daily watering. Commit to one hour of purpose work every morning." },
    { max: 7, tier: 'MISSION FORMING', message: "You are building. There is direction but the foundation still needs reinforcing. You have passed the hardest part — starting. Now it's about consistency and removing the remaining distractions." },
    { max: 9, tier: 'HIGH OPERATOR', message: "You are running at close to peak clarity. Your purpose drives your daily decisions. The challenge now is to sustain this through adversity and avoid the complacency trap that takes men at the peak." },
    { max: 10, tier: 'APEX MISSION', message: "You are aligned. Your inner world and outer actions are in sync. The only remaining task is execution at the highest level and bringing other men up with you. You are the role model." },
];

calcScoreBtn?.addEventListener('click', () => {
    const answers = ['q1', 'q2', 'q3', 'q4', 'q5'].map(name => {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? parseInt(el.value) : null;
    });

    if (answers.includes(null)) {
        assessError.classList.remove('hidden');
        return;
    }
    assessError.classList.add('hidden');

    const raw = answers.reduce((a, b) => a + b, 0); // 5–15
    const purposeLevel = Math.round(((raw - 5) / 10) * 9) + 1; // Scale 1–10
    STATE.profile.purpose_level = purposeLevel;
    STATE.hasCompletedAssessment = true;
    localStorage.setItem('alpha_profile', JSON.stringify(STATE.profile));

    // Remove badge from nav
    const badge = document.querySelector('.nav-badge');
    if (badge) badge.remove();

    // Show result
    scoreValue.textContent = purposeLevel;
    const tier = SCORE_TIERS.find(t => purposeLevel <= t.max);
    scoreTier.textContent = tier.tier;
    scoreMessage.textContent = tier.message;

    const scoreCircle = document.getElementById('score-circle');
    if (purposeLevel <= 3) scoreCircle.style.borderColor = '#FF4B2B';
    else if (purposeLevel <= 6) scoreCircle.style.borderColor = '#D4AF37';
    else scoreCircle.style.borderColor = '#00C781';

    assessmentForm.classList.add('hidden');
    scoreResult.classList.remove('hidden');
});

doneScoreBtn?.addEventListener('click', () => {
    assessmentForm.classList.remove('hidden');
    scoreResult.classList.add('hidden');
    showScreen('popular');
    popularAnswerView.classList.add('hidden');
    popularGridView.classList.remove('hidden');
});

// ══════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════
(function init() {
    const saved = localStorage.getItem('alpha_profile');
    if (saved) {
        STATE.profile = JSON.parse(saved);
        buildPopularQuestions();
        showScreen('popular');
    } else {
        showScreen('onboarding');
    }
})();
