"use strict";

const number = (value) => Number.isFinite(+value) ? +value : 0;
const dateKey = (value = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const monthKey = () => dateKey().slice(0, 7);
const transactionsSummary = (items) => items.reduce((summary, item) => {
  const amount = Math.max(0, number(item.amount));
  if (item.type === "income") summary.income += amount;
  if (item.type === "expense") summary.spending += amount;
  if (item.type === "purchase") summary.purchases += amount;
  return summary;
}, { income: 0, spending: 0, purchases: 0 });
const goalSaved = (goals) => goals.reduce((sum, goal) => sum + Math.max(0, number(goal.current)), 0);
const newest = (items, limit = 5) => [...items].sort((a, b) => Date.parse(b.createdAt || b.date || 0) - Date.parse(a.createdAt || a.date || 0)).slice(0, limit);

function dashboardView(state = {}) {
  const transactions = Array.isArray(state.transactions) ? state.transactions : [];
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const habits = Array.isArray(state.habits) ? state.habits : [];
  const today = dateKey(), month = monthKey();
  const total = transactionsSummary(transactions);
  const monthly = transactionsSummary(transactions.filter((item) => String(item.date || item.createdAt || "").slice(0, 7) === month));
  const saved = goalSaved(goals), monthlyExpense = monthly.spending + monthly.purchases;
  const todayTasks = tasks.filter((task) => !task.date || task.date === today || (task.completedAt && dateKey(task.completedAt) === today));
  const completedTasks = todayTasks.filter((task) => task.completed).length;
  const completedHabits = habits.filter((habit) => Array.isArray(habit.history) && habit.history.includes(today)).length;
  const activityTotal = todayTasks.length + habits.length, activityDone = completedTasks + completedHabits;
  return {
    generatedAt: new Date().toISOString(),
    totals: { income: total.income, expense: total.spending + total.purchases, goalSaved: saved, balance: total.income - total.spending - total.purchases, wealth: total.income - total.spending - total.purchases + saved },
    month: { income: monthly.income, spending: monthly.spending, purchases: monthly.purchases, expense: monthlyExpense, balance: monthly.income - monthlyExpense },
    activity: { total: activityTotal, done: activityDone, percent: activityTotal ? Math.round(activityDone / activityTotal * 100) : 0, habitsTotal: habits.length, habitsDone: completedHabits },
    goals: newest(goals).map((goal) => ({ id: String(goal.id || ""), name: String(goal.name || "Meta sem nome").slice(0, 120), emoji: String(goal.emoji || "🎯").slice(0, 8), color: /^#[0-9a-f]{6}$/i.test(goal.color) ? goal.color : "#32ff7e", current: Math.max(0, number(goal.current)), target: Math.max(0, number(goal.target)) })),
    pendingHabitIds: habits.filter((habit) => !Array.isArray(habit.history) || !habit.history.includes(today)).map((habit) => String(habit.id || "")),
  };
}

module.exports = { dashboardView };
