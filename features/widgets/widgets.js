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
    const streak = widget.type === "habit" ? calculateHabitStreak(item) : 0, finished = complete(widget, item), message = finished ? "Você conseguiu!" : widget.type === "habit" ? streak ? "Continue brilhando!" : "Comece sua sequência!" : item.date ? "Uma missão espera por você!" : "Vamos tirar isso da órbita?", score = widget.type === "habit" ? streak : finished ? 1 : 0;
    card.dataset.widgetMood = finished ? "happy" : streak ? "focused" : "waiting";
    card.innerHTML = `<div class="widget-visual"><div class="widget-score"><i>${widget.type === "habit" ? "◆" : "✓"}</i><strong>${score}</strong></div><p>${message}</p><img src="widget-luar-companion-v1.webp" alt="Mascote Luar acompanhando seu progresso"></div><header><i>${icon(widget.type)}</i><span><small>${label(widget.type).toUpperCase()}</small><b></b></span><button type="button" data-widget-config aria-label="Configurar widget">•••</button></header><footer><button type="button" class="widget-complete">${finished ? "✓ Concluído hoje" : widget.type === "task" ? "Concluir tarefa" : "Marcar como feito"}</button><span>${widget.type === "habit" ? `${streak} dia${streak === 1 ? "" : "s"} de sequência` : item.date ? `Prazo ${formatDate(item.date)}` : "Sem prazo"}</span></footer><nav aria-label="Ordenar widget"><button type="button" data-widget-move="-1" ${index === 0 ? "disabled" : ""}>←</button><button type="button" data-widget-move="1" ${index === widgets().length - 1 ? "disabled" : ""}>→</button><button type="button" data-widget-remove>Remover</button></nav>`;
    card.querySelector("header b").textContent = item.name;
    return card;
  }

  function bindCards(root) {
    root.querySelectorAll("[data-widget-id]").forEach(card => { const widget = widgets().find(item => item.id === card.dataset.widgetId); if (!widget) return; card.querySelector(".widget-complete")?.addEventListener("click", () => toggle(widget)); card.querySelector("[data-widget-remove]")?.addEventListener("click", () => remove(widget.id)); card.querySelectorAll("[data-widget-move]").forEach(button => button.addEventListener("click", () => move(widget.id, Number(button.dataset.widgetMove)))); card.querySelector("[data-widget-config]")?.addEventListener("click", () => showPage("widgets")); });
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
    const current = page.querySelector("#widgetSettingsCurrent"); widgets().forEach((widget, index) => current.appendChild(renderCard(widget, index))); if (!widgets().length) current.innerHTML = `<div class="widget-config-empty"><b>Nenhum widget fixado</b><small>Escolha uma tarefa ou hábito ao lado.</small></div>`; bindCards(current);
  }

  function calculateHabitStreak(habit) { let count = 0, cursor = new Date(); const days = new Set(habit.history || []); while (days.has(dateKey(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); } return count; }
  function render() { renderDashboard(); renderSettings(); }
  window.LuarWidgets = { render };
  document.addEventListener("DOMContentLoaded", render, { once: true });
  setTimeout(render, 0);
})();
