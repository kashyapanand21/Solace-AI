// Keyword-based classifier — fast, reliable, no extra model needed
// Perfect for hackathon demo

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Finance": [
    "invoice", "budget", "tax", "payment", "expense", "revenue",
    "profit", "loss", "financial", "salary", "cost", "billing",
    "receipt", "accounting", "fund", "investment", "cash", "quarterly",
    "payable", "balance", "audit", "fiscal", "expenditure"
  ],
  "Resume": [
    "resume", "cv", "curriculum", "vitae", "experience", "skills",
    "education", "job", "candidate", "hire", "position", "career",
    "internship", "employment", "qualification", "linkedin", "applicant"
  ],
  "Study Notes": [
    "lecture", "notes", "assignment", "homework", "exam", "study",
    "university", "college", "course", "chapter", "syllabus",
    "semester", "professor", "class", "tutorial", "subject",
    "machine", "learning", "neural", "network", "algorithm",
    "programming", "javascript", "python", "code", "software",
    "database", "computer", "science", "engineering", "research"
  ],
  "Legal": [
    "contract", "agreement", "terms", "conditions", "clause",
    "legal", "court", "jurisdiction", "liability", "party",
    "shall", "hereby", "whereas", "plaintiff", "defendant",
    "attorney", "law", "compliance", "regulation", "policy"
  ],
  "Medical": [
    "medical", "health", "doctor", "prescription", "diagnosis",
    "patient", "hospital", "treatment", "symptoms", "medicine",
    "clinical", "therapy", "disease", "surgery", "nurse",
    "pharmacy", "chronic", "acute", "healthcare", "wellness"
  ],
  "Work": [
    "meeting", "agenda", "proposal", "business", "plan",
    "office", "team", "deliverable", "deadline", "client",
    "manager", "presentation", "strategy", "quarter", "milestone",
    "stakeholder", "department", "workflow", "kpi", "objective"
  ],
  "Personal": [
    "personal", "diary", "journal", "family", "travel",
    "vacation", "hobby", "memory", "photo", "friend",
    "birthday", "holiday", "home", "weekend", "life",
    "private", "note", "reminder", "shopping", "wishlist"
  ],
};

export async function loadCategories(): Promise<void> {
  // No async work needed for keyword classifier
  // Kept async to maintain same interface as embedding-based version
  console.log('[Classifier] ✅ Ready — keyword classifier loaded instantly');
}

export async function classifyText(
  text: string
): Promise<{ label: string; confidence: number }> {
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/).filter(Boolean);

  const scores: Record<string, number> = {};

  for (const [label, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      // Exact word match scores 1, substring match scores 0.5
      if (words.includes(keyword)) score += 1;
      else if (lower.includes(keyword)) score += 0.5;
    }
    scores[label] = score;
  }

  // Find best label
  let bestLabel = 'Other';
  let bestScore = 0;

  for (const [label, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }

  // Normalize confidence to 0–1 range for display
  const confidence = bestScore > 0 ? Math.min(bestScore / 5, 1) : 0;

  return { label: bestLabel, confidence };
}