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
const FREE_WIDGET_LIMIT = 1;
const LIFETIME_WIDGET_LIMIT = Math.max(1, Math.min(Number(process.env.LIFETIME_WIDGET_LIMIT) || 3, 12));

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
  const match = raw.match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=]+)$/i);
  if (match) {
    if (raw.length > maxLength) return "";
    try {
      const bytes = Buffer.from(match[2], "base64");
      const type = match[1].toLowerCase();
      const isPng = type === "png" && bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      const isJpeg = (type === "jpg" || type === "jpeg") && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isWebp = type === "webp" && bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
      return isPng || isJpeg || isWebp ? raw : "";
    } catch {
      return "";
    }
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
  if (clean.categoryId !== undefined && clean.categoryId !== null && clean.categoryId !== "") {
    clean.categoryId = String(clean.categoryId).toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(clean.categoryId)) throw invalid();
  } else if (clean.categoryId === "") clean.categoryId = null;
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

  const widgets = Array.isArray(state.profile.dashboardWidgets) ? state.profile.dashboardWidgets : [];
  const previousWidgets = Array.isArray(previousState?.profile?.dashboardWidgets) ? previousState.profile.dashboardWidgets : [];
  const widgetLimit = lifetime ? LIFETIME_WIDGET_LIMIT : Math.max(FREE_WIDGET_LIMIT, previousWidgets.length);
  if (widgets.length > widgetLimit) throw invalid("PLAN_LIMIT");
  const seenWidgets = new Set();
  state.profile.dashboardWidgets = widgets.map((widget, index) => {
    if (!widget || typeof widget !== "object" || Array.isArray(widget)) throw invalid();
    const type = widget.type === "task" ? "task" : widget.type === "habit" ? "habit" : "";
    const recordId = String(widget.recordId || "").slice(0, 128);
    const source = type === "task" ? state.tasks : type === "habit" ? state.habits : [];
    const previousSource = type === "task" ? previousState?.tasks : type === "habit" ? previousState?.habits : [];
    const existedBefore = Array.isArray(previousSource) && previousSource.some((record) => String(record?.id) === recordId) && previousWidgets.some((previous) => previous?.type === type && String(previous?.recordId) === recordId);
    if (!type || !/^[a-z0-9:_-]+$/i.test(recordId) || (!source.some((record) => record.id === recordId) && !existedBefore)) throw invalid("WIDGET_RECORD_INVALID");
    const signature = `${type}:${recordId}`;
    if (seenWidgets.has(signature)) throw invalid("WIDGET_DUPLICATE");
    seenWidgets.add(signature);
    return { id: String(widget.id || signature).slice(0, 128), type, recordId, position: index };
  });

  const rawIdeaMap = state.profile.ideaMap && typeof state.profile.ideaMap === "object" && !Array.isArray(state.profile.ideaMap) ? state.profile.ideaMap : {};
  const noteIds = new Set(state.notes.map((note) => String(note.id)));
  const themes = new Set(["free", "blackhole", "earth", "brain"]);
  const theme = themes.has(rawIdeaMap.theme) ? rawIdeaMap.theme : "free";
  const connections = Array.isArray(rawIdeaMap.connections) ? rawIdeaMap.connections : [];
  if (connections.length > 10_000) throw invalid("STATE_LIMIT");
  const connectionKeys = new Set();
  const cleanConnections = connections.map((connection) => {
    const sourceId = String(connection?.sourceId || ""), targetId = String(connection?.targetId || "");
    if (!noteIds.has(sourceId) || !noteIds.has(targetId) || sourceId === targetId) throw invalid("IDEA_CONNECTION_INVALID");
    const key = [sourceId, targetId].sort().join(":");
    if (connectionKeys.has(key)) throw invalid("IDEA_CONNECTION_DUPLICATE");
    connectionKeys.add(key);
    return { id: String(connection?.id || key).slice(0, 128), sourceId, targetId };
  });
  const positions = Object.create(null), rawPositions = rawIdeaMap.positions && typeof rawIdeaMap.positions === "object" ? rawIdeaMap.positions : {};
  for (const currentTheme of themes) {
    const source = rawPositions[currentTheme] && typeof rawPositions[currentTheme] === "object" ? rawPositions[currentTheme] : {};
    const cleanTheme = Object.create(null);
    for (const [noteId, position] of Object.entries(source)) {
      if (!noteIds.has(noteId) || !position || typeof position !== "object") continue;
      const x = Number(position.x), y = Number(position.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 100_000 || Math.abs(y) > 100_000) throw invalid("IDEA_POSITION_INVALID");
      cleanTheme[noteId] = { x, y, locked: position.locked === true };
    }
    positions[currentTheme] = cleanTheme;
  }
  state.profile.ideaMap = { theme, selectedCategory: String(rawIdeaMap.selectedCategory || "all").slice(0, 128), connections: cleanConnections, positions };

  if (!lifetime) {
    const previousProfile = previousState?.profile && typeof previousState.profile === "object" ? previousState.profile : {};
    if (PREMIUM_TEMPLATES.has(String(state.profile.appearanceTemplate || ""))) {
      state.profile.appearanceTemplate = String(previousProfile.appearanceTemplate || "luar");
      state.profile.accent = String(previousProfile.accent || "#32ff7e");
    }
    state.profile.animationsEnabled = previousProfile.animationsEnabled === false ? false : true;
    state.profile.financeLineMode = previousProfile.financeLineMode === "separate" ? "separate" : "combined";
    state.profile.financeSeries = Array.isArray(previousProfile.financeSeries) ? sanitizeValue(previousProfile.financeSeries, { maxItems: 8 }) : ["combined"];
    state.profile.playlistUrl = safeHttpsUrl(previousProfile.playlistUrl);
    state.profile.dashboardCustomization = previousProfile.dashboardCustomization && typeof previousProfile.dashboardCustomization === "object" ? sanitizeValue(previousProfile.dashboardCustomization, { maxItems: 100 }) : null;
    state.profile.lifetimePreferencesMigration = previousProfile.lifetimePreferencesMigration && typeof previousProfile.lifetimePreferencesMigration === "object" ? sanitizeValue(previousProfile.lifetimePreferencesMigration) : null;
    const previousChallenges = Array.isArray(previousState?.profile?.customChallenges) ? previousState.profile.customChallenges.length : 0;
    if (Array.isArray(state.profile.customChallenges) && state.profile.customChallenges.length > previousChallenges) throw invalid("PLAN_LIMIT");
  }

  return state;
}

module.exports = { sanitizeAccountState, safeHttpsUrl, FREE_LIMITS, HARD_LIMITS, FREE_WIDGET_LIMIT, LIFETIME_WIDGET_LIMIT };
