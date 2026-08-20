(() => {
  const domains = { knowledge: "Notas e ideias", finance: "Financeiro" };
  const cache = new Map();
  const pendingLists = new Map();
  let activeDomain = "knowledge", editingId = null, modal = null, pendingPicker = null;
  const normalizedName = value => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  const legacyCategories = domain => {
    if (typeof state === "undefined") return [];
    const records = domain === "finance" ? state.transactions : state.notes, names = new Map();
    (Array.isArray(records) ? records : []).forEach(record => {
      if (record?.categoryId || !String(record?.category || "").trim()) return;
      const name = String(record.category).trim(), key = normalizedName(name);
      if (key && !names.has(key)) names.set(key, { name, key });
    });
    return [...names.values()];
  };
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const api = async (domain, options = {}) => {
    const request = { method: options.method || "GET", ...(options.body ? { body: JSON.stringify(options.body) } : {}) };
    const url = `/api/account-state?resource=categories&domain=${encodeURIComponent(domain)}`;
    const response = typeof accountApiFetch === "function" ? await accountApiFetch(url, request) : await fetch(url, request);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível acessar as categorias.");
    return result;
  };
  const list = async (domain, force = false) => {
    if (!domains[domain]) throw new Error("Domínio de categoria inválido.");
    if (pendingLists.has(domain)) return pendingLists.get(domain);
    if (!force && cache.has(domain)) return cache.get(domain);
    const request = api(domain).then(result => {
      const categories = Array.isArray(result.categories) ? result.categories : [];
      cache.set(domain, categories);
      return categories;
    });
    pendingLists.set(domain, request);
    try { return await request; }
    finally { if (pendingLists.get(domain) === request) pendingLists.delete(domain); }
  };
  const ensureModal = () => {
    if (modal) return modal;
    modal = make("div", "category-manager-layer"); modal.hidden = true; modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<section class="category-manager" role="dialog" aria-modal="true" aria-labelledby="categoryManagerTitle"><header><div><span>CATEGORIAS</span><h2 id="categoryManagerTitle">Organize do seu jeito</h2><p>Crie identidades reutilizáveis sem misturar notas e finanças.</p></div><button type="button" class="category-close" aria-label="Fechar">×</button></header><nav class="category-domains" aria-label="Área das categorias"></nav><div class="category-manager-grid"><section class="category-list-panel"><label class="category-search"><span>⌕</span><input type="search" placeholder="Pesquisar categorias" aria-label="Pesquisar categorias"></label><div class="category-list" role="list"></div><p class="category-empty" hidden>Nenhuma categoria nesta área.</p></section><form class="category-form"><span class="category-form-kicker">NOVA CATEGORIA</span><h3>Crie uma identidade</h3><input type="hidden" name="id"><label>Nome<input name="name" maxlength="60" required autocomplete="off" placeholder="Ex.: Estudos"></label><div class="category-form-pair"><label>Ícone<input name="icon" maxlength="16" value="◇" required autocomplete="off" aria-label="Ícone da categoria"></label><label>Cor<input name="color" type="color" value="#32ff7e" aria-label="Cor da categoria"></label></div><label class="category-default"><input name="isDefault" type="checkbox"><span>Usar como categoria padrão nesta área</span></label><div class="category-form-actions"><button type="button" class="secondary category-cancel" hidden>Cancelar edição</button><button type="submit" class="primary">Salvar categoria</button></div><small class="category-status" role="status" aria-live="polite"></small></form></div></section>`;
    document.body.appendChild(modal);
    const nav = modal.querySelector(".category-domains");
    Object.entries(domains).forEach(([domain, label]) => { const button = make("button", "", label); button.type = "button"; button.dataset.categoryDomain = domain; button.onclick = () => switchDomain(domain); nav.appendChild(button); });
    modal.querySelector(".category-close").onclick = close;
    modal.addEventListener("click", event => { if (event.target === modal) close(); });
    modal.querySelector(".category-search input").addEventListener("input", renderList);
    modal.querySelector(".category-cancel").onclick = resetForm;
    modal.querySelector("form").addEventListener("submit", submitForm);
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) close(); });
    return modal;
  };
  const resetForm = () => {
    editingId = null; const form = ensureModal().querySelector("form"); form.reset(); form.elements.icon.value = "◇"; form.elements.color.value = "#32ff7e";
    form.querySelector(".category-form-kicker").textContent = "NOVA CATEGORIA"; form.querySelector("h3").textContent = "Crie uma identidade"; form.querySelector(".category-cancel").hidden = true; form.querySelector(".category-status").textContent = "";
  };
  const edit = category => {
    editingId = category.id; const form = ensureModal().querySelector("form"); form.elements.id.value = category.id; form.elements.name.value = category.name; form.elements.icon.value = category.icon; form.elements.color.value = category.color; form.elements.isDefault.checked = category.is_default === true;
    form.querySelector(".category-form-kicker").textContent = "EDITAR CATEGORIA"; form.querySelector("h3").textContent = category.name; form.querySelector(".category-cancel").hidden = false; form.elements.name.focus();
  };
  const remove = async category => {
    if (!window.confirm(`Excluir a categoria “${category.name}”? Os registros existentes não serão apagados.`)) return;
    try { await api(activeDomain, { method: "DELETE", body: { id: category.id } }); cache.delete(activeDomain); window.dispatchEvent(new CustomEvent("luar:categories-changed", { detail: { domain: activeDomain } })); if (editingId === category.id) resetForm(); await renderList(); if (typeof toast === "function") toast("Categoria removida", "Seus registros continuam preservados."); }
    catch (error) { ensureModal().querySelector(".category-status").textContent = error.message; }
  };
  const importLegacy = async legacy => {
    const status = ensureModal().querySelector(".category-status");
    status.textContent = `Reutilizando ${legacy.name}…`;
    try {
      const result = await api(activeDomain, { method: "POST", body: { domain: activeDomain, name: legacy.name, icon: "◇", color: "#32ff7e", isDefault: false } });
      const created = result.category || null, records = activeDomain === "finance" ? state.transactions : state.notes;
      if (created) {
        (records || []).forEach(record => { if (!record.categoryId && normalizedName(record.category) === legacy.key) record.categoryId = created.id; });
        if (typeof writeLocalState === "function") writeLocalState();
        if (typeof scheduleCloudSave === "function") scheduleCloudSave();
      }
      cache.delete(activeDomain);
      window.dispatchEvent(new CustomEvent("luar:categories-changed", { detail: { domain: activeDomain, category: created } }));
      await renderList(true);
      if (typeof toast === "function") toast("Categoria reutilizada", `${legacy.name} agora está disponível em novos registros.`);
    } catch (error) { status.textContent = error.message; }
  };
  const renderList = async (force = false) => {
    const layer = ensureModal(), container = layer.querySelector(".category-list"), empty = layer.querySelector(".category-empty"), query = layer.querySelector(".category-search input").value.trim().toLocaleLowerCase("pt-BR");
    container.replaceChildren(make("div", "category-loading", "Carregando…"));
    try {
      const allCategories = await list(activeDomain, force), knownNames = new Set(allCategories.map(item => normalizedName(item.name)));
      const categories = allCategories.filter(item => !query || item.name.toLocaleLowerCase("pt-BR").includes(query)); container.replaceChildren();
      categories.forEach(category => { const row = make("article", "category-row"); row.setAttribute("role", "listitem"); const mark = make("i", "category-mark", category.icon); mark.style.setProperty("--category-color", category.color); const identity = make("div", "category-identity"); identity.append(make("b", "", category.name), make("small", "", category.is_default ? "Categoria padrão" : domains[category.domain])); const actions = make("div", "category-row-actions"), editButton = make("button", "", "Editar"), deleteButton = make("button", "category-delete", "Excluir"); editButton.type = deleteButton.type = "button"; editButton.onclick = () => edit(category); deleteButton.onclick = () => remove(category); actions.append(editButton, deleteButton); row.append(mark, identity, actions); container.appendChild(row); });
      const legacy = legacyCategories(activeDomain).filter(item => !knownNames.has(item.key) && (!query || item.key.includes(query)));
      legacy.forEach(item => { const row = make("article", "category-row category-row-legacy"); row.setAttribute("role", "listitem"); const mark = make("i", "category-mark", "◇"); mark.style.setProperty("--category-color", "#829087"); const identity = make("div", "category-identity"); identity.append(make("b", "", item.name), make("small", "", "Já usada em registros anteriores")); const actions = make("div", "category-row-actions"), reuse = make("button", "", "Reutilizar"); reuse.type = "button"; reuse.onclick = () => importLegacy(item); actions.append(reuse); row.append(mark, identity, actions); container.appendChild(row); });
      empty.hidden = categories.length + legacy.length > 0;
    } catch (error) { container.replaceChildren(); empty.hidden = false; empty.textContent = error.message; }
  };
  const submitForm = async event => {
    event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('[type="submit"]'), status = form.querySelector(".category-status"); submit.disabled = true; status.textContent = editingId ? "Atualizando…" : "Criando…";
    try { const result = await api(activeDomain, { method: editingId ? "PUT" : "POST", body: { id: editingId || undefined, domain: activeDomain, name: form.elements.name.value, icon: form.elements.icon.value, color: form.elements.color.value, isDefault: form.elements.isDefault.checked } }); cache.delete(activeDomain); window.dispatchEvent(new CustomEvent("luar:categories-changed", { detail: { domain: activeDomain, category: result.category || null } })); resetForm(); await renderList(); if (typeof toast === "function") toast("Categoria salva", "A identidade já está disponível nesta área."); }
    catch (error) { status.textContent = error.message; } finally { submit.disabled = false; }
  };
  const switchDomain = async domain => { activeDomain = domain; resetForm(); ensureModal().querySelectorAll("[data-category-domain]").forEach(button => button.classList.toggle("active", button.dataset.categoryDomain === domain)); await renderList(true); };
  const open = async (domain = "knowledge") => { if (typeof currentUser !== "undefined" && !currentUser) { if (typeof openAuth === "function") openAuth("login"); return; } const layer = ensureModal(); layer.hidden = false; layer.setAttribute("aria-hidden", "false"); document.body.classList.add("category-manager-open"); await switchDomain(domains[domain] ? domain : "knowledge"); layer.querySelector(".category-close").focus(); };
  const close = () => { if (!modal) return; pendingPicker = null; modal.hidden = true; modal.setAttribute("aria-hidden", "true"); document.body.classList.remove("category-manager-open"); resetForm(); };
  const createPicker = async ({ domain = "knowledge", value = "", legacyValue = "", fieldName = "categoryId", legacyName = "category", onChange = () => {} } = {}) => {
    const wrapper = make("div", "category-picker"), select = make("select"), hidden = make("input"), manage = make("button", "secondary", "Gerenciar");
    select.name = fieldName; select.setAttribute("aria-label", "Categoria"); hidden.type = "hidden"; hidden.name = legacyName; hidden.value = legacyValue || ""; manage.type = "button"; manage.textContent = "＋ Nova"; manage.onclick = () => { pendingPicker = wrapper; open(domain); };
    wrapper.dataset.categoryPicker = domain;
    wrapper.refresh = async () => {
      const categories = await list(domain, true), selectedId = select.value || value;
      select.replaceChildren(new Option("Sem categoria", ""), ...categories.map(item => new Option(`${item.icon} ${item.name}`, item.id)));
      if (selectedId && categories.some(item => item.id === selectedId)) select.value = selectedId;
      else if (hidden.value) { const legacy = new Option(`${hidden.value} · categoria antiga`, ""); legacy.dataset.legacy = hidden.value; select.appendChild(legacy); legacy.selected = true; }
      else { const preferred = categories.find(item => item.is_default); if (preferred) { select.value = preferred.id; hidden.value = preferred.name; value = preferred.id; } }
    };
    select.onchange = () => { const categories = cache.get(domain) || [], category = categories.find(item => item.id === select.value), legacy = select.selectedOptions[0]?.dataset.legacy; value = category?.id || ""; hidden.value = category?.name || legacy || ""; onChange(category?.id || null, category || null); };
    wrapper.append(select, hidden, manage); await wrapper.refresh();
    const changed = event => { if (event.detail?.domain === domain && wrapper.isConnected) { if (pendingPicker === wrapper && event.detail.category) { value = event.detail.category.id; hidden.value = event.detail.category.name; pendingPicker = null; } wrapper.refresh().catch(() => null); } else if (!wrapper.isConnected) window.removeEventListener("luar:categories-changed", changed); };
    window.addEventListener("luar:categories-changed", changed);
    return wrapper;
  };

  let noteCategoryFilter = "all";
  const noteById = id => (typeof state !== "undefined" && Array.isArray(state.notes) ? state.notes.find(note => note.id === id) : null);
  const refreshNoteFilter = async select => {
    const current = noteCategoryFilter, categories = await list("knowledge", true), legacy = [...new Set((state.notes || []).filter(note => !note.categoryId && note.category).map(note => note.category))];
    select.replaceChildren(new Option("Todas as categorias", "all"), new Option("Sem categoria", "none"), ...categories.map(item => new Option(`${item.icon} ${item.name}`, item.id)), ...legacy.map(name => new Option(`${name} · antiga`, `legacy:${name}`)));
    select.value = [...select.options].some(option => option.value === current) ? current : "all"; noteCategoryFilter = select.value; applyNoteFilter();
  };
  const applyNoteFilter = () => document.querySelectorAll("#notesList .note-square[data-record-id]").forEach(card => { const note = noteById(card.dataset.recordId); if (!note) return; card.hidden = !(noteCategoryFilter === "all" || (noteCategoryFilter === "none" && !note.categoryId && !note.category) || note.categoryId === noteCategoryFilter || noteCategoryFilter === `legacy:${note.category || ""}`); });
  const decorateNotes = async () => {
    if (typeof state === "undefined") return; const categories = await list("knowledge"), byId = new Map(categories.map(item => [item.id, item]));
    document.querySelectorAll("#notesList .note-square[data-record-id]").forEach(card => { const note = noteById(card.dataset.recordId), category = note?.categoryId ? byId.get(note.categoryId) : null, signature = `${note?.categoryId || ""}:${category?.updated_at || ""}`; if (!note || card.dataset.categoryDecorated === signature) return; card.dataset.categoryDecorated = signature; const label = card.querySelector(":scope > small"); if (label) label.textContent = category ? `${category.icon} ${category.name}` : note.category || "Sem categoria"; if (category) card.style.setProperty("--category-accent", category.color); else card.style.removeProperty("--category-accent"); }); applyNoteFilter();
  };
  const enhanceNoteForm = async () => {
    if (typeof edit === "undefined" || edit.entity !== "notes") return; const form = document.getElementById("entityForm"), old = form?.elements?.category; if (!form || !old || form.querySelector('[data-note-category-field="true"]')) return;
    const item = edit.id ? state.notes.find(note => note.id === edit.id) : null, label = old.closest("label"), picker = await createPicker({ domain: "knowledge", value: item?.categoryId || "", legacyValue: item?.category || old.value || "" });
    label.dataset.noteCategoryField = "true"; label.replaceChildren(document.createTextNode("Categoria"), picker);
  };
  const enhanceNotes = () => {
    const panel = document.querySelector("#notes .notes-board .panel-head"); if (panel && !panel.querySelector("[data-note-category-filter]")) { const select = make("select", "note-category-filter"); select.dataset.noteCategoryFilter = "true"; select.setAttribute("aria-label", "Filtrar notas por categoria"); select.onchange = () => { noteCategoryFilter = select.value; applyNoteFilter(); }; panel.querySelector(".mini-search")?.before(select); refreshNoteFilter(select).catch(() => null); }
    decorateNotes().catch(() => null); enhanceNoteForm().catch(() => null);
  };
  let financeCategoryFilter = "all";
  const normalizeCategoryName = value => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  const transactionById = id => (typeof state !== "undefined" && Array.isArray(state.transactions) ? state.transactions.find(item => item.id === id) : null);
  const transactionRow = element => element.closest("#transactionList > div");
  const transactionFromRow = row => { const action = row?.querySelector('[data-entity="transactions"][data-id]'); return action ? transactionById(action.dataset.id) : null; };
  const matchesFinanceFilter = item => financeCategoryFilter === "all" || (financeCategoryFilter === "none" && !item.categoryId && !item.category) || item.categoryId === financeCategoryFilter || financeCategoryFilter === `legacy:${normalizeCategoryName(item.category)}`;
  const applyFinanceFilter = () => document.querySelectorAll("#transactionList > div").forEach(row => { const item = transactionFromRow(row); if (item) row.hidden = !matchesFinanceFilter(item); });
  const refreshFinanceFilter = async select => {
    const categories = await list("finance", true), legacyMap = new Map();
    (state.transactions || []).filter(item => !item.categoryId && item.category).forEach(item => { const key = normalizeCategoryName(item.category); if (key && !legacyMap.has(key)) legacyMap.set(key, item.category); });
    select.replaceChildren(new Option("Todas as categorias", "all"), new Option("Sem categoria", "none"), ...categories.map(item => new Option(`${item.icon} ${item.name}`, item.id)), ...[...legacyMap].map(([key, name]) => new Option(`${name} · antiga`, `legacy:${key}`)));
    select.value = [...select.options].some(option => option.value === financeCategoryFilter) ? financeCategoryFilter : "all"; financeCategoryFilter = select.value; applyFinanceFilter();
  };
  const decorateTransactions = async () => {
    const categories = await list("finance"), byId = new Map(categories.map(item => [item.id, item])), labels = { income: "Ganho", expense: "Gasto", purchase: "Compra" };
    document.querySelectorAll("#transactionList > div").forEach(row => { const item = transactionFromRow(row), category = item?.categoryId ? byId.get(item.categoryId) : null, signature = `${item?.categoryId || ""}:${category?.updated_at || ""}`; if (!item || row.dataset.categoryDecorated === signature) return; row.dataset.categoryDecorated = signature; const categoryLabel = category ? `${category.icon} ${category.name}` : item.category || "Sem categoria", small = row.querySelector(":scope > b > small"); if (small) small.textContent = `${labels[item.type] || "Movimentação"} • ${categoryLabel} • ${typeof formatDate === "function" ? formatDate(item.date) : item.date || ""}`; if (category) row.style.setProperty("--transaction-category", category.color); else row.style.removeProperty("--transaction-category"); }); applyFinanceFilter();
  };
  const renderFinanceCategoryTotals = async () => {
    const host = document.getElementById("financeReusableCategoryTotals"); if (!host || typeof state === "undefined") return;
    const categories = await list("finance"), byId = new Map(categories.map(item => [item.id, item])), grouped = new Map(), palette = ["#32ff7e", "#57a9ff", "#b68cff", "#ff7167", "#ffd463", "#45dfd0"];
    const signature = JSON.stringify({ filter: financeCategoryFilter, categories: categories.map(item => [item.id, item.updated_at]), transactions: (state.transactions || []).map(item => [item.id, item.categoryId, item.category, item.type, item.amount]) });
    if (host.dataset.renderSignature === signature) return;
    host.dataset.renderSignature = signature;
    (state.transactions || []).forEach(item => { const category = item.categoryId ? byId.get(item.categoryId) : null, legacyKey = normalizeCategoryName(item.category), key = category?.id || (legacyKey ? `legacy:${legacyKey}` : "none"), entry = grouped.get(key) || { key, name: category?.name || item.category || "Sem categoria", icon: category?.icon || "◇", color: category?.color || palette[grouped.size % palette.length], total: 0, income: 0, outflow: 0, count: 0 }; const amount = Math.abs(+item.amount || 0); entry.total += amount; entry.count++; if (item.type === "income") entry.income += amount; else entry.outflow += amount; grouped.set(key, entry); });
    host.replaceChildren(); const items = [...grouped.values()].sort((a, b) => b.total - a.total);
    if (!items.length) { host.append(make("p", "category-empty", "Seus lançamentos serão agrupados aqui.")); return; }
    items.forEach(item => { const button = make("button", "finance-reusable-category"); button.type = "button"; button.style.setProperty("--category-color", item.color); button.classList.toggle("active", financeCategoryFilter === item.key); button.setAttribute("aria-pressed", String(financeCategoryFilter === item.key)); const icon = make("i", "finance-category-icon", item.icon), identity = make("span", "finance-category-identity"); identity.append(make("b", "", item.name), make("small", "", `${item.count} ${item.count === 1 ? "movimentação" : "movimentações"}`)); const totals = make("span", "finance-category-values"), totalLabel = make("small", "finance-category-total-label", "Total movimentado"), totalValue = make("b", "", typeof money === "function" ? money(item.total) : String(item.total)), breakdown = make("span", "finance-category-breakdown"), income = make("small", "income", `↑ ${typeof money === "function" ? money(item.income) : item.income}`), outflow = make("small", "outflow", `↓ ${typeof money === "function" ? money(item.outflow) : item.outflow}`), arrow = make("em", "finance-category-arrow", "›"); breakdown.append(income, outflow); totals.append(totalLabel, totalValue, breakdown); button.append(icon, identity, totals, arrow); button.onclick = () => { financeCategoryFilter = financeCategoryFilter === item.key ? "all" : item.key; const select = document.querySelector("[data-finance-category-filter]"); if (select) select.value = financeCategoryFilter; applyFinanceFilter(); renderFinanceCategoryTotals().catch(() => null); }; host.appendChild(button); });
  };
  const enhanceTransactionForm = async () => {
    if (typeof edit === "undefined" || edit.entity !== "transactions") return; const form = document.getElementById("entityForm"), old = form?.elements?.category; if (!form || !old || form.querySelector('[data-finance-category-field="true"]')) return;
    const item = edit.id ? state.transactions.find(transaction => transaction.id === edit.id) : null, label = old.closest("label"), picker = await createPicker({ domain: "finance", value: item?.categoryId || "", legacyValue: item?.category || old.value || "" }); label.dataset.financeCategoryField = "true"; label.replaceChildren(document.createTextNode("Categoria"), picker);
  };
  const enhanceFinance = () => {
    const historyHead = document.querySelector("#finance .finance-history-layout .table .panel-head");
    if (historyHead && !historyHead.querySelector("[data-finance-category-filter]")) { const select = make("select", "finance-category-filter"); select.dataset.financeCategoryFilter = "true"; select.setAttribute("aria-label", "Filtrar lançamentos por categoria"); select.onchange = () => { financeCategoryFilter = select.value; applyFinanceFilter(); renderFinanceCategoryTotals().catch(() => null); }; historyHead.appendChild(select); refreshFinanceFilter(select).catch(() => null); }
    const layout = document.querySelector("#finance .finance-history-layout");
    if (layout && !document.getElementById("financeReusableCategoryTotals")) { const card = make("article", "card finance-reusable-category-card"), header = make("div", "panel-head finance-category-card-head"), mark = make("i", "finance-category-head-mark", "◫"), title = make("div"), hint = make("small", "finance-category-filter-hint", "Toque em uma categoria para filtrar"); title.append(make("span", "", "CATEGORIAS"), make("h3", "", "Totais por categoria"), make("p", "", "Veja entradas, saídas e o total movimentado em cada grupo.")); header.append(mark, title, hint); const body = make("div", "finance-reusable-category-list"); body.id = "financeReusableCategoryTotals"; card.append(header, body); layout.appendChild(card); }
    decorateTransactions().catch(() => null); renderFinanceCategoryTotals().catch(() => null); enhanceTransactionForm().catch(() => null);
  };
  const injectEntryPoints = () => { [["#notes .page-head", "knowledge"], ["#finance .page-head", "finance"]].forEach(([selector, domain]) => { const head = document.querySelector(selector); if (!head || head.querySelector(`[data-open-categories="${domain}"]`)) return; const button = make("button", "secondary category-entry", "Categorias"); button.type = "button"; button.dataset.openCategories = domain; button.onclick = () => open(domain); const primary = head.querySelector(":scope > button.primary"); if (primary) primary.before(button); else head.appendChild(button); }); enhanceNotes(); enhanceFinance(); };
  window.LuarCategories = { list, open, close, createPicker, invalidate: domain => cache.delete(domain) };
  new MutationObserver(injectEntryPoints).observe(document.body, { childList: true, subtree: true }); injectEntryPoints();
  window.addEventListener("luar:categories-changed", event => { if (event.detail?.domain === "knowledge") { const select = document.querySelector("[data-note-category-filter]"); if (select) refreshNoteFilter(select).catch(() => null); decorateNotes().catch(() => null); } });
  window.addEventListener("luar:categories-changed", event => { if (event.detail?.domain === "finance") { const select = document.querySelector("[data-finance-category-filter]"); if (select) refreshFinanceFilter(select).catch(() => null); decorateTransactions().catch(() => null); renderFinanceCategoryTotals().catch(() => null); } });
})();
