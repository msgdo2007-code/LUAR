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
const DASHBOARD_BLOCKS = new Set(["widgets", "wealth", "summary", "income", "expense", "goals", "balance", "categories", "ideaMap", "routine", "calendar"]);
const DASHBOARD_THEMES = new Set(["luar", "eclipse", "nova", "aurora", "midnight", "minimal", "oled", "custom"]);

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

const dashboardText = (value, limit = 60) => String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, limit);
const dashboardColor = (value, fallback = "") => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
const dashboardEnum = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
const sanitizeDashboardBlock = (value = {}, fallbackOrder = 0) => {
  const style = value.style && typeof value.style === "object" && !Array.isArray(value.style) ? value.style : {};
  const responsive = value.responsive && typeof value.responsive === "object" && !Array.isArray(value.responsive) ? value.responsive : {};
  const sizes = ["small", "medium", "large", "xl"];
  return {
    visible: value.visible !== false,
    order: Math.max(0, Math.min(100, Number.isFinite(+value.order) ? Math.round(+value.order) : fallbackOrder)),
    size: dashboardEnum(value.size, sizes, "medium"),
    variant: dashboardEnum(value.variant, ["default", "compact", "list", "chart", "complete", "minimal", "mascot"], "default"),
    responsive: {
      desktop: dashboardEnum(responsive.desktop, sizes, dashboardEnum(value.size, sizes, "medium")),
      tablet: dashboardEnum(responsive.tablet, sizes, "medium"),
      mobile: dashboardEnum(responsive.mobile, sizes, "medium"),
    },
    style: {
      background: dashboardEnum(style.background, ["auto", "black", "surface", "transparent", "accent", "custom"], "auto"),
      backgroundColor: dashboardColor(style.backgroundColor),
      accent: dashboardColor(style.accent),
      border: dashboardEnum(style.border, ["none", "subtle", "normal", "strong"], "subtle"),
      radius: dashboardEnum(style.radius, ["small", "medium", "large"], "medium"),
      shadow: dashboardEnum(style.shadow, ["none", "soft", "glow"], "soft"),
      opacity: Math.max(40, Math.min(100, Number.isFinite(+style.opacity) ? Math.round(+style.opacity) : 100)),
    },
  };
};
const sanitizeDashboardLayout = (value, index = 0) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("CUSTOMIZATION_INVALID");
  const id = dashboardText(value.id || `layout-${index + 1}`, 48).toLowerCase().replace(/[^a-z0-9_-]/g, "-") || `layout-${index + 1}`;
  const sourceBlocks = value.blocks && typeof value.blocks === "object" && !Array.isArray(value.blocks) ? value.blocks : {};
  const blocks = Object.create(null);
  [...DASHBOARD_BLOCKS].forEach((blockId, blockIndex) => { blocks[blockId] = sanitizeDashboardBlock(sourceBlocks[blockId], blockIndex); });
  return { id, name: dashboardText(value.name || `Layout ${index + 1}`, 50), locked: value.locked === true, blocks };
};
function sanitizeDashboardCustomization(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const layoutsSource = Array.isArray(value.layouts) && value.layouts.length ? value.layouts.slice(0, 5) : [{ id: "principal", name: "Principal", blocks: value.blocks || {} }];
  const layouts = layoutsSource.map(sanitizeDashboardLayout);
  const unique = new Set();
  layouts.forEach((layout, index) => { if (unique.has(layout.id)) layout.id = `${layout.id}-${index + 1}`; unique.add(layout.id); });
  const theme = value.globalTheme && typeof value.globalTheme === "object" ? value.globalTheme : {};
  const background = value.background && typeof value.background === "object" ? value.background : {};
  const sidebar = value.sidebar && typeof value.sidebar === "object" ? value.sidebar : {};
  const header = value.header && typeof value.header === "object" ? value.header : {};
  const allowedNavigation = ["dashboard", "today", "finance", "tasks", "habits", "calendar", "goals", "focus", "mood", "notes", "challenges", "reports", "profile"];
  const cleanNavigation = (items, limit = allowedNavigation.length) => Array.isArray(items) ? [...new Set(items.filter((item) => allowedNavigation.includes(item)))].slice(0, limit) : [];
  const history = Array.isArray(value.history) ? value.history.slice(0, 5).map((entry, index) => ({ savedAt: Number.isFinite(Date.parse(entry?.savedAt)) ? new Date(entry.savedAt).toISOString() : new Date(0).toISOString(), layoutId: dashboardText(entry?.layoutId, 48), layout: sanitizeDashboardLayout(entry?.layout || layouts[0], index) })) : [];
  const activeLayoutId = layouts.some((layout) => layout.id === value.activeLayoutId) ? value.activeLayoutId : layouts[0].id;
  return {
    version: 2,
    activeLayoutId,
    autosave: value.autosave === true,
    density: dashboardEnum(value.density, ["compact", "comfortable", "airy"], "comfortable"),
    globalTheme: { preset: DASHBOARD_THEMES.has(theme.preset) ? theme.preset : "luar", background: dashboardColor(theme.background, "#050807"), cards: dashboardColor(theme.cards, "#101311"), accent: dashboardColor(theme.accent, "#25f47d"), text: dashboardColor(theme.text, "#f5f7f5"), muted: dashboardColor(theme.muted, "#7e8882"), borders: dashboardColor(theme.borders, "#232a25"), glow: Math.max(0, Math.min(100, +theme.glow || 30)), blur: Math.max(0, Math.min(30, +theme.blur || 8)), contrast: Math.max(80, Math.min(130, +theme.contrast || 100)), radius: Math.max(6, Math.min(28, +theme.radius || 16)) },
    background: { type: dashboardEnum(background.type, ["solid", "gradient", "image", "grid", "stars", "orbits", "none"], "none"), preset: dashboardEnum(background.preset, ["orbit", "nebula", "eclipse", "constellation", "void", "custom"], "void"), color: dashboardColor(background.color, "#050807"), color2: dashboardColor(background.color2, "#102018"), image: safeImage(background.image, 360_000), fit: dashboardEnum(background.fit, ["cover", "contain", "center"], "cover"), blur: Math.max(0, Math.min(24, +background.blur || 0)), dim: Math.max(0, Math.min(90, +background.dim || 35)), opacity: Math.max(10, Math.min(100, +background.opacity || 100)) },
    sidebar: { size: dashboardEnum(sidebar.size, ["compact", "normal", "large"], "normal"), labels: dashboardEnum(sidebar.labels, ["icons", "both"], "both"), order: cleanNavigation(sidebar.order), hidden: cleanNavigation(sidebar.hidden) },
    header: { showName: header.showName !== false, showGreeting: header.showGreeting !== false, showQuote: header.showQuote === true, showDate: header.showDate === true, showLevel: header.showLevel !== false, showAvatar: header.showAvatar !== false, customText: dashboardText(header.customText, 100) },
    shortcuts: cleanNavigation(value.shortcuts, 6),
    layouts,
    history,
  };
}

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
  const rawDashboardCustomization = profile.dashboardCustomization;
  const profileWithoutCustomization = { ...profile };
  delete profileWithoutCustomization.dashboardCustomization;
  state.profile = sanitizeValue(profileWithoutCustomization, { stringLimit: 20_000, maxItems: 5000 });

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
    const dailyHabitSummary = type === "habit" && recordId === "all";
    if (!type || !/^[a-z0-9:_-]+$/i.test(recordId) || (!dailyHabitSummary && !source.some((record) => record.id === recordId) && !existedBefore)) throw invalid("WIDGET_RECORD_INVALID");
    const signature = `${type}:${recordId}`;
    if (seenWidgets.has(signature)) throw invalid("WIDGET_DUPLICATE");
    seenWidgets.add(signature);
    const sizes = new Set(["small", "medium", "large"]), mascots = new Set(["lumi", "eclipse", "nova", "void"]), backgrounds = new Set(["green", "black", "violet"]);
    return { id: String(widget.id || signature).slice(0, 128), type, recordId, position: index, size: sizes.has(widget.size) ? widget.size : "small", mascotId: mascots.has(widget.mascotId) ? widget.mascotId : "lumi", phrase: String(widget.phrase || "dynamic").slice(0, 120), style: "lunar", background: backgrounds.has(widget.background) ? widget.background : "green", showStreak: widget.showStreak !== false, showXP: widget.showXP !== false, showProgress: widget.showProgress !== false, showHabitList: widget.showHabitList !== false };
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

  if (lifetime) state.profile.dashboardCustomization = sanitizeDashboardCustomization(rawDashboardCustomization);

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

module.exports = { sanitizeAccountState, sanitizeDashboardCustomization, safeHttpsUrl, FREE_LIMITS, HARD_LIMITS, FREE_WIDGET_LIMIT, LIFETIME_WIDGET_LIMIT };
