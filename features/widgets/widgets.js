(() => {
  const widgets = () => {
    state.profile = state.profile || {};
    state.profile.dashboardWidgets = Array.isArray(state.profile.dashboardWidgets) ? state.profile.dashboardWidgets : [];
    return state.profile.dashboardWidgets;
  };
  const limit = () => Math.max(1, typeof accountWidgetLimit === "number" ? accountWidgetLimit : lifetimeActive ? 3 : 1);
  const record = widget => (widget.type === "task" ? state.tasks : state.habits).find(item => item.id === widget.recordId);
  const complete = (widget, item) => widget.type === "task" ? !!item?.completed : (item?.history || []).includes(today());
  const label = type => type === "task" ? "Tarefa" : "Hábito";
  const icon = type => type === "task" ? "✓" : "✦";
  const HABIT_MOODS = {
    happy: { face: "✦‿✦", message: "Você conseguiu!", label: "Feliz" },
    normal: { face: "•‿•", message: "Tudo tranquilo por enquanto.", label: "Normal" },
    unhappy: { face: "•︵•", message: "O Luar está esperando...", label: "Insatisfeito" },
    sad: { face: "╥︵╥", message: "Ele ficou triste sem seu hábito.", label: "Triste" },
    confused: { face: "?︵?", message: "Será que você esqueceu?", label: "Confuso" },
    angry: { face: "ಠ︵ಠ", message: "O atraso deixou o Luar bravo.", label: "Raivoso" },
    extreme: { face: "🔥ಠ益ಠ🔥", message: "Faça agora: raiva lunar máxima!", label: "Raiva extrema" }
  };
  function habitMood(item, finished) {
    if (finished) return "happy";
    const now = new Date(), key = today(), missedYesterday = (() => { const date = new Date(); date.setDate(date.getDate() - 1); return !(item.history || []).includes(dateKey(date)); })();
    let due = new Date(`${key}T${item.time && /^\d{2}:\d{2}$/.test(item.time) ? item.time : "12:00"}:00`), hours = (now - due) / 3600000;
    if (hours <= 0) return "normal";
    if (missedYesterday && hours > 8) return "extreme";
    if (hours <= 1) return "unhappy";
    if (hours <= 3) return "sad";
    if (hours <= 6) return "confused";
    if (hours <= 10) return "angry";
    return "extreme";
  }

  const persist = () => { writeLocalState(); scheduleCloudSave(); render(); };
  const remove = id => { state.profile.dashboardWidgets = widgets().filter(item => item.id !== id); persist(); toast("Widget removido", "O registro continua salvo na área original."); };
  const move = (id, direction) => { const list = widgets(), from = list.findIndex(item => item.id === id), to = from + direction; if (from < 0 || to < 0 || to >= list.length) return; [list[from], list[to]] = [list[to], list[from]]; list.forEach((item, index) => item.position = index); persist(); };
  const toggle = widget => { const item = record(widget); if (!item) return; act("complete", widget.type === "task" ? "tasks" : "habits", item.id); };

  function renderCard(widget, index) {
    const item = record(widget), card = document.createElement("article");
    card.className = `dashboard-record-widget ${item && complete(widget, item) ? "done" : ""}`;
    card.dataset.widgetId = widget.id;
    if (!item) {
      card.innerHTML = `<div class="widget-orphan"><i>?</i><span><small>ITEM INDISPONÍVEL</small><b>Este registro foi removido</b><em>Escolha outro item ou remova o widget.</em></span></div><button type="button" data-widget-remove>Remover</button>`;
      return card;
    }
    const streak = widget.type === "habit" ? calculateHabitStreak(item) : 0, finished = complete(widget, item), mood = widget.type === "habit" ? habitMood(item, finished) : finished ? "happy" : "waiting", moodInfo = HABIT_MOODS[mood], message = widget.type === "habit" ? moodInfo.message : finished ? "Você conseguiu!" : item.date ? "Uma missão espera por você!" : "Vamos tirar isso da órbita?", score = widget.type === "habit" ? streak : finished ? 1 : 0;
    card.dataset.widgetMood = mood;
    card.tabIndex = 0; card.setAttribute("role", "button"); card.setAttribute("aria-expanded", "false"); card.setAttribute("aria-label", `${label(widget.type)}: ${item.name}. Toque para ver os detalhes.`);
    card.innerHTML = `<div class="widget-visual"><img src="widget-luar-companion-v1.webp" alt="Mascote Luar ${widget.type === "habit" ? moodInfo.label.toLowerCase() : "acompanhando seu progresso"}">${widget.type === "habit" ? `<span class="widget-face" aria-label="Luar ${moodInfo.label}">${moodInfo.face}</span>` : ""}<div class="widget-score"><i>${widget.type === "habit" ? "◆" : finished ? "✓" : "○"}</i><strong>${widget.type === "habit" ? streak : finished ? "Feita" : "Pendente"}</strong></div>${widget.type === "habit" && finished ? '<span class="widget-happy-mark" aria-hidden="true">✦ ✦ ✦</span>' : ""}</div><header><i>${icon(widget.type)}</i><span><small>${widget.type === "habit" ? moodInfo.label.toUpperCase() : label(widget.type).toUpperCase()}</small><b></b><em>${message}</em></span><button type="button" data-widget-config aria-label="Configurar widget">•••</button></header>${widget.type === "habit" ? `<button type="button" class="widget-habit-done" ${finished ? "disabled" : ""}>${finished ? "✓ Feito hoje" : "✓ Já fiz hoje"}</button>` : '<small class="widget-open-hint">Toque para abrir</small>'}<p class="widget-detail-copy"></p><footer><button type="button" class="widget-complete">${finished ? "✓ Concluído hoje" : widget.type === "task" ? "Concluir tarefa" : "Marcar como feito"}</button><span>${widget.type === "habit" ? `${streak} dia${streak === 1 ? "" : "s"} de sequência` : item.date ? `Prazo ${formatDate(item.date)}` : "Sem prazo"}</span></footer><nav aria-label="Ordenar widget"><button type="button" data-widget-move="-1" ${index === 0 ? "disabled" : ""}>←</button><button type="button" data-widget-move="1" ${index === widgets().length - 1 ? "disabled" : ""}>→</button><button type="button" data-widget-remove>Remover</button></nav>`;
    card.querySelector("header b").textContent = item.name;
    card.querySelector(".widget-detail-copy").textContent = item.description || item.category || (widget.type === "task" ? "Seu próximo passo importante." : "Continue construindo sua constância.");
    return card;
  }

  function bindCards(root) {
    root.querySelectorAll(".dashboard-record-widget[data-widget-id]").forEach(card => { const widget = widgets().find(item => item.id === card.dataset.widgetId); if (!widget) return; const reveal = () => { const open = card.classList.toggle("is-open"); card.setAttribute("aria-expanded", String(open)); }; card.onclick = event => { if (!event.target.closest("button,nav")) reveal(); }; card.onkeydown = event => { if ((event.key === "Enter" || event.key === " ") && event.target === card) { event.preventDefault(); reveal(); } }; card.querySelector(".widget-complete")?.addEventListener("click", () => toggle(widget)); card.querySelector(".widget-habit-done")?.addEventListener("click", event => { if (event.currentTarget.disabled || complete(widget, record(widget))) return; toggle(widget); }); card.querySelector("[data-widget-remove]")?.addEventListener("click", () => remove(widget.id)); card.querySelectorAll("[data-widget-move]").forEach(button => button.addEventListener("click", () => move(widget.id, Number(button.dataset.widgetMove)))); card.querySelector("[data-widget-config]")?.addEventListener("click", () => showPage("widgets")); });
  }

  function renderManageRow(widget, index) {
    const item = record(widget), row = document.createElement("article"); row.className = "widget-manage-row"; row.dataset.widgetManageId = widget.id; row.innerHTML = `<i>${icon(widget.type)}</i><span><small>${label(widget.type).toUpperCase()}</small><b></b></span><nav aria-label="Alterar ordem do widget"><button type="button" data-widget-move="-1" aria-label="Mover para a esquerda" ${index === 0 ? "disabled" : ""}>←</button><button type="button" data-widget-move="1" aria-label="Mover para a direita" ${index === widgets().length - 1 ? "disabled" : ""}>→</button><button type="button" data-widget-remove>Remover</button></nav>`; row.querySelector("b").textContent = item?.name || "Item removido"; row.querySelector("[data-widget-remove]").onclick = () => remove(widget.id); row.querySelectorAll("[data-widget-move]").forEach(button => button.onclick = () => move(widget.id, Number(button.dataset.widgetMove))); return row;
  }

  function renderDashboard() {
    const root = document.getElementById("dashboardWidgetZone"); if (!root) return;
    root.replaceChildren();
    widgets().forEach((widget, index) => root.appendChild(renderCard(widget, index)));
    if (widgets().length < limit()) { const add = document.createElement("button"); add.className = "dashboard-widget-add"; add.type = "button"; add.innerHTML = `<i>＋</i><span><b>Fixar tarefa ou hábito</b><small>${widgets().length} de ${limit()} widgets em uso</small></span>`; add.onclick = () => showPage("widgets"); root.appendChild(add); }
    root.hidden = false; bindCards(root);
  }

  function addWidget(type, recordId) {
    const list = widgets();
    if (list.length >= limit()) { if (!lifetimeActive) showPremiumGate("Mais widgets na Visão Geral", "O plano Gratuito permite 1 widget. No Vitalício, você pode fixar até 3 tarefas ou hábitos."); else toast("Limite atingido", `Seu limite atual é de ${limit()} widgets.`); return; }
    if (list.some(item => item.type === type && item.recordId === recordId)) return toast("Widget já adicionado", "Este item já está na sua Visão Geral.");
    const source = type === "task" ? state.tasks : state.habits;
    if (!source.some(item => item.id === recordId)) return toast("Item indisponível", "Escolha uma tarefa ou hábito existente.");
    list.push({ id: `widget-${id()}`, type, recordId, position: list.length }); persist(); toast("Widget adicionado", "Ele já aparece no topo da Visão Geral.");
  }

  function renderSettings() {
    const page = document.getElementById("widgets"); if (!page) return;
    const tasks = state.tasks.filter(item => !item.completed), habits = state.habits;
    page.innerHTML = `<div class="page-head"><div><span>PERSONALIZAÇÃO</span><h2>Widgets da Visão Geral</h2><p>Fixe tarefas e hábitos para acompanhar e concluir sem sair do painel.</p></div><button class="secondary" type="button" data-page="dashboard">Ver Visão Geral</button></div><section class="widget-config-hero"><img src="widget-luar-companion-v1.webp" alt="Luar, personagem em forma de lua crescente apontando para uma estrela"><div><span>SUA ÓRBITA EM DESTAQUE</span><h3>O que merece ficar sempre à vista?</h3><p>Escolha uma tarefa ou hábito. O widget usa o registro original e sincroniza pela sua conta.</p><strong>${widgets().length} / ${limit()} <small>widgets utilizados</small></strong></div></section><div class="widget-config-layout"><section class="card widget-picker"><header><span>ADICIONAR WIDGET</span><h3>Escolha o tipo e o registro</h3></header><div class="widget-type-tabs"><button type="button" class="active" data-widget-tab="task">✓ Tarefas</button><button type="button" data-widget-tab="habit">✦ Hábitos</button></div><div class="widget-record-options" data-widget-options="task"></div><div class="widget-record-options" data-widget-options="habit" hidden></div></section><section class="card widget-current"><header><span>ORDEM ATUAL</span><h3>Widgets fixados</h3></header><div id="widgetSettingsCurrent"></div></section></div>`;
    const fill = (type, items) => { const host = page.querySelector(`[data-widget-options="${type}"]`); if (!items.length) { host.innerHTML = `<div class="widget-config-empty"><b>Nenhum item disponível</b><small>Crie ${type === "task" ? "uma tarefa" : "um hábito"} primeiro.</small></div>`; return; } items.forEach(item => { const button = document.createElement("button"); button.type = "button"; button.innerHTML = `<i>${icon(type)}</i><span><b></b><small></small></span><em>＋ Fixar</em>`; button.querySelector("b").textContent = item.name; button.querySelector("small").textContent = item.category || (type === "task" ? "Tarefa" : "Hábito"); button.onclick = () => addWidget(type, item.id); host.appendChild(button); }); };
    fill("task", tasks); fill("habit", habits);
    page.querySelectorAll("[data-widget-tab]").forEach(button => button.onclick = () => { page.querySelectorAll("[data-widget-tab]").forEach(item => item.classList.toggle("active", item === button)); page.querySelectorAll("[data-widget-options]").forEach(host => host.hidden = host.dataset.widgetOptions !== button.dataset.widgetTab); });
    const current = page.querySelector("#widgetSettingsCurrent"); widgets().forEach((widget, index) => current.appendChild(renderManageRow(widget, index))); if (!widgets().length) current.innerHTML = `<div class="widget-config-empty"><b>Nenhum widget fixado</b><small>Escolha uma tarefa ou hábito ao lado.</small></div>`;
  }

  function calculateHabitStreak(habit) { let count = 0, cursor = new Date(); const days = new Set(habit.history || []); while (days.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); } return count; }
  function render() { renderDashboard(); renderSettings(); window.LuarIdeaMap?.renderDashboard?.(); }
  window.LuarWidgets = { render };
  document.addEventListener("DOMContentLoaded", render, { once: true });
  setTimeout(render, 0);
  setInterval(() => { if (document.body.classList.contains("app-mode")) renderDashboard(); }, 60000);
})();
