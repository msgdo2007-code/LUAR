const TOP_LEVEL_COLLECTIONS = [
  "transactions", "tasks", "habits", "goals", "subscriptions", "wishlist",
  "investments", "events", "moods", "notes", "focusSessions", "portfolioHistory",
];

const FREE_LIMITS = Object.freeze({ events: 3, habits: 4, tasks: 3, notes: 5, goals: 2 });
const HARD_LIMITS = Object.freeze({
  transactions: 5000, tasks: 5000, habits: 1000, goals: 1000,
  subscriptions: 1000, wishlist: 1000, investments: 2000, events: 5000,
  moods: 5000, notes: 3000, focusSessions: 10000, portfolioHistory: 5000,
});
const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const HTTPS_FIELDS = new Set(["link", "imageUrl"]);
const IMAGE_DATA_FIELDS = new Set(["avatar", "customBanner"]);
const PREMIUM_TEMPLATES = new Set(["halloween", "christmas", "valentines", "stpatricks", "carnival", "custom"]);

const invalid = (code = "STATE_INVALID") => {
  const error = new Error(code);
  error.publicCode = code;
  return error;
};

const safeHttpsUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href.slice(0, 2048);
  } catch {
    return "";
  }
};

const safeImage = (value, maxLength) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(raw)) {
    return raw.length <= maxLength ? raw : "";
  }
  return safeHttpsUrl(raw);
};

function sanitizeValue(value, options = {}, depth = 0, seen = new WeakSet()) {
  if (depth > 12) throw invalid();
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000_000) throw invalid();
    return value;
  }
  if (typeof value === "string") {
    const limit = Math.max(1, Math.min(Number(options.stringLimit) || 20_000, 100_000));
    if (value.length > limit || /[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw invalid();
    return value;
  }
  if (!value || typeof value !== "object" || seen.has(value)) throw invalid();
  seen.add(value);
  if (Array.isArray(value)) {
    const maxItems = Math.max(0, Math.min(Number(options.maxItems) || 10_000, 10_000));
    if (value.length > maxItems) throw invalid("STATE_LIMIT");
    return value.map((item) => sanitizeValue(item, options, depth + 1, seen));
  }
  const keys = Object.keys(value);
  if (keys.length > 250 || keys.some((key) => BLOCKED_KEYS.has(key) || key.length > 80)) throw invalid();
  const output = Object.create(null);
  for (const key of keys) {
    if (HTTPS_FIELDS.has(key)) output[key] = safeHttpsUrl(value[key]);
    else if (IMAGE_DATA_FIELDS.has(key)) output[key] = safeImage(value[key], key === "avatar" ? 160_000 : 360_000);
    else output[key] = sanitizeValue(value[key], options, depth + 1, seen);
  }
  return output;
}

const sanitizeRecord = (record) => {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw invalid();
  const clean = sanitizeValue(record, { stringLimit: 20_000 });
  if (clean.id !== undefined) {
    clean.id = String(clean.id).slice(0, 128);
    if (!/^[a-z0-9:_-]+$/i.test(clean.id)) throw invalid();
  }
  for (const key of ["name", "title", "category", "location"]) {
    if (clean[key] !== undefined && String(clean[key]).length > 180) throw invalid();
  }
  for (const key of ["description", "important", "notes", "reason", "content", "measure"]) {
    if (clean[key] !== undefined && String(clean[key]).length > (key === "content" ? 20_000 : 4_000)) throw invalid();
  }
  return clean;
};

const allowedFreeCount = (key, previousState) => {
  const configured = FREE_LIMITS[key];
  if (configured !== undefined) return Math.max(configured, Array.isArray(previousState?.[key]) ? previousState[key].length : 0);
  if (key === "wishlist") return Array.isArray(previousState?.wishlist) ? previousState.wishlist.length : 0;
  return HARD_LIMITS[key];
};

function sanitizeAccountState(value, { lifetime = false, previousState = {} } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const state = Object.create(null);
  const profile = value.profile && typeof value.profile === "object" && !Array.isArray(value.profile) ? value.profile : null;
  if (!profile) throw invalid();
  state.profile = sanitizeValue(profile, { stringLimit: 20_000, maxItems: 5000 });

  for (const key of TOP_LEVEL_COLLECTIONS) {
    const source = value[key];
    if (!Array.isArray(source)) throw invalid();
    const limit = lifetime ? HARD_LIMITS[key] : allowedFreeCount(key, previousState);
    if (source.length > limit) throw invalid("PLAN_LIMIT");
    state[key] = source.map(sanitizeRecord);
  }

  if (!lifetime) {
    if (PREMIUM_TEMPLATES.has(String(state.profile.appearanceTemplate || ""))) {
      state.profile.appearanceTemplate = "luar";
      state.profile.accent = "#32ff7e";
    }
    state.profile.animationsEnabled = true;
    state.profile.financeLineMode = "combined";
    const previousChallenges = Array.isArray(previousState?.profile?.customChallenges) ? previousState.profile.customChallenges.length : 0;
    if (Array.isArray(state.profile.customChallenges) && state.profile.customChallenges.length > previousChallenges) throw invalid("PLAN_LIMIT");
  }

  return state;
}

module.exports = { sanitizeAccountState, safeHttpsUrl, FREE_LIMITS, HARD_LIMITS };
