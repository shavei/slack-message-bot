const categories = [
  { id: "auth", terms: ["login", "auth", "password", "permission", "token", "session", "התחברות", "סיסמה", "הרשאה", "טוקן", "משתמש"] },
  { id: "database", terms: ["database", "db", "supabase", "query", "sql", "migration", "record", "דאטה", "בסיס נתונים", "שאילתה", "טבלה", "רשומה"] },
  { id: "backend", terms: ["api", "endpoint", "request", "response", "server", "500", "404", "שרת", "בקשה", "תגובה", "אנדפוינט"] },
  { id: "frontend", terms: ["button", "screen", "ui", "page", "mobile", "layout", "css", "style", "כפתור", "מסך", "עמוד", "מובייל", "עיצוב", "תצוגה"] },
  { id: "performance", terms: ["slow", "lag", "timeout", "performance", "loading", "hang", "איטי", "טעינה", "נתקע", "ביצועים"] },
  { id: "devops", terms: ["deploy", "vercel", "build", "env", "environment", "ci", "cd", "דיפלוי", "בילד", "סביבה"] }
];

export function triageIssue(issue) {
  const text = normalize(issue.description || issue.title || "");
  const category = pickCategory(text);
  const severity = pickSeverity(text);
  const vague = isVague(text);

  return {
    title: makeTitle(issue.description || issue.title || ""),
    category,
    severity: vague ? "low" : severity,
    summary: makeSummary(issue.description || issue.title || "", category, vague),
    reproductionSteps: vague ? ["לבקש מהמפתח/מדווח צעדי שחזור מדויקים", "לבדוק באיזה מסך או פעולה הבעיה מופיעה"] : stepsFor(category),
    likelyArea: likelyArea(category),
    suggestedFix: suggestedFix(category, severity, vague),
    questions: questionsFor(category, vague),
    confidence: vague ? 0.35 : confidenceFor(text, category)
  };
}

function normalize(value) {
  return String(value).toLowerCase();
}

function pickCategory(text) {
  const match = categories.find((category) => category.terms.some((term) => text.includes(term)));
  return match?.id || "general";
}

function pickSeverity(text) {
  if (has(text, ["production down", "down", "data loss", "security", "blocked", "critical", "נפל", "דאון", "אבטחה", "חסום", "איבוד מידע", "קריטי"])) return "critical";
  if (has(text, ["crash", "broken", "cannot", "can't", "failed", "error", "urgent", "קורס", "שבור", "לא מצליח", "נכשל", "שגיאה", "דחוף"])) return "high";
  if (has(text, ["bug", "issue", "wrong", "missing", "not working", "באג", "בעיה", "לא עובד", "חסר", "לא נכון"])) return "medium";
  return "low";
}

function isVague(text) {
  const cleaned = text.replace(/<@[^>]+>/g, "").trim();
  return cleaned.length < 18 || has(cleaned, ["hi", "hello", "היי", "שלום", "wassup"]);
}

function makeTitle(text) {
  const cleaned = String(text).replace(/<@[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "דיווח ללא כותרת";
  return cleaned.length > 82 ? `${cleaned.slice(0, 79)}...` : cleaned;
}

function makeSummary(text, category, vague) {
  if (vague) return "הדיווח קצר מדי בשביל אבחון אמין. כדאי לבקש פרטים לפני שמתחילים תיקון.";
  return `הדיווח מסווג כ-${label(category)}. כדאי לשחזר את הבעיה, לאסוף קונטקסט, ואז לבדוק את האזור הסביר בקוד.`;
}

function stepsFor(category) {
  const shared = ["לשחזר את הפעולה שתוארה בדיווח", "לתעד תוצאה צפויה מול תוצאה בפועל"];
  const extra = {
    auth: "לבדוק משתמש מחובר, הרשאות, סשן וטוקנים",
    database: "לבדוק שאילתות, הרשאות טבלה ומיגרציות אחרונות",
    backend: "לבדוק לוגים, סטטוסי HTTP וולידציה של הבקשה",
    frontend: "לבדוק קונסול, מצב קומפוננטות ורספונסיביות",
    performance: "למדוד זמן טעינה, בקשות חוזרות ושאילתות כבדות",
    devops: "לבדוק משתני סביבה, לוגי build והגדרות deploy",
    general: "לבקש צילום מסך, לוגים וצעדי שחזור"
  };
  return [...shared, extra[category] || extra.general];
}

function likelyArea(category) {
  return {
    auth: "Authentication / permissions",
    database: "Database / Supabase / SQL",
    backend: "API routes / server logic",
    frontend: "UI components / styling / browser state",
    performance: "Loading path / repeated requests / heavy queries",
    devops: "Deployment / environment variables / build config",
    general: "Needs clarification"
  }[category] || "Needs clarification";
}

function suggestedFix(category, severity, vague) {
  if (vague) return "לבקש דיווח מלא: מה ניסו לעשות, מה קרה בפועל, מה ציפו שיקרה, באיזה דפדפן/מסך, וצילום מסך או לוג אם יש.";
  const urgent = severity === "critical" ? "לטפל מיד: לצמצם נזק, לבדוק rollback או hotfix קטן. " : "להתחיל משחזור מבוקר. ";
  const fixes = {
    auth: "לאמת scopes, redirect URLs, תוקף session ובדיקות הרשאה בצד שרת.",
    database: "להריץ את השאילתה ידנית, לבדוק RLS/permissions, ולוודא שהסכמה תואמת לקוד.",
    backend: "לבדוק payload, validation, logs ונתיב השגיאה לפני שינוי רחב.",
    frontend: "לבדוק state, disabled states, שגיאות console ו-layout במסכים קטנים.",
    performance: "למצוא את צוואר הבקבוק לפני אופטימיזציה: network, query או render.",
    devops: "להשוות env vars בין Production/Preview, לבדוק build logs והגדרות Vercel.",
    general: "לאסוף צעדי שחזור ולקבוע בעלות לפני תיקון."
  };
  return urgent + (fixes[category] || fixes.general);
}

function questionsFor(category, vague) {
  if (vague) return ["מה היו צעדי השחזור?", "מה ציפיתם שיקרה ומה קרה בפועל?", "יש צילום מסך או הודעת שגיאה?"];
  const common = ["האם זה קורה לכל המשתמשים או רק לחלקם?"];
  const byCategory = {
    auth: ["באיזה משתמש/role זה קורה?", "האם זה התחיל אחרי שינוי בהרשאות או redirect?"],
    database: ["האם יש שינוי סכמה או מיגרציה אחרונה?", "האם יש שגיאת SQL/permission בלוגים?"],
    backend: ["איזה endpoint נכשל ומה ה-status code?", "מה ה-payload שנשלח?"],
    frontend: ["באיזה דפדפן ומסך זה קורה?", "יש שגיאות console?"],
    performance: ["כמה זמן הפעולה לוקחת?", "האם זה קורה רק עם הרבה נתונים?"],
    devops: ["האם זה Production בלבד?", "האם env vars זהים לסביבה שעובדת?"]
  };
  return [...common, ...(byCategory[category] || ["אפשר לקבל יותר קונטקסט על המקרה?"])];
}

function confidenceFor(text, category) {
  let score = category === "general" ? 0.45 : 0.65;
  if (text.length > 80) score += 0.12;
  if (has(text, ["error", "שגיאה", "500", "404", "crash", "קורס"])) score += 0.1;
  return Math.min(0.9, score);
}

function has(text, terms) {
  return terms.some((term) => text.includes(term));
}

function label(category) {
  return {
    auth: "התחברות והרשאות",
    database: "דאטה ובסיס נתונים",
    backend: "שרת ו-API",
    frontend: "ממשק משתמש",
    performance: "ביצועים",
    devops: "דיפלוי ותשתיות",
    general: "כללי"
  }[category] || "כללי";
}