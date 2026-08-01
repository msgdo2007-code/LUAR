(function () {
  'use strict';

  const DAY_MS = 86400000;
  const STAGES = Object.freeze([
    { id: 'moon', name: 'Lua', min: 1, max: 9, icon: '☾', color: '#b9c3d1', description: 'O primeiro corpo da sua jornada.' },
    { id: 'planet', name: 'Planeta', min: 10, max: 14, icon: '◉', color: '#67d6ff', description: 'Sua rotina ganhou gravidade e constância.' },
    { id: 'solar-system', name: 'Sistema Solar', min: 15, max: 19, icon: '☀', color: '#ffd463', description: 'Várias áreas da vida avançam na mesma órbita.' },
    { id: 'galaxy', name: 'Galáxia', min: 20, max: 24, icon: '✶', color: '#b68cff', description: 'Seu progresso forma uma galáxia particular.' },
    { id: 'nebula', name: 'Nebulosa', min: 25, max: 29, icon: '✦', color: '#ff79c6', description: 'Disciplina e criatividade criam novas possibilidades.' },
    { id: 'universe', name: 'Universo', min: 30, max: Infinity, icon: '◈', color: '#32ff7e', description: 'Sua evolução já ocupa um universo inteiro.' }
  ]);

  const COSMETICS = Object.freeze({
    banners: [
      { id: 'lunar', name: 'Horizonte lunar', level: 1, colors: ['#0b1110', '#183428', '#32ff7e'] },
      { id: 'ocean', name: 'Planeta oceano', level: 10, colors: ['#071625', '#164a71', '#67d6ff'] },
      { id: 'solar', name: 'Horizonte solar', level: 15, colors: ['#211707', '#744a13', '#ffd463'] },
      { id: 'galaxy', name: 'Galáxia violeta', level: 20, colors: ['#120b25', '#40206f', '#b68cff'] },
      { id: 'nebula', name: 'Névoa cósmica', level: 25, colors: ['#210d20', '#6a2456', '#ff79c6'] },
      { id: 'cosmos', name: 'Universo profundo', level: 30, colors: ['#07100d', '#113a2a', '#32ff7e'] }
    ],
    frames: [
      { id: 'orbit', name: 'Órbita', level: 1, icon: '○' },
      { id: 'planet', name: 'Anéis', level: 10, icon: '◉' },
      { id: 'sun', name: 'Solar', level: 15, icon: '☀' },
      { id: 'stellar', name: 'Estelar', level: 20, icon: '✶' },
      { id: 'nebula', name: 'Névoa Cósmica', level: 25, icon: '✦' },
      { id: 'infinite', name: 'Infinita', level: 30, icon: '∞' }
    ],
    effects: [
      { id: 'soft-glow', name: 'Brilho lunar', level: 1, icon: '✧' },
      { id: 'orbit-trail', name: 'Rastro orbital', level: 10, icon: '≋' },
      { id: 'solar-pulse', name: 'Pulso solar', level: 15, icon: '◉' },
      { id: 'star-dust', name: 'Poeira estelar', level: 20, icon: '✷' },
      { id: 'cosmic-wave', name: 'Onda cósmica', level: 25, icon: '∿' },
      { id: 'universe', name: 'Universo vivo', level: 30, icon: '✦' }
    ],
    animations: [
      { id: 'calm', name: 'Órbita calma', level: 1, icon: '○' },
      { id: 'floating', name: 'Flutuação', level: 10, icon: '≈' },
      { id: 'solar', name: 'Pulso de luz', level: 15, icon: '☀' },
      { id: 'stars', name: 'Estrelas cadentes', level: 20, icon: '☄' },
      { id: 'nebula', name: 'Névoa em movimento', level: 25, icon: '∿' },
      { id: 'cosmic', name: 'Cosmos dinâmico', level: 30, icon: '✶' }
    ],
    icons: [
      { id: 'moon', name: 'Lua', level: 1, icon: '☾' },
      { id: 'planet', name: 'Planeta', level: 10, icon: '🪐' },
      { id: 'sun', name: 'Sol', level: 15, icon: '☀' },
      { id: 'galaxy', name: 'Galáxia', level: 20, icon: '🌌' },
      { id: 'nebula', name: 'Nebulosa', level: 25, icon: '✦' },
      { id: 'universe', name: 'Universo', level: 30, icon: '◈' }
    ],
    cursors: [
      { id: 'lunar', name: 'Ponteiro lunar', level: 1, icon: '↖' },
      { id: 'orbit', name: 'Ponteiro orbital', level: 10, icon: '⌖' },
      { id: 'solar', name: 'Ponteiro solar', level: 15, icon: '☀' },
      { id: 'stellar', name: 'Ponteiro estelar', level: 20, icon: '✧' },
      { id: 'nebula', name: 'Ponteiro névoa', level: 25, icon: '≋' },
      { id: 'cosmic', name: 'Ponteiro cósmico', level: 30, icon: '✦' }
    ],
    themes: [
      { id: 'lunar', name: 'Lua Verde', level: 1, icon: '☾' },
      { id: 'ocean', name: 'Oceano', level: 10, icon: '≋' },
      { id: 'solar', name: 'Solar', level: 15, icon: '☀' },
      { id: 'galaxy', name: 'Galáxia', level: 20, icon: '✶' },
      { id: 'nebula', name: 'Névoa Cósmica', level: 25, icon: '✦' },
      { id: 'universe', name: 'Universo', level: 30, icon: '◈' }
    ]
  });

  const ACHIEVEMENTS = Object.freeze([
    { id: 'first-task-created', badge: '✓', title: 'Primeiro plano', description: 'Criou a primeira tarefa.', xp: 5, test: m => m.tasks.created >= 1 },
    { id: 'first-task-completed', badge: '★', title: 'Primeira conclusão', description: 'Concluiu a primeira tarefa.', xp: 8, test: m => m.tasks.completed >= 1 },
    { id: 'first-habit-created', badge: '✦', title: 'Semente de constância', description: 'Criou o primeiro hábito.', xp: 5, test: m => m.habits.created >= 1 },
    { id: 'first-habit-completed', badge: '✿', title: 'Ritual iniciado', description: 'Registrou o primeiro hábito.', xp: 8, test: m => m.habits.completed >= 1 },
    { id: 'first-goal-created', badge: '◎', title: 'Destino traçado', description: 'Criou a primeira meta.', xp: 5, test: m => m.goals.created >= 1 },
    { id: 'first-goal-completed', badge: '◈', title: 'Destino alcançado', description: 'Concluiu a primeira meta.', xp: 20, test: m => m.goals.completed >= 1 },
    { id: 'streak-7', badge: '🔥', title: 'Sete luas', description: 'Manteve uma sequência de 7 dias.', xp: 20, test: m => m.general.maxStreak >= 7 },
    { id: 'streak-30', badge: '🌠', title: 'Mês em órbita', description: 'Manteve uma sequência de 30 dias.', xp: 75, test: m => m.general.maxStreak >= 30 },
    { id: 'tasks-100', badge: '🚀', title: 'Cem passos', description: 'Concluiu 100 tarefas.', xp: 100, test: m => m.tasks.completed >= 100 },
    { id: 'tasks-500', badge: '🌌', title: 'Força gravitacional', description: 'Concluiu 500 tarefas.', xp: 400, test: m => m.tasks.completed >= 500 },
    { id: 'saved-1000', badge: '🪙', title: 'Reserva lunar', description: 'Guardou R$ 1.000.', xp: 30, test: m => m.finance.saved >= 1000 },
    { id: 'saved-10000', badge: '💎', title: 'Patrimônio estelar', description: 'Guardou R$ 10.000.', xp: 150, test: m => m.finance.saved >= 10000 },
    { id: 'focus-100h', badge: '◷', title: 'Mente em órbita', description: 'Acumulou 100 horas de foco.', xp: 300, test: m => m.focus.totalMinutes >= 6000 },
    { id: 'days-365', badge: '🌑', title: 'Um ano LUAR', description: 'Completou 365 dias de jornada.', xp: 500, test: m => m.general.daysUsing >= 365 },
    { id: 'daily-mission', badge: '✧', title: 'Primeira missão diária', description: 'Concluiu tarefa, hábito e 25 minutos de foco no mesmo dia.', xp: 12, missionReward: true, test: m => m.missions.daily.complete },
    { id: 'weekly-mission', badge: '🪐', title: 'Primeira missão semanal', description: 'Esteve em atividade em 5 dos últimos 7 dias.', xp: 30, missionReward: true, test: m => m.missions.weekly.complete }
  ]);

  const accessRegistry = new Set();

  const arr = value => Array.isArray(value) ? value : [];
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const pad = value => String(value).padStart(2, '0');
  const dayFromDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const todayKey = context => {
    try {
      const result = typeof context?.today === 'function' ? context.today() : null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(result || ''))) return result;
    } catch (_) {}
    return dayFromDate(new Date());
  };
  const dayKey = value => {
    if (!value) return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) return dayFromDate(value);
    const raw = String(value);
    const direct = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (direct) return direct[1];
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? '' : dayFromDate(parsed);
  };
  const validDate = value => {
    const parsed = value instanceof Date ? value : new Date(value || '');
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const dateAtNoon = key => validDate(`${key}T12:00:00`);
  const shiftDay = (key, amount) => {
    const date = dateAtNoon(key) || new Date();
    date.setDate(date.getDate() + amount);
    return dayFromDate(date);
  };
  const dayDifference = (start, end) => {
    const a = dateAtNoon(dayKey(start));
    const b = dateAtNoon(dayKey(end));
    return a && b ? Math.max(0, Math.round((b - a) / DAY_MS)) : 0;
  };
  const dateLabel = value => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? dateAtNoon(value) : validDate(value);
    return date ? date.toLocaleDateString('pt-BR') : '—';
  };
  const dateTimeLabel = value => {
    const date = validDate(value);
    return date ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  };
  const compactMoney = (value, context) => {
    try {
      if (typeof context?.money === 'function') return context.money(number(value));
    } catch (_) {}
    return number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  const formatDuration = minutes => {
    const total = Math.max(0, Math.round(number(minutes)));
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (!hours) return `${rest} min`;
    return rest ? `${hours}h ${rest}min` : `${hours}h`;
  };
  const percent = value => `${clamp(number(value), 0, 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const append = (parent, ...children) => {
    children.flat().filter(Boolean).forEach(child => parent.appendChild(child));
    return parent;
  };
  const setText = (root, selector, value) => {
    const node = root.querySelector(selector);
    if (node) node.textContent = String(value ?? '');
  };
  const safeCall = (fn, ...args) => {
    try {
      const result = typeof fn === 'function' ? fn(...args) : null;
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return result;
    } catch (_) {
      return null;
    }
  };

  function xpForLevel(level) {
    const normalized = Math.max(1, Math.floor(number(level) || 1));
    return 50 * (normalized - 1) * normalized;
  }

  function levelFromXP(xp) {
    const total = Math.max(0, number(xp));
    return Math.max(1, Math.floor((1 + Math.sqrt(1 + (total * 2) / 25)) / 2));
  }

  function xpProgress(xp) {
    const total = Math.max(0, number(xp));
    const level = levelFromXP(total);
    const start = xpForLevel(level);
    const next = xpForLevel(level + 1);
    return {
      level,
      total,
      start,
      next,
      earned: total - start,
      needed: Math.max(0, next - total),
      percent: clamp(((total - start) / Math.max(1, next - start)) * 100, 0, 100)
    };
  }

  function stageForLevel(level) {
    const current = Math.max(1, Math.floor(number(level) || 1));
    return STAGES.find(stage => current >= stage.min && current <= stage.max) || STAGES[STAGES.length - 1];
  }

  function stageForXP(xp) {
    return stageForLevel(levelFromXP(xp));
  }

  function unlockedStages(xp) {
    const level = levelFromXP(xp);
    return STAGES.filter(stage => stage.min <= level);
  }

  function normalizeProfile(context) {
    const state = context?.state && typeof context.state === 'object' ? context.state : {};
    state.profile = state.profile && typeof state.profile === 'object' ? state.profile : {};
    const profile = state.profile;
    let changed = false;
    if (!profile.achievements || typeof profile.achievements !== 'object' || Array.isArray(profile.achievements)) {
      const prior = arr(profile.achievements);
      profile.achievements = {};
      prior.forEach(item => {
        if (item?.id) profile.achievements[item.id] = item;
      });
      changed = true;
    }
    if (!Array.isArray(profile.xpHistory)) {
      profile.xpHistory = [];
      changed = true;
    }
    if (!profile.xpLedger || typeof profile.xpLedger !== 'object' || Array.isArray(profile.xpLedger)) {
      profile.xpLedger = {};
      changed = true;
    }
    if (!profile.statistics || typeof profile.statistics !== 'object' || Array.isArray(profile.statistics)) {
      profile.statistics = {};
      changed = true;
    }
    if (!profile.cosmetics || typeof profile.cosmetics !== 'object' || Array.isArray(profile.cosmetics)) {
      profile.cosmetics = {};
      changed = true;
    }
    if (!profile.statistics.createdAt) {
      profile.statistics.createdAt = profile.firstSeenAt || context?.currentUser?.created_at || earliestRecordedDate(state) || new Date().toISOString();
      changed = true;
    }
    if (!profile.firstSeenAt) {
      profile.firstSeenAt = profile.statistics.createdAt;
      changed = true;
    }
    return { state, profile, changed };
  }

  function earliestRecordedDate(state) {
    const candidates = [];
    const collect = value => {
      const date = validDate(value);
      if (date) candidates.push(date);
    };
    ['tasks', 'habits', 'goals', 'transactions', 'events', 'moods', 'notes', 'focusSessions', 'investments'].forEach(key => {
      arr(state?.[key]).forEach(item => collect(item?.createdAt || item?.date));
    });
    if (!candidates.length) return '';
    return new Date(Math.min(...candidates.map(date => date.getTime()))).toISOString();
  }

  function registerAccess(context) {
    const normalized = normalizeProfile(context);
    const profile = normalized.profile;
    const identity = context?.currentUser?.id || context?.currentUser?.email || 'local';
    let changed = normalized.changed;
    if (!number(profile.accessCount) && !accessRegistry.has(identity)) {
      accessRegistry.add(identity);
      profile.accessCount = Math.max(0, Math.floor(number(profile.statistics.accessCount))) + 1;
      profile.lastAccessAt = profile.lastAccessAt || new Date().toISOString();
      changed = true;
    }
    if (profile.statistics.accessCount !== profile.accessCount) {
      profile.statistics.accessCount = Math.max(0, Math.floor(number(profile.accessCount)));
      changed = true;
    }
    if (profile.statistics.lastAccessAt !== profile.lastAccessAt) {
      profile.statistics.lastAccessAt = profile.lastAccessAt || '';
      changed = true;
    }
    return changed;
  }

  function activityMap(state) {
    const map = new Map();
    const add = (value, weight = 1, kind = '') => {
      const key = dayKey(value);
      if (!key) return;
      const entry = map.get(key) || { score: 0, kinds: new Set() };
      entry.score += Math.max(0, number(weight));
      if (kind) entry.kinds.add(kind);
      map.set(key, entry);
    };
    arr(state.tasks).forEach(item => {
      if (item?.completed) add(item.completedAt || item.updatedAt || item.date || item.createdAt, 2, 'task');
    });
    arr(state.habits).forEach(item => arr(item?.history).forEach(value => add(value, 1, 'habit')));
    arr(state.focusSessions).forEach(item => add(item?.date || item?.createdAt, Math.max(1, number(item?.minutes) / 25), 'focus'));
    arr(state.moods).forEach(item => add(item?.date || item?.createdAt, 1, 'mood'));
    arr(state.transactions).forEach(item => add(item?.date || item?.createdAt, 1, 'finance'));
    arr(state.goals).forEach(goal => arr(goal?.deposits).forEach(item => add(item?.date || item?.createdAt, 1, 'goal')));
    return map;
  }

  function streaksFromDays(keys, currentDay) {
    const sorted = [...new Set(keys.filter(Boolean))].sort();
    if (!sorted.length) return { current: 0, max: 0 };
    let max = 1;
    let run = 1;
    for (let index = 1; index < sorted.length; index += 1) {
      if (dayDifference(sorted[index - 1], sorted[index]) === 1) run += 1;
      else run = 1;
      max = Math.max(max, run);
    }
    const set = new Set(sorted);
    let cursor = currentDay;
    if (!set.has(cursor) && set.has(shiftDay(cursor, -1))) cursor = shiftDay(cursor, -1);
    let current = 0;
    while (set.has(cursor)) {
      current += 1;
      cursor = shiftDay(cursor, -1);
    }
    return { current, max };
  }

  function bestHabitStreak(state) {
    return arr(state.habits).reduce((best, habit) => {
      const keys = arr(habit?.history).map(dayKey).filter(Boolean).sort();
      if (!keys.length) return best;
      let run = 1;
      let max = 1;
      for (let index = 1; index < keys.length; index += 1) {
        run = dayDifference(keys[index - 1], keys[index]) === 1 ? run + 1 : 1;
        max = Math.max(max, run);
      }
      return Math.max(best, max);
    }, 0);
  }

  function monthKey(value) {
    return dayKey(value).slice(0, 7);
  }

  function monthSeries(state, count = 12) {
    const now = new Date();
    const rows = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1, 12);
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      const transactions = arr(state.transactions).filter(item => monthKey(item?.date || item?.createdAt) === key);
      const income = transactions.filter(item => item?.type === 'income').reduce((sum, item) => sum + number(item?.amount), 0);
      const expense = transactions.filter(item => item?.type !== 'income').reduce((sum, item) => sum + number(item?.amount), 0);
      const goals = arr(state.goals).reduce((sum, goal) => sum + arr(goal?.deposits).filter(item => monthKey(item?.date || item?.createdAt) === key).reduce((part, item) => part + number(item?.amount), 0), 0);
      rows.push({ key, label: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), income, expense, saved: Math.max(0, income - expense - goals) + goals, goals });
    }
    return rows;
  }

  function peakHour(state) {
    const hours = new Map();
    const add = value => {
      const date = validDate(value);
      if (!date || !String(value || '').includes('T')) return;
      const hour = date.getHours();
      hours.set(hour, (hours.get(hour) || 0) + 1);
    };
    arr(state.tasks).filter(item => item?.completed).forEach(item => add(item?.completedAt || item?.updatedAt));
    arr(state.focusSessions).forEach(item => add(item?.createdAt));
    arr(state.habits).forEach(item => add(item?.updatedAt));
    if (!hours.size) return '—';
    const hour = [...hours.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`;
  }

  function productiveDaySummary(activity) {
    const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const rows = [...activity.entries()]
      .filter(([, entry]) => number(entry?.score) > 0)
      .map(([key, entry]) => ({ key, score: number(entry.score), date: dateAtNoon(key) }))
      .filter(row => row.date)
      .sort((a, b) => b.score - a.score || b.key.localeCompare(a.key));
    const weekdayTotals = new Map();
    rows.forEach(row => {
      const weekday = weekdays[row.date.getDay()];
      const current = weekdayTotals.get(weekday) || { score: 0, days: 0 };
      current.score += row.score;
      current.days += 1;
      weekdayTotals.set(weekday, current);
    });
    const topWeekdays = [...weekdayTotals.entries()]
      .sort((a, b) => b[1].score - a[1].score || b[1].days - a[1].days)
      .slice(0, 2)
      .map(([name]) => name);
    const topDates = rows.slice(0, 3).map(row => `${dateLabel(row.key)} (${Math.round(row.score)} pts)`);
    return { count: rows.length, topWeekdays, topDates };
  }

  function goalCompletionDate(goal) {
    if (number(goal?.current) < Math.max(1, number(goal?.target))) return '';
    if (goal?.completedAt) return goal.completedAt;
    const deposits = arr(goal?.deposits).slice().sort((a, b) => String(a?.date || a?.createdAt || '').localeCompare(String(b?.date || b?.createdAt || '')));
    if (!deposits.length) return goal?.updatedAt || '';
    const deposited = deposits.reduce((sum, item) => sum + number(item?.amount), 0);
    let running = Math.max(0, number(goal?.current) - deposited);
    for (const deposit of deposits) {
      running += number(deposit?.amount);
      if (running >= number(goal?.target)) return deposit?.date || deposit?.createdAt || '';
    }
    return deposits[deposits.length - 1]?.date || deposits[deposits.length - 1]?.createdAt || '';
  }

  function consecutiveDiaryDays(state, currentDay) {
    return streaksFromDays(arr(state.moods).map(item => dayKey(item?.date || item?.createdAt)), currentDay).current;
  }

  function commonMood(state) {
    const counts = new Map();
    arr(state.moods).forEach(item => {
      const mood = String(item?.mood || '').trim();
      if (mood) counts.set(mood, (counts.get(mood) || 0) + 1);
    });
    return counts.size ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] : '—';
  }

  function recentDayRows(state, count, context) {
    const end = todayKey(context);
    const activity = activityMap(state);
    const rows = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
      const key = shiftDay(end, -offset);
      const tasks = arr(state.tasks).filter(item => item?.completed && dayKey(item?.completedAt || item?.updatedAt || item?.date || item?.createdAt) === key).length;
      const habits = arr(state.habits).reduce((sum, item) => sum + Number(arr(item?.history).some(value => dayKey(value) === key)), 0);
      const focus = arr(state.focusSessions).filter(item => dayKey(item?.date || item?.createdAt) === key).reduce((sum, item) => sum + number(item?.minutes), 0);
      rows.push({ key, label: dateAtNoon(key)?.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3) || key.slice(8), tasks, habits, focus, score: activity.get(key)?.score || 0 });
    }
    return rows;
  }

  function computeMetrics(context) {
    const { state, profile } = normalizeProfile(context);
    const currentDay = todayKey(context);
    const activity = activityMap(state);
    const productiveDays = productiveDaySummary(activity);
    const activityStreaks = streaksFromDays([...activity.keys()], currentDay);
    const createdAt = profile.firstSeenAt || profile.statistics.createdAt || context?.currentUser?.created_at || new Date().toISOString();
    const daysUsing = dayDifference(createdAt, currentDay) + 1;
    const xp = xpProgress(profile.xp);
    const stage = stageForLevel(xp.level);

    const tasksCreated = arr(state.tasks).length;
    const completedTasks = arr(state.tasks).filter(item => item?.completed);
    const taskCompletion = tasksCreated ? completedTasks.length / tasksCreated * 100 : 0;
    const habitChecks = arr(state.habits).reduce((sum, item) => sum + arr(item?.history).length, 0);
    const focusMinutes = arr(state.focusSessions).reduce((sum, item) => sum + Math.max(0, number(item?.minutes)), 0);
    const incomeTransactions = arr(state.transactions).filter(item => item?.type === 'income');
    const expenseTransactions = arr(state.transactions).filter(item => item?.type !== 'income');
    const income = incomeTransactions.reduce((sum, item) => sum + Math.max(0, number(item?.amount)), 0);
    const expenses = expenseTransactions.reduce((sum, item) => sum + Math.max(0, number(item?.amount)), 0);
    const goalSaved = arr(state.goals).reduce((sum, goal) => sum + Math.max(0, number(goal?.current)), 0);
    const goalTransfers = arr(state.goals).reduce((sum, goal) => sum + arr(goal?.deposits).reduce((part, deposit) => part + Math.max(0, number(deposit?.amount)), 0), 0);
    const saved = Math.max(0, income - expenses - goalTransfers) + goalSaved;
    const months = monthSeries(state, 12);
    const completedGoals = arr(state.goals).filter(goal => number(goal?.current) >= Math.max(1, number(goal?.target)));
    const goalDurations = completedGoals.map(goal => {
      const completedAt = goalCompletionDate(goal);
      return completedAt ? dayDifference(goal?.createdAt || goal?.date || completedAt, completedAt) : null;
    }).filter(value => value !== null);
    const categoryCounts = new Map();
    completedGoals.forEach(goal => {
      const category = String(goal?.category || 'Sem categoria');
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
    const topGoalCategory = categoryCounts.size ? [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : '—';
    const week = recentDayRows(state, 7, context);
    const todayRow = week[week.length - 1] || { tasks: 0, habits: 0, focus: 0 };
    const activeWeekDays = week.filter(row => row.score > 0).length;
    const dailyComplete = todayRow.tasks >= 1 && todayRow.habits >= 1 && todayRow.focus >= 25;
    const weeklyComplete = activeWeekDays >= 5;
    const achievements = Object.values(profile.achievements || {}).filter(Boolean).sort((a, b) => String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || '')));
    const nextAchievement = ACHIEVEMENTS.find(item => !profile.achievements?.[item.id]);

    return {
      general: {
        daysUsing,
        createdAt,
        lastAccessAt: profile.lastAccessAt || profile.statistics.lastAccessAt || context?.currentUser?.last_sign_in_at || '',
        accesses: Math.max(1, number(profile.accessCount || profile.statistics.accessCount)),
        currentStreak: Math.max(number(profile.streak), activityStreaks.current),
        maxStreak: Math.max(number(profile.record), activityStreaks.max),
        level: xp.level,
        xp: xp.total,
        xpNeeded: xp.needed,
        xpProgress: xp.percent,
        stage
      },
      tasks: { created: tasksCreated, completed: completedTasks.length, rate: taskCompletion },
      habits: { created: arr(state.habits).length, completed: habitChecks, bestStreak: bestHabitStreak(state) },
      focus: { totalMinutes: focusMinutes, dailyAverage: focusMinutes / Math.max(1, daysUsing), sessions: arr(state.focusSessions).length },
      productivity: { productiveDays: productiveDays.count, topWeekdays: productiveDays.topWeekdays, topDates: productiveDays.topDates, peakHour: peakHour(state) },
      finance: {
        income,
        expenses,
        saved,
        monthlyAverage: months.reduce((sum, row) => sum + row.saved, 0) / Math.max(1, months.length),
        maxIncome: incomeTransactions.reduce((max, item) => Math.max(max, number(item?.amount)), 0),
        maxExpense: expenseTransactions.reduce((max, item) => Math.max(max, number(item?.amount)), 0),
        moved: income + expenses,
        months
      },
      goals: {
        created: arr(state.goals).length,
        completed: completedGoals.length,
        inProgress: Math.max(0, arr(state.goals).length - completedGoals.length),
        averageDays: goalDurations.length ? goalDurations.reduce((sum, value) => sum + value, 0) / goalDurations.length : 0,
        topCategory: topGoalCategory,
        progress: clamp(arr(state.goals).reduce((sum, goal) => sum + number(goal?.current), 0) / Math.max(1, arr(state.goals).reduce((sum, goal) => sum + number(goal?.target), 0)) * 100, 0, 100)
      },
      diary: { entries: arr(state.moods).length, commonMood: commonMood(state), streak: consecutiveDiaryDays(state, currentDay) },
      achievements: { unlocked: achievements.length, total: ACHIEVEMENTS.length, items: achievements, latest: achievements[0] || null, next: nextAchievement || null },
      missions: {
        daily: { tasks: todayRow.tasks, habits: todayRow.habits, focus: todayRow.focus, complete: dailyComplete },
        weekly: { activeDays: activeWeekDays, target: 5, complete: weeklyComplete }
      },
      activity,
      week,
      month: recentDayRows(state, 30, context)
    };
  }

  function grantXP(context, amount, source, key) {
    const { profile } = normalizeProfile(context);
    const ledgerKey = String(key || `manual:${Date.now()}`);
    if (profile.xpLedger[ledgerKey]) return false;
    const earned = Math.max(0, Math.floor(number(amount)));
    if (!earned) return false;
    profile.xpLedger[ledgerKey] = new Date().toISOString();
    profile.xp = Math.max(0, number(profile.xp)) + earned;
    profile.xpHistory.push({ id: ledgerKey, source: String(source || 'Progresso'), amount: earned, total: profile.xp, date: new Date().toISOString() });
    return true;
  }

  function evaluateMissions(context, metrics = computeMetrics(context)) {
    if (!context || context.lifetimeActive === false) return [];
    const currentDay = todayKey(context);
    const currentDate = dateAtNoon(currentDay) || new Date();
    const weekStart = shiftDay(currentDay, -((currentDate.getDay() + 6) % 7));
    const awarded = [];
    if (metrics.missions.daily.complete && grantXP(context, 12, 'Missão diária', `mission:daily:${currentDay}`)) awarded.push({ type: 'daily', amount: 12 });
    if (metrics.missions.weekly.complete && grantXP(context, 30, 'Missão semanal', `mission:weekly:${weekStart}`)) awarded.push({ type: 'weekly', amount: 30 });
    return awarded;
  }

  function evaluateAchievements(context) {
    if (!context || context.lifetimeActive === false) return [];
    const normalized = normalizeProfile(context);
    const profile = normalized.profile;
    const metrics = computeMetrics(context);
    const unlocked = [];
    const missionAwards = evaluateMissions(context, metrics);
    ACHIEVEMENTS.forEach(definition => {
      if (profile.achievements[definition.id] || !definition.test(metrics)) return;
      const unlockedAt = new Date().toISOString();
      profile.achievements[definition.id] = {
        id: definition.id,
        title: definition.title,
        description: definition.description,
        badge: definition.badge,
        xp: definition.xp,
        unlockedAt
      };
      if (!definition.missionReward) grantXP(context, definition.xp, definition.title, `achievement:${definition.id}`);
      unlocked.push(profile.achievements[definition.id]);
    });
    if (unlocked.length || missionAwards.length || normalized.changed) {
      safeCall(context.save);
    }
    if (unlocked.length) {
      const latest = unlocked[unlocked.length - 1];
      safeCall(context.toast, unlocked.length === 1 ? `Conquista desbloqueada: ${latest.title}` : `${unlocked.length} conquistas desbloqueadas`, `A conquista ficou salva para sempre e adicionou ${unlocked.reduce((sum, item) => sum + number(item.xp), 0)} XP.`);
    } else if (missionAwards.length) {
      const total = missionAwards.reduce((sum, item) => sum + item.amount, 0);
      safeCall(context.toast, `+${total} XP • Missão concluída`, missionAwards.length > 1 ? 'As recompensas diária e semanal foram registradas.' : `Sua missão ${missionAwards[0].type === 'daily' ? 'diária' : 'semanal'} foi registrada.`);
    }
    return unlocked;
  }

  function staticPage(root) {
    root.replaceChildren();
    root.classList.add('luar-statistics');
    root.dataset.statisticsReady = '1';

    const hero = create('header', 'ls-hero');
    const copy = create('div', 'ls-hero-copy');
    append(copy, create('span', 'ls-kicker', 'ESTATÍSTICAS VITALÍCIO'), create('h1', '', 'Sua jornada em números.'), create('p', '', 'Produtividade, dinheiro, foco e evolução reunidos sem apagar o seu histórico.'));
    const stage = create('div', 'ls-stage-pill');
    stage.dataset.statsStage = '';
    append(hero, copy, stage);

    const quickNav = create('nav', 'ls-section-nav');
    [['Visão geral', 'ls-general'], ['Produtividade', 'ls-productivity'], ['Financeiro', 'ls-finance'], ['Metas', 'ls-goals'], ['Diário', 'ls-diary'], ['Conquistas', 'ls-achievements']].forEach(([label, target]) => {
      const link = create('a', '', label);
      link.href = `#${target}`;
      quickNav.appendChild(link);
    });

    const profile = create('section', 'ls-profile-host');
    profile.dataset.statsProfile = '';

    const mission = create('section', 'ls-missions');
    mission.dataset.statsMissions = '';

    const metricHosts = [
      ['ls-general', 'Visão geral', 'Sua história no LUAR', 'general'],
      ['ls-productivity', 'Produtividade', 'O que você colocou em movimento', 'productivity'],
      ['ls-finance', 'Financeiro', 'A evolução do seu dinheiro', 'finance'],
      ['ls-goals', 'Metas', 'Destinos planejados e alcançados', 'goals'],
      ['ls-diary', 'Diário', 'Como seus dias foram registrados', 'diary'],
      ['ls-achievements', 'Conquistas', 'Marcos que ficam no seu perfil para sempre', 'achievements']
    ].map(([id, kicker, title, key]) => {
      const section = create('section', 'ls-metric-section');
      section.id = id;
      section.dataset.statsSection = key;
      const heading = create('header', 'ls-section-heading');
      append(heading, create('span', '', kicker.toUpperCase()), create('h2', '', title));
      const grid = create('div', 'ls-metric-grid');
      grid.dataset.statsMetrics = key;
      append(section, heading, grid);
      return section;
    });

    const charts = create('section', 'ls-charts');
    charts.dataset.statsCharts = '';
    const chartHeading = create('header', 'ls-section-heading');
    append(chartHeading, create('span', '', 'GRÁFICOS'), create('h2', '', 'Sua órbita visual'));
    charts.appendChild(chartHeading);
    const chartGrid = create('div', 'ls-chart-grid');
    [
      ['weekly', 'Produtividade semanal', 'Tarefas, hábitos e foco nos últimos 7 dias.'],
      ['monthly', 'Produtividade mensal', 'Ritmo de atividade dos últimos 30 dias.'],
      ['xp', 'Evolução de XP', 'Cada conquista permanente registrada.'],
      ['focus', 'Tempo em modo foco', 'Minutos de concentração nos últimos 7 dias.'],
      ['habits', 'Hábitos concluídos', 'Registros de hábitos nos últimos 7 dias.'],
      ['tasks', 'Tarefas concluídas', 'Entregas concluídas nos últimos 7 dias.'],
      ['finance', 'Evolução financeira', 'Ganhos, gastos e economia em 12 meses.'],
      ['goals', 'Progresso das metas', 'Quanto falta para cada destino.']
    ].forEach(([key, title, description]) => {
      const card = create('article', 'ls-chart-card');
      card.dataset.statsChart = key;
      append(card, create('h3', '', title), create('p', '', description), create('div', 'ls-chart-canvas'));
      chartGrid.appendChild(card);
    });
    charts.appendChild(chartGrid);

    const calendar = create('section', 'ls-calendar-card');
    calendar.dataset.statsCalendar = '';
    const calendarHeading = create('header', 'ls-section-heading');
    append(calendarHeading, create('span', '', 'ATIVIDADE 365D'), create('h2', '', 'Um ano visto de cima'));
    append(calendar, calendarHeading, create('p', 'ls-calendar-copy', 'Cada quadrado representa um dia. Quanto mais intenso, mais registros foram feitos.'), create('div', 'ls-calendar-scroll'));

    append(root, hero, quickNav, profile, mission, ...metricHosts, charts, calendar);
  }

  function renderMetricCards(host, items) {
    host.replaceChildren();
    items.forEach(item => {
      const card = create('article', `ls-metric ${item.tone || ''}`.trim());
      const icon = create('i', '', item.icon || '✦');
      const content = create('div');
      append(content, create('span', '', item.label), create('strong', '', item.value));
      if (item.hint) content.appendChild(create('small', '', item.hint));
      append(card, icon, content);
      host.appendChild(card);
    });
  }

  function selectedCosmetic(profile, type, available) {
    const selected = String(profile.cosmetics?.[type] || '');
    return available.some(item => item.id === selected) ? selected : available[available.length - 1]?.id || '';
  }

  function syncAutomaticStage(profile, level) {
    const stage = stageForLevel(level);
    if (profile.cosmetics.autoStage === stage.id) return false;
    const cosmeticTypes = ['stage', 'banner', 'frame', 'effect', 'animation', 'icon', 'cursor', 'theme'];
    if (!profile.cosmetics.autoStage && cosmeticTypes.some(type => profile.cosmetics[type])) {
      profile.cosmetics.autoStage = stage.id;
      return true;
    }
    profile.cosmetics.stage = stage.id;
    ['banners', 'frames', 'effects', 'animations', 'icons', 'cursors', 'themes'].forEach(collection => {
      const available = COSMETICS[collection].filter(item => item.level <= level);
      const latest = available[available.length - 1];
      if (latest) profile.cosmetics[collection.slice(0, -1)] = latest.id;
    });
    profile.cosmetics.autoStage = stage.id;
    return true;
  }

  function validProfileImage(value, maxDataLength = 360000) {
    const raw = String(value || '').trim();
    if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw.length <= maxDataLength ? raw : '';
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function readProfileImage(file, kind) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\/(?:png|jpeg|webp)$/i.test(file.type) || file.size > 8_000_000) {
        reject(new Error('Use uma imagem PNG, JPG ou WebP de até 8 MB.'));
        return;
      }
      const source = URL.createObjectURL(file);
      const image = new Image();
      const finish = () => URL.revokeObjectURL(source);
      image.onerror = () => {
        finish();
        reject(new Error('Não foi possível abrir esta imagem.'));
      };
      image.onload = () => {
        try {
          const avatar = kind === 'avatar';
          const ratio = avatar ? 1 : 3;
          let sourceWidth = image.naturalWidth;
          let sourceHeight = image.naturalHeight;
          let sourceX = 0;
          let sourceY = 0;
          if (sourceWidth / sourceHeight > ratio) {
            const cropped = sourceHeight * ratio;
            sourceX = (sourceWidth - cropped) / 2;
            sourceWidth = cropped;
          } else {
            const cropped = sourceWidth / ratio;
            sourceY = (sourceHeight - cropped) / 2;
            sourceHeight = cropped;
          }
          const maxDataLength = avatar ? 160000 : 360000;
          const targetWidth = Math.max(1, Math.min(avatar ? 360 : 1200, Math.round(sourceWidth)));
          const targetHeight = Math.max(1, Math.round(targetWidth / ratio));
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const drawing = canvas.getContext('2d', { alpha: false });
          if (!drawing) throw new Error('Seu navegador não conseguiu preparar a imagem.');
          drawing.imageSmoothingEnabled = true;
          drawing.imageSmoothingQuality = 'high';
          drawing.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
          let result = canvas.toDataURL('image/webp', avatar ? 0.78 : 0.72);
          if (!validProfileImage(result, maxDataLength)) result = canvas.toDataURL('image/jpeg', avatar ? 0.65 : 0.58);
          if (!validProfileImage(result, maxDataLength)) throw new Error('A imagem ficou grande demais. Escolha outra imagem.');
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          finish();
        }
      };
      image.src = source;
    });
  }

  function renderProfile(root, context) {
    const host = root?.matches?.('[data-stats-profile]') ? root : root?.querySelector?.('[data-stats-profile]');
    if (!host) return null;
    const { profile } = normalizeProfile(context);
    const xp = xpProgress(profile.xp);
    const actualStage = stageForLevel(xp.level);
    const stageChanged = syncAutomaticStage(profile, xp.level);
    if (stageChanged) safeCall(context?.save);
    const unlocked = unlockedStages(profile.xp);
    const selectedStageId = unlocked.some(item => item.id === profile.cosmetics.stage) ? profile.cosmetics.stage : actualStage.id;
    const selectedStage = STAGES.find(item => item.id === selectedStageId) || actualStage;
    const availableBanners = COSMETICS.banners.filter(item => item.level <= xp.level);
    const availableFrames = COSMETICS.frames.filter(item => item.level <= xp.level);
    const bannerId = selectedCosmetic(profile, 'banner', availableBanners);
    const frameId = selectedCosmetic(profile, 'frame', availableFrames);
    const effectId = selectedCosmetic(profile, 'effect', COSMETICS.effects.filter(item => item.level <= xp.level));
    const animationId = selectedCosmetic(profile, 'animation', COSMETICS.animations.filter(item => item.level <= xp.level));
    const iconId = selectedCosmetic(profile, 'icon', COSMETICS.icons.filter(item => item.level <= xp.level));
    const cursorId = selectedCosmetic(profile, 'cursor', COSMETICS.cursors.filter(item => item.level <= xp.level));
    const themeId = selectedCosmetic(profile, 'theme', COSMETICS.themes.filter(item => item.level <= xp.level));
    const banner = COSMETICS.banners.find(item => item.id === bannerId) || COSMETICS.banners[0];
    const selectedIcon = COSMETICS.icons.find(item => item.id === iconId) || COSMETICS.icons[0];
    const name = profile.name || context?.currentUser?.user_metadata?.name || context?.currentUser?.email?.split('@')[0] || 'Viajante';
    const email = context?.currentUser?.email || '';
    const avatar = validProfileImage(profile.avatar || context?.currentUser?.user_metadata?.avatar_url || context?.currentUser?.user_metadata?.picture);
    const customBanner = validProfileImage(profile.customBanner);
    const unlockedAchievements = Object.values(profile.achievements || {}).filter(Boolean).sort((a, b) => String(b.unlockedAt || '').localeCompare(String(a.unlockedAt || '')));
    const selectedBadgeId = String(profile.cosmetics.badge || '');
    const selectedBadge = unlockedAchievements.find(item => item.id === selectedBadgeId);

    host.replaceChildren();
    host.dataset.profileCursor = cursorId;
    const card = create('article', `ls-profile-card frame-${frameId} effect-${effectId} animation-${animationId} theme-${themeId}`);
    const cover = create('div', 'ls-profile-cover');
    cover.style.setProperty('--banner-a', banner.colors[0]);
    cover.style.setProperty('--banner-b', banner.colors[1]);
    cover.style.setProperty('--banner-c', banner.colors[2]);
    if (customBanner) {
      cover.classList.add('custom-banner');
      cover.style.backgroundImage = `linear-gradient(180deg, rgba(3, 7, 5, 0.04), rgba(3, 7, 5, 0.36)), url(${JSON.stringify(customBanner)})`;
      cover.style.backgroundPosition = 'center';
      cover.style.backgroundSize = 'cover';
    }
    const bannerEdit = create('button', 'ls-cover-edit', customBanner ? '✎ Trocar banner' : '＋ Adicionar banner');
    bannerEdit.type = 'button';
    bannerEdit.dataset.statsAction = 'pick-banner';
    const universe = create('span', 'ls-profile-universe', `${selectedStage.icon} ${selectedStage.name}`);
    append(cover, bannerEdit, universe);

    const body = create('div', 'ls-profile-body');
    const identity = create('div', 'ls-profile-identity');
    const avatarWrap = create('button', 'ls-profile-avatar');
    avatarWrap.type = 'button';
    avatarWrap.dataset.statsAction = 'pick-avatar';
    avatarWrap.title = 'Alterar foto do perfil';
    avatarWrap.setAttribute('aria-label', 'Alterar foto do perfil');
    if (avatar) {
      const image = create('img');
      image.src = avatar;
      image.alt = `Foto de ${name}`;
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => {
        image.remove();
        avatarWrap.textContent = name.slice(0, 2).toUpperCase();
      }, { once: true });
      avatarWrap.appendChild(image);
    } else {
      avatarWrap.textContent = selectedIcon.icon || name.slice(0, 2).toUpperCase();
      avatarWrap.title = `${name} · ícone ${selectedIcon.name}`;
    }
    const identityCopy = create('div');
    append(identityCopy, create('span', '', 'SEU PERFIL CÓSMICO'), create('h2', '', `Olá, ${name}`));
    if (email) identityCopy.appendChild(create('p', '', email));
    const badges = create('div', 'ls-profile-badges');
    if (context?.lifetimeActive) badges.appendChild(create('span', 'lifetime', '✦ Vitalício'));
    badges.appendChild(create('span', '', `Nível ${xp.level}`));
    const visibleBadges = selectedBadge ? [selectedBadge, ...unlockedAchievements.filter(item => item.id !== selectedBadge.id)] : unlockedAchievements;
    visibleBadges.slice(0, 4).forEach(item => {
      const badge = create('span', 'achievement', `${item.badge || '★'} ${item.title || 'Conquista'}`);
      badge.title = item.description || '';
      badges.appendChild(badge);
    });
    identityCopy.appendChild(badges);
    append(identity, avatarWrap, identityCopy);

    const progress = create('div', 'ls-xp-progress');
    const progressHead = create('div');
    append(progressHead, create('b', '', `${xp.total.toLocaleString('pt-BR')} XP`), create('span', '', `${xp.needed.toLocaleString('pt-BR')} XP para o nível ${xp.level + 1}`));
    const track = create('i');
    const fill = create('u');
    fill.style.width = `${xp.percent}%`;
    track.appendChild(fill);
    append(progress, progressHead, track);
    append(body, identity, progress);
    append(card, cover, body);

    const inventory = create('div', 'ls-inventory');
    const inventoryHead = create('header');
    append(inventoryHead, create('span', '', 'INVENTÁRIO'), create('h3', '', 'Personalize sua evolução'));
    inventory.appendChild(inventoryHead);

    const mediaGroup = create('section', 'ls-cosmetic-group ls-media-editor');
    mediaGroup.appendChild(create('h4', '', 'Foto e banner personalizados'));
    const mediaOptions = create('div');
    const mediaButton = (action, icon, title, copy) => {
      const button = create('button');
      button.type = 'button';
      button.dataset.statsAction = action;
      append(button, create('i', '', icon), create('span', '', title), create('small', '', copy));
      return button;
    };
    append(mediaOptions,
      mediaButton('pick-avatar', '◉', 'Alterar foto', 'PNG, JPG ou WebP'),
      mediaButton('pick-banner', '▰', customBanner ? 'Trocar banner' : 'Adicionar banner', 'Recorte automático 3:1')
    );
    if (profile.avatar) mediaOptions.appendChild(mediaButton('clear-avatar', '×', 'Remover foto', 'Voltar à foto da conta'));
    if (customBanner) mediaOptions.appendChild(mediaButton('clear-banner', '×', 'Remover banner', 'Voltar ao fundo do estágio'));
    const attachFileInput = kind => {
      const input = create('input', 'ls-media-file');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp';
      input.hidden = true;
      input.dataset.statsFile = kind;
      input.setAttribute('aria-label', kind === 'avatar' ? 'Selecionar foto do perfil' : 'Selecionar banner do perfil');
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        input.disabled = true;
        const property = kind === 'avatar' ? 'avatar' : 'customBanner';
        const previous = profile[property];
        let changed = false;
        try {
          const image = await readProfileImage(file, kind);
          profile[property] = image;
          changed = true;
          const stateBytes = new Blob([JSON.stringify(context?.state || {})]).size;
          if (stateBytes > 1_250_000) throw new Error('Seus dados já estão próximos do limite da nuvem. Remova arquivos grandes antes de adicionar esta imagem.');
          const cloudSaved = typeof context?.saveNow === 'function' ? await context.saveNow() : (safeCall(context?.save), true);
          safeCall(context?.refreshProfileMedia);
          renderProfile(root, context);
          safeCall(context?.toast, kind === 'avatar' ? 'Foto atualizada' : 'Banner atualizado', cloudSaved === false ? 'A imagem ficou salva neste dispositivo; a nuvem será sincronizada quando a conexão voltar.' : 'A imagem foi otimizada e salva na sua conta.');
        } catch (error) {
          if (changed) {
            if (previous === undefined) delete profile[property];
            else profile[property] = previous;
          }
          safeCall(context?.toast, 'Imagem não aplicada', error?.message || 'Escolha outra imagem e tente novamente.');
        } finally {
          input.disabled = false;
          input.value = '';
        }
      });
      return input;
    };
    append(mediaGroup, mediaOptions, attachFileInput('avatar'), attachFileInput('banner'));
    inventory.appendChild(mediaGroup);

    const chooser = (title, type, items, selected) => {
      const group = create('section', 'ls-cosmetic-group');
      group.appendChild(create('h4', '', title));
      const options = create('div');
      items.forEach(item => {
        const locked = item.level > xp.level;
        const button = create('button', `${item.id === selected ? 'active ' : ''}${locked ? 'locked' : ''}`.trim());
        button.type = 'button';
        button.disabled = locked;
        button.dataset.statsAction = `set-${type}`;
        button.dataset.value = item.id;
        if (type === 'banner') {
          const swatch = create('i', 'ls-banner-swatch');
          swatch.style.background = `linear-gradient(135deg, ${item.colors.join(', ')})`;
          button.appendChild(swatch);
        } else button.appendChild(create('i', '', item.icon || '✦'));
        append(button, create('span', '', item.name), create('small', '', locked ? `Nível ${item.level}` : 'Desbloqueado'));
        options.appendChild(button);
      });
      group.appendChild(options);
      inventory.appendChild(group);
    };
    chooser('Universo exibido', 'stage', STAGES.map(item => ({ ...item, level: item.min })), selectedStageId);
    chooser('Fundos de perfil', 'banner', COSMETICS.banners, bannerId);
    chooser('Molduras', 'frame', COSMETICS.frames, frameId);
    chooser('Efeitos', 'effect', COSMETICS.effects, effectId);
    chooser('Animações', 'animation', COSMETICS.animations, animationId);
    chooser('Ícones', 'icon', COSMETICS.icons, iconId);
    chooser('Cursores', 'cursor', COSMETICS.cursors, cursorId);
    chooser('Temas cósmicos', 'theme', COSMETICS.themes, themeId);
    if (unlockedAchievements.length) chooser('Badge em destaque', 'badge', unlockedAchievements.map(item => ({ id: item.id, name: item.title, icon: item.badge || '★', level: 1 })), selectedBadge?.id || unlockedAchievements[0].id);

    append(host, card, inventory);
    return host;
  }

  function buildProfile(root, context) {
    const host = renderProfile(root, context);
    if (host) bind(host, context || {});
    return host;
  }

  function renderMissions(root, metrics) {
    const host = root.querySelector('[data-stats-missions]');
    if (!host) return;
    host.replaceChildren();
    const heading = create('header', 'ls-section-heading');
    append(heading, create('span', '', 'MISSÕES'), create('h2', '', 'Próximos impulsos de XP'));
    host.appendChild(heading);
    const grid = create('div', 'ls-mission-grid');
    const missionCard = (title, reward, complete, rows) => {
      const card = create('article', complete ? 'complete' : '');
      const top = create('header');
      append(top, create('div', '', title), create('strong', '', complete ? 'Concluída ✓' : `+${reward} XP`));
      card.appendChild(top);
      rows.forEach(row => {
        const line = create('div', `ls-mission-line ${row.done ? 'done' : ''}`.trim());
        append(line, create('i', '', row.done ? '✓' : '·'), create('span', '', row.label), create('b', '', row.value));
        card.appendChild(line);
      });
      return card;
    };
    append(grid,
      missionCard('Missão diária', 12, metrics.missions.daily.complete, [
        { label: 'Concluir uma tarefa', value: `${Math.min(1, metrics.missions.daily.tasks)}/1`, done: metrics.missions.daily.tasks >= 1 },
        { label: 'Registrar um hábito', value: `${Math.min(1, metrics.missions.daily.habits)}/1`, done: metrics.missions.daily.habits >= 1 },
        { label: 'Focar por 25 minutos', value: `${Math.min(25, Math.round(metrics.missions.daily.focus))}/25 min`, done: metrics.missions.daily.focus >= 25 }
      ]),
      missionCard('Missão semanal', 30, metrics.missions.weekly.complete, [
        { label: 'Dias produtivos nos últimos 7 dias', value: `${metrics.missions.weekly.activeDays}/${metrics.missions.weekly.target}`, done: metrics.missions.weekly.complete },
        { label: 'Mantenha sua órbita ativa', value: percent(metrics.missions.weekly.activeDays / metrics.missions.weekly.target * 100), done: metrics.missions.weekly.complete }
      ])
    );
    host.appendChild(grid);
  }

  function barChart(host, rows, valueKey, formatter, tone) {
    host.replaceChildren();
    const chart = create('div', `ls-bars ${tone || ''}`.trim());
    const max = Math.max(1, ...rows.map(row => number(row[valueKey])));
    rows.forEach(row => {
      const column = create('span');
      const bar = create('i');
      const height = number(row[valueKey]) ? Math.max(4, number(row[valueKey]) / max * 100) : 2;
      bar.style.height = `${height}%`;
      bar.title = `${row.label}: ${formatter ? formatter(row[valueKey]) : row[valueKey]}`;
      append(column, bar, create('small', '', row.label));
      chart.appendChild(column);
    });
    host.appendChild(chart);
  }

  function groupedChart(host, rows) {
    host.replaceChildren();
    const legend = create('div', 'ls-chart-legend');
    [['tasks', 'Tarefas'], ['habits', 'Hábitos'], ['focus', 'Foco']].forEach(([key, label]) => {
      const item = create('span', key, label);
      legend.appendChild(item);
    });
    const chart = create('div', 'ls-grouped-bars');
    const maxTasks = Math.max(1, ...rows.map(row => row.tasks));
    const maxHabits = Math.max(1, ...rows.map(row => row.habits));
    const maxFocus = Math.max(1, ...rows.map(row => row.focus));
    rows.forEach(row => {
      const column = create('span');
      const bars = create('i');
      [['tasks', maxTasks], ['habits', maxHabits], ['focus', maxFocus]].forEach(([key, max]) => {
        const bar = create('u', key);
        bar.style.height = `${number(row[key]) ? Math.max(4, number(row[key]) / max * 100) : 1}%`;
        bar.title = `${row.label}: ${key === 'focus' ? formatDuration(row[key]) : row[key]}`;
        bars.appendChild(bar);
      });
      append(column, bars, create('small', '', row.label));
      chart.appendChild(column);
    });
    append(host, legend, chart);
  }

  function lineChart(host, rows, keys, formatter) {
    host.replaceChildren();
    const width = 640;
    const height = 190;
    const padX = 14;
    const padY = 18;
    const values = rows.flatMap(row => keys.map(key => number(row[key])));
    const max = Math.max(1, ...values);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Gráfico de evolução');
    const grid = document.createElementNS(svg.namespaceURI, 'path');
    grid.setAttribute('class', 'ls-svg-grid');
    grid.setAttribute('d', `M${padX} ${height * .3}H${width - padX}M${padX} ${height * .6}H${width - padX}M${padX} ${height - padY}H${width - padX}`);
    svg.appendChild(grid);
    keys.forEach(key => {
      const path = document.createElementNS(svg.namespaceURI, 'polyline');
      const denominator = Math.max(1, rows.length - 1);
      const points = rows.map((row, index) => {
        const x = padX + index / denominator * (width - padX * 2);
        const y = height - padY - number(row[key]) / max * (height - padY * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      path.setAttribute('points', points);
      path.setAttribute('class', `ls-line ls-line-${key}`);
      svg.appendChild(path);
    });
    const labels = create('div', 'ls-axis-labels');
    rows.forEach((row, index) => {
      if (rows.length > 8 && index % Math.ceil(rows.length / 6) && index !== rows.length - 1) return;
      labels.appendChild(create('span', '', row.label));
    });
    const legend = create('div', 'ls-chart-legend');
    keys.forEach(key => {
      const last = rows[rows.length - 1]?.[key] || 0;
      legend.appendChild(create('span', key, `${key === 'income' ? 'Ganhos' : key === 'expense' ? 'Gastos' : key === 'saved' ? 'Economia' : 'XP'} · ${formatter ? formatter(last) : last}`));
    });
    append(host, legend, svg, labels);
  }

  function renderCharts(root, context, metrics) {
    const state = context.state || {};
    const canvas = key => root.querySelector(`[data-stats-chart="${key}"] .ls-chart-canvas`);
    barChart(canvas('weekly'), metrics.week, 'score', value => Math.round(value), 'weekly');
    barChart(canvas('monthly'), metrics.month, 'score', value => Math.round(value), 'monthly');

    const completeHistory = arr(state.profile?.xpHistory);
    let runningXP = Math.max(0, number(state.profile?.xp) - completeHistory.reduce((sum, item) => sum + number(item?.amount), 0));
    const normalizedHistory = completeHistory.map((item, index) => {
      runningXP = item?.total !== undefined ? number(item.total) : Math.max(0, runningXP + number(item?.amount));
      const date = validDate(item?.date || item?.awardedAt);
      return {
        label: date?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') || String(index + 1),
        xp: runningXP
      };
    });
    const history = normalizedHistory.slice(-24);
    if (!history.length) history.push({ label: 'Hoje', xp: number(state.profile?.xp) });
    lineChart(canvas('xp'), history, ['xp'], value => `${value.toLocaleString('pt-BR')} XP`);
    barChart(canvas('focus'), metrics.week, 'focus', value => formatDuration(value), 'focus');
    barChart(canvas('habits'), metrics.week, 'habits', value => Math.round(value), 'habits');
    barChart(canvas('tasks'), metrics.week, 'tasks', value => Math.round(value), 'tasks');
    lineChart(canvas('finance'), metrics.finance.months, ['income', 'expense', 'saved'], value => compactMoney(value, context));

    const goalCanvas = canvas('goals');
    goalCanvas.replaceChildren();
    const goals = arr(state.goals).slice().sort((a, b) => number(b?.current) / Math.max(1, number(b?.target)) - number(a?.current) / Math.max(1, number(a?.target))).slice(0, 6);
    if (!goals.length) {
      goalCanvas.appendChild(create('div', 'ls-empty-chart', 'Crie uma meta para acompanhar o progresso aqui.'));
    } else goals.forEach(goal => {
      const progress = clamp(number(goal?.current) / Math.max(1, number(goal?.target)) * 100, 0, 100);
      const row = create('div', 'ls-goal-line');
      const top = create('div');
      append(top, create('b', '', `${goal?.emoji || '🎯'} ${goal?.name || 'Meta sem nome'}`), create('span', '', percent(progress)));
      const track = create('i');
      const fill = create('u');
      fill.style.width = `${progress}%`;
      if (/^#[0-9a-f]{6}$/i.test(String(goal?.color || ''))) fill.style.background = goal.color;
      track.appendChild(fill);
      append(row, top, track);
      goalCanvas.appendChild(row);
    });
  }

  function renderCalendar(root, context, metrics) {
    const scroll = root.querySelector('[data-stats-calendar] .ls-calendar-scroll');
    if (!scroll) return;
    scroll.replaceChildren();
    const calendar = create('div', 'ls-activity-calendar');
    const end = todayKey(context);
    for (let offset = 364; offset >= 0; offset -= 1) {
      const key = shiftDay(end, -offset);
      const score = metrics.activity.get(key)?.score || 0;
      const level = score <= 0 ? 0 : score < 2 ? 1 : score < 4 ? 2 : score < 7 ? 3 : 4;
      const cell = create('span', `level-${level}`);
      cell.title = `${dateLabel(key)} · ${Math.round(score)} ponto${Math.round(score) === 1 ? '' : 's'} de atividade`;
      cell.setAttribute('aria-label', cell.title);
      calendar.appendChild(cell);
    }
    const legend = create('div', 'ls-calendar-legend');
    legend.appendChild(create('span', '', 'Menos'));
    for (let level = 0; level <= 4; level += 1) legend.appendChild(create('i', `level-${level}`));
    legend.appendChild(create('span', '', 'Mais'));
    append(scroll, calendar, legend);
  }

  function renderAchievements(root, metrics) {
    const host = root.querySelector('[data-stats-metrics="achievements"]');
    if (!host) return;
    host.replaceChildren();
    [
      { icon: '🏆', label: 'Conquistas desbloqueadas', value: `${metrics.achievements.unlocked}/${metrics.achievements.total}`, hint: `${metrics.achievements.unlocked} badges permanentes` },
      { icon: metrics.achievements.latest?.badge || '✦', label: 'Última conquista', value: metrics.achievements.latest?.title || 'Nenhuma ainda', hint: metrics.achievements.latest ? dateLabel(metrics.achievements.latest.unlockedAt) : 'Seu primeiro marco aparecerá aqui' },
      { icon: '◇', label: 'Próxima conquista', value: metrics.achievements.next?.title || 'Todas desbloqueadas', hint: metrics.achievements.next?.description || 'Sua coleção está completa' }
    ].forEach(item => {
      const card = create('article', 'ls-metric ls-achievement-summary');
      const icon = create('i', '', item.icon);
      const content = create('div');
      append(content, create('span', '', item.label), create('strong', '', item.value), create('small', '', item.hint));
      append(card, icon, content);
      host.appendChild(card);
    });
    ACHIEVEMENTS.forEach(definition => {
      const unlocked = metrics.achievements.items.find(item => item.id === definition.id);
      const card = create('article', `ls-achievement ${unlocked ? 'unlocked' : 'locked'}`);
      append(card, create('i', '', unlocked ? definition.badge : '◇'));
      const content = create('div');
      append(content, create('span', '', unlocked ? 'DESBLOQUEADA' : `+${definition.xp} XP`), create('strong', '', definition.title), create('small', '', definition.description));
      if (unlocked) content.appendChild(create('time', '', dateLabel(unlocked.unlockedAt)));
      append(card, content);
      host.appendChild(card);
    });
  }

  function render(root, context) {
    if (!root) return null;
    if (context?.lifetimeActive === false) {
      root.replaceChildren();
      root.classList.add('luar-statistics');
      const locked = create('section', 'ls-locked');
      append(locked, create('i', '', '✦'), create('span', '', 'RECURSO VITALÍCIO'), create('h2', '', 'Estatísticas completas'), create('p', '', 'Ative o LUAR Vitalício para acompanhar toda a sua evolução e manter conquistas permanentes.'));
      root.appendChild(locked);
      return root;
    }
    if (root.dataset.statisticsReady !== '1') staticPage(root);
    bind(root, context || {});
    const accessChanged = registerAccess(context);
    const unlocked = evaluateAchievements(context);
    if (accessChanged && !unlocked.length) safeCall(context?.save);
    const metrics = computeMetrics(context);
    renderProfile(root, context);
    renderMissions(root, metrics);

    const sections = {
      general: [
        { icon: '◷', label: 'Dias usando o LUAR', value: metrics.general.daysUsing.toLocaleString('pt-BR'), hint: `Desde ${dateLabel(metrics.general.createdAt)}` },
        { icon: '⌖', label: 'Criação da conta', value: dateLabel(metrics.general.createdAt), hint: 'Primeiro registro da jornada' },
        { icon: '◉', label: 'Último acesso', value: dateTimeLabel(metrics.general.lastAccessAt), hint: `${metrics.general.accesses.toLocaleString('pt-BR')} acessos registrados` },
        { icon: '🔥', label: 'Sequência atual', value: `${metrics.general.currentStreak} dias`, hint: `Recorde de ${metrics.general.maxStreak} dias` },
        { icon: '✦', label: 'Nível e XP', value: `Nível ${metrics.general.level}`, hint: `${metrics.general.xp.toLocaleString('pt-BR')} XP · faltam ${metrics.general.xpNeeded.toLocaleString('pt-BR')}` },
        { icon: metrics.general.stage.icon, label: 'Universo atual', value: metrics.general.stage.name, hint: metrics.general.stage.description }
      ],
      productivity: [
        { icon: '☑', label: 'Tarefas criadas', value: metrics.tasks.created.toLocaleString('pt-BR'), hint: `${metrics.tasks.completed.toLocaleString('pt-BR')} concluídas` },
        { icon: '✓', label: 'Taxa de conclusão', value: percent(metrics.tasks.rate), hint: 'Tarefas concluídas sobre criadas' },
        { icon: '✿', label: 'Hábitos criados', value: metrics.habits.created.toLocaleString('pt-BR'), hint: `${metrics.habits.completed.toLocaleString('pt-BR')} registros feitos` },
        { icon: '🔥', label: 'Melhor sequência de hábito', value: `${metrics.habits.bestStreak} dias`, hint: 'Maior constância registrada' },
        { icon: '◷', label: 'Tempo total de foco', value: formatDuration(metrics.focus.totalMinutes), hint: `Média de ${formatDuration(metrics.focus.dailyAverage)} por dia` },
        { icon: '◈', label: 'Dias mais produtivos', value: metrics.productivity.topWeekdays.length ? metrics.productivity.topWeekdays.join(' e ') : '—', hint: metrics.productivity.topDates.length ? `Picos: ${metrics.productivity.topDates.join(' · ')}` : 'Ainda não há atividade suficiente' },
        { icon: '⌚', label: 'Horário de maior produtividade', value: metrics.productivity.peakHour, hint: `${metrics.productivity.productiveDays.toLocaleString('pt-BR')} dias ativos registrados` }
      ],
      finance: [
        { icon: '↗', label: 'Total de receitas', value: compactMoney(metrics.finance.income, context), tone: 'positive' },
        { icon: '↘', label: 'Total de despesas', value: compactMoney(metrics.finance.expenses, context), tone: 'negative' },
        { icon: '◈', label: 'Dinheiro guardado', value: compactMoney(metrics.finance.saved, context), hint: 'Saldo positivo mais patrimônio de metas' },
        { icon: '≈', label: 'Economia mensal média', value: compactMoney(metrics.finance.monthlyAverage, context), hint: 'Média dos últimos 12 meses' },
        { icon: '↑', label: 'Maior receita', value: compactMoney(metrics.finance.maxIncome, context), hint: `Maior despesa: ${compactMoney(metrics.finance.maxExpense, context)}` },
        { icon: '⇄', label: 'Total movimentado', value: compactMoney(metrics.finance.moved, context), hint: 'Soma de entradas e saídas' }
      ],
      goals: [
        { icon: '◎', label: 'Metas criadas', value: metrics.goals.created.toLocaleString('pt-BR') },
        { icon: '✓', label: 'Metas concluídas', value: metrics.goals.completed.toLocaleString('pt-BR') },
        { icon: '⋯', label: 'Em andamento', value: metrics.goals.inProgress.toLocaleString('pt-BR') },
        { icon: '◷', label: 'Tempo médio para concluir', value: metrics.goals.averageDays ? `${Math.round(metrics.goals.averageDays)} dias` : '—', hint: 'Considera metas com data de conclusão' },
        { icon: '✦', label: 'Categoria em destaque', value: metrics.goals.topCategory },
        { icon: '◉', label: 'Progresso geral', value: percent(metrics.goals.progress), hint: 'Valor acumulado sobre o total planejado' }
      ],
      diary: [
        { icon: '☺', label: 'Registros no diário', value: metrics.diary.entries.toLocaleString('pt-BR') },
        { icon: metrics.diary.commonMood, label: 'Humor mais frequente', value: metrics.diary.commonMood },
        { icon: '☆', label: 'Dias consecutivos', value: `${metrics.diary.streak} dias`, hint: 'Sequência atual de registros' }
      ]
    };
    Object.entries(sections).forEach(([key, items]) => {
      const host = root.querySelector(`[data-stats-metrics="${key}"]`);
      if (host) renderMetricCards(host, items);
    });
    renderAchievements(root, metrics);
    renderCharts(root, context, metrics);
    renderCalendar(root, context, metrics);
    const stagePill = root.querySelector('[data-stats-stage]');
    if (stagePill) {
      stagePill.replaceChildren(create('i', '', metrics.general.stage.icon), create('span', '', metrics.general.stage.name), create('b', '', `Nível ${metrics.general.level}`));
      stagePill.style.setProperty('--stage-color', metrics.general.stage.color);
    }
    return root;
  }

  function bind(root, context) {
    if (root.__luarStatisticsHandler) root.removeEventListener('click', root.__luarStatisticsHandler);
    const handler = event => {
      const button = event.target.closest('[data-stats-action]');
      if (!button || !root.contains(button) || button.disabled) return;
      const { profile } = normalizeProfile(context);
      const action = button.dataset.statsAction;
      const value = button.dataset.value;
      if (action === 'pick-avatar' || action === 'pick-banner') {
        root.querySelector(`[data-stats-file="${action === 'pick-avatar' ? 'avatar' : 'banner'}"]`)?.click();
        return;
      }
      if (action === 'clear-avatar' || action === 'clear-banner') {
        if (action === 'clear-avatar') delete profile.avatar;
        else delete profile.customBanner;
        safeCall(context?.save);
        safeCall(context?.refreshProfileMedia);
        renderProfile(root, context);
        safeCall(context?.toast, action === 'clear-avatar' ? 'Foto removida' : 'Banner removido', 'O visual padrão da conta foi restaurado.');
        return;
      }
      const type = action?.replace(/^set-/, '');
      const level = levelFromXP(profile.xp);
      const source = type === 'stage'
        ? STAGES.map(item => ({ ...item, level: item.min }))
        : type === 'badge'
          ? Object.values(profile.achievements || {}).filter(Boolean).map(item => ({ ...item, name: item.title, level: 1 }))
          : COSMETICS[`${type}s`] || [];
      const option = source.find(item => item.id === value);
      if (!option || number(option.level) > level) return;
      profile.cosmetics[type] = value;
      if (type === 'banner') delete profile.customBanner;
      safeCall(context?.save);
      renderProfile(root, context);
      safeCall(context?.toast, 'Perfil atualizado', `${option.name} agora faz parte do seu perfil cósmico.`);
    };
    root.__luarStatisticsHandler = handler;
    root.addEventListener('click', handler);
  }

  function build(root, context) {
    if (!root) throw new TypeError('LuarStatistics.build precisa de um elemento raiz.');
    if (context?.lifetimeActive === false) return render(root, context);
    staticPage(root);
    bind(root, context || {});
    return render(root, context || {});
  }

  window.LuarStatistics = Object.freeze({
    version: '1.0.0',
    stages: STAGES,
    achievements: ACHIEVEMENTS,
    cosmetics: COSMETICS,
    xpForLevel,
    levelFromXP,
    xpProgress,
    stageForLevel,
    stageForXP,
    unlockedStages,
    grantXP,
    evaluateMissions,
    computeMetrics,
    build,
    buildProfile,
    render,
    renderProfile,
    evaluateAchievements
  });
})();
