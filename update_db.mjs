import fs from 'fs';

const rawData = fs.readFileSync('rizz_fixed.txt', 'utf8');

const CATEGORIES = [
    { id: 'purpose', label: '🎯 Purpose & Mission', icon: '🎯' },
    { id: 'mental', label: '🧠 Mental Health', icon: '🧠' },
    { id: 'fatherhood', label: '👨‍👦 Fatherhood & Family', icon: '👨‍👦' },
    { id: 'alpha', label: '🛡️ Alpha Mindset', icon: '🛡️' },
    { id: 'attraction', label: '🔥 Attraction & Seduction', icon: '🔥' },
    { id: 'dating', label: '📱 Dating Strategy', icon: '📱' },
    { id: 'breakups', label: '💔 Breakups & Exes', icon: '💔' },
    { id: 'relationships', label: '💍 Relationships', icon: '💍' },
    { id: 'social', label: '🤝 Social Life & Respect', icon: '🤝' },
    { id: 'sacrifice', label: '⚔️ Heroism & Sacrifice', icon: '⚔️' },
    { id: 'finance', label: '💰 Finance & Wealth', icon: '💰' },
    { id: 'health', label: '💪 Health & Self-Mastery', icon: '💪' },
    { id: 'rizz', label: '🔥 Pure Rizz', icon: '🔥' }
];

const POPULAR_QUESTIONS = [
    "I feel lost. I have no direction in life.",
    "Why do women immediately say 'I have a boyfriend' when I approach?",
    "How do I build a masculine frame?",
    "She ghosted me; what do I do?",
    "How do I find my purpose in life?",
    "How do I stop being needy with women?",
    "What does it mean to be an alpha male?",
    "How do I build confidence?",
    "Why should I never give a woman a compliment in the first 5 minutes?",
    "How do I escape the 'Friend Zone' immediately?"
];

const db = [];

function normalize(q) {
    return q.toLowerCase().trim().replace(/[?.!,]/g, '').replace(/\s+/g, ' ');
}

function addEntry(entry) {
    if (!entry.question) return;
    const qNorm = normalize(entry.question);

    // Try to find a very similar question (fuzzy match)
    let existingIndex = db.findIndex(e => normalize(e.question) === qNorm);

    if (existingIndex === -1) {
        // Try partial match for "Heroic Intelligence" etc.
        existingIndex = db.findIndex(e => {
            const eNorm = normalize(e.question);
            return (eNorm.includes(qNorm) || qNorm.includes(eNorm)) && (eNorm.length > 10);
        });
    }

    if (existingIndex !== -1) {
        // Merge
        for (const key in entry) {
            if (entry[key] !== undefined && entry[key] !== null) {
                const isPlaceholder = (val) => typeof val === 'string' && val.includes('processed...');
                if (!isPlaceholder(entry[key]) || isPlaceholder(db[existingIndex][key])) {
                    // If it's the question itself, only update if the new one is "better" (longer or has more keywords)
                    if (key === 'question') {
                        if (entry.question.length > db[existingIndex].question.length) {
                            db[existingIndex].question = entry.question;
                        }
                    } else {
                        db[existingIndex][key] = entry[key];
                    }
                }
            }
        }
    } else {
        db.push(entry);
    }
}

// 1. Parse Directory (Section I)
const section1 = rawData.split('II. THE PURE RIZZ SECTION')[0];
let currentCat = 'purpose';
section1.split('\n').forEach(line => {
    const catMatch = line.match(/(🎯|🧠|👨‍👦|🛡️|🔥|📱|💔|💍|🤝|⚔️|💰|💪)\s+([A-Z\s&]+)/);
    if (catMatch) {
        const label = catMatch[2].trim();
        const catObj = CATEGORIES.find(c => c.label.toUpperCase().includes(label));
        if (catObj) currentCat = catObj.id;
    }
    const qMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (qMatch) {
        const q = qMatch[2].trim();
        addEntry({
            id: `gen_${qMatch[1]}`,
            category: currentCat,
            question: q,
            keywords: q.toLowerCase().replace(/[?.!,]/g, '').split(' ').filter(k => k.length > 3),
            truth: "The Truth is being processed...",
            insight: "Deep Insight is being processed...",
            action: ["Audit situation.", "Identify obstacle.", "Take action.", "Remove distraction.", "Review mission."],
            solution: "The full solution involves a total re-ordering of your realm.",
            biblical: "Proverbs 27:17 - 'Iron sharpens iron...'",
            book1: { title: "The Boy Crisis", url: "https://www.amazon.com/Boy-Crisis-Sons-Failing-About/dp/1942952716" },
            book2: { title: "No More Mr. Nice Guy", url: "https://www.amazon.com/No-More-Mr-Nice-Guy/dp/0762415339" },
            yt1: { title: "Alpha Male Strategies", url: "https://www.youtube.com/@AlphaMaleStrategiesAMS" },
            yt2: { title: "Playing With Fire", url: "https://www.youtube.com/@PlayingWithFire" }
        });
    }
});

// 2. Parse Comprehensive Sections
const truthIndices = [];
let pos = 0;
while ((pos = rawData.indexOf('THE TRUTH', pos)) !== -1) {
    truthIndices.push(pos);
    pos += 9;
}

truthIndices.forEach((index, i) => {
    const nextIndex = truthIndices[i + 1] || rawData.length;
    const block = rawData.substring(index, nextIndex);

    const prevText = rawData.substring(Math.max(0, index - 500), index);
    const qMatch = prevText.match(/(?:RIZZ\s+\d+\.|^\d+\.\s+)(.*?)$/m);
    if (!qMatch) return;

    const question = qMatch[1].trim();

    const truth = block.match(/THE TRUTH\s+([\s\S]*?)(?=DEEP INSIGHT|$)/)?.[1]?.trim();
    const insight = block.match(/DEEP INSIGHT\s+([\s\S]*?)(?=IMMEDIATE ACTION|$)/)?.[1]?.trim();
    const actionText = block.match(/IMMEDIATE ACTION\s+([\s\S]*?)(?=FULL SOLUTION|$)/)?.[1]?.trim();
    const solution = block.match(/FULL SOLUTION\s+([\s\S]*?)(?=Alpha Filter|$|\[Biblical View\])/)?.[1]?.trim();
    const biblical = block.match(/\[Biblical View\](?:\s*\(Button\))?:\s+([\s\S]*?)(?=Resources:|$)/)?.[1]?.trim();

    const resourcesBlock = block.match(/Resources:([\s\S]*?)(?=\n(?:RIZZ\s+\d+\.|^\d+\.\s+)|$)/)?.[1];
    let book1, book2, yt1, yt2;

    if (resourcesBlock) {
        const extractLinks = (text) => {
            const matches = [...text.matchAll(/(.*?)\s*\((https?:\/\/\S+)\)/g)];
            return matches.map(m => ({
                title: m[1].trim().replace(/^•\s*/, '').replace(/^Books?:\s*/, '').replace(/^YTs?:\s*/, '').replace(/^Book\s+\d+:\s*/, '').replace(/^YT\s+\d+:\s*/, '').replace(/^,\s*/, '').replace(/^-\s*/, '').trim(),
                url: m[2].trim().replace(/\)$/, '')
            }));
        };

        const links = extractLinks(resourcesBlock);
        const bookLinks = links.filter(l => l.url.includes('amazon') || l.url.includes('a.co') || l.title.toLowerCase().includes('book'));
        const ytLinks = links.filter(l => l.url.includes('youtube') || l.url.includes('youtu.be') || l.title.toLowerCase().includes('yt'));

        if (bookLinks[0]) book1 = bookLinks[0];
        if (bookLinks[1]) book2 = bookLinks[1];
        if (ytLinks[0]) yt1 = ytLinks[0];
        if (ytLinks[1]) yt2 = ytLinks[1];
    }

    addEntry({
        question: question,
        category: prevText.includes('RIZZ') ? 'rizz' : undefined,
        truth,
        insight,
        action: actionText ? actionText.split('\n').map(l => l.trim()).filter(l => l.length > 5).map(l => l.replace(/^\d+\.\s*|^- \s*/, '').trim()) : undefined,
        solution,
        biblical,
        book1, book2, yt1, yt2
    });
});

// Final cleanup
db.forEach(e => {
    if (!e.action || e.action.length === 0) {
        e.action = ["Audit situation.", "Identify obstacle.", "Take action.", "Remove distraction.", "Review mission."];
    }
    // If category is still undefined, try to find it from another entry with similar question
    if (!e.category) {
        const qNorm = normalize(e.question);
        const match = db.find(other => other.category && (normalize(other.question).includes(qNorm) || qNorm.includes(normalize(other.question))));
        if (match) e.category = match.category;
        else e.category = 'alpha'; // Fallback
    }
    e.keywords = [...new Set([...(e.keywords || []), ...e.question.toLowerCase().replace(/[?.!,]/g, '').split(' ')])].filter(k => k.length > 3);
});

const content = `export const CATEGORIES = ${JSON.stringify(CATEGORIES, null, 4)};

export const QA_DATABASE = ${JSON.stringify(db, null, 4)};

export const POPULAR_QUESTIONS = ${JSON.stringify(POPULAR_QUESTIONS, null, 4)};
`;

fs.writeFileSync('questions.js', content);
console.log(`questions.js updated with ${db.length} questions.`);
