(() => {
  const domains = { knowledge: "Notas e ideias", finance: "Financeiro" };
  const cache = new Map();
  let activeDomain = "knowledge", editingId = null, modal = null;
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
    if (!force && cache.has(domain)) return cache.get(domain);
    const result = await api(domain), categories = Array.isArray(result.categories) ? result.categories : [];
    cache.set(domain, categories); return categories;
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
    try { await api(activeDomain, { method: "DELETE", body: { id: category.id } }); cache.delete(activeDomain); if (editingId === category.id) resetForm(); await renderList(); if (typeof toast === "function") toast("Categoria removida", "Seus registros continuam preservados."); }
    catch (error) { ensureModal().querySelector(".category-status").textContent = error.message; }
  };
  const renderList = async () => {
    const layer = ensureModal(), container = layer.querySelector(".category-list"), empty = layer.querySelector(".category-empty"), query = layer.querySelector(".category-search input").value.trim().toLocaleLowerCase("pt-BR");
    container.replaceChildren(make("div", "category-loading", "Carregando…"));
    try {
      const categories = (await list(activeDomain)).filter(item => !query || item.name.toLocaleLowerCase("pt-BR").includes(query)); container.replaceChildren();
      categories.forEach(category => { const row = make("article", "category-row"); row.setAttribute("role", "listitem"); const mark = make("i", "category-mark", category.icon); mark.style.setProperty("--category-color", category.color); const identity = make("div", "category-identity"); identity.append(make("b", "", category.name), make("small", "", category.is_default ? "Categoria padrão" : domains[category.domain])); const actions = make("div", "category-row-actions"), editButton = make("button", "", "Editar"), deleteButton = make("button", "category-delete", "Excluir"); editButton.type = deleteButton.type = "button"; editButton.onclick = () => edit(category); deleteButton.onclick = () => remove(category); actions.append(editButton, deleteButton); row.append(mark, identity, actions); container.appendChild(row); });
      empty.hidden = categories.length > 0;
    } catch (error) { container.replaceChildren(); empty.hidden = false; empty.textContent = error.message; }
  };
  const submitForm = async event => {
    event.preventDefault(); const form = event.currentTarget, submit = form.querySelector('[type="submit"]'), status = form.querySelector(".category-status"); submit.disabled = true; status.textContent = editingId ? "Atualizando…" : "Criando…";
    try { await api(activeDomain, { method: editingId ? "PUT" : "POST", body: { id: editingId || undefined, domain: activeDomain, name: form.elements.name.value, icon: form.elements.icon.value, color: form.elements.color.value, isDefault: form.elements.isDefault.checked } }); cache.delete(activeDomain); resetForm(); await renderList(); if (typeof toast === "function") toast("Categoria salva", "A identidade já está disponível nesta área."); }
    catch (error) { status.textContent = error.message; } finally { submit.disabled = false; }
  };
  const switchDomain = async domain => { activeDomain = domain; resetForm(); ensureModal().querySelectorAll("[data-category-domain]").forEach(button => button.classList.toggle("active", button.dataset.categoryDomain === domain)); await renderList(); };
  const open = async (domain = "knowledge") => { if (typeof currentUser !== "undefined" && !currentUser) { if (typeof openAuth === "function") openAuth("login"); return; } const layer = ensureModal(); layer.hidden = false; layer.setAttribute("aria-hidden", "false"); document.body.classList.add("category-manager-open"); await switchDomain(domains[domain] ? domain : "knowledge"); layer.querySelector(".category-close").focus(); };
  const close = () => { if (!modal) return; modal.hidden = true; modal.setAttribute("aria-hidden", "true"); document.body.classList.remove("category-manager-open"); resetForm(); };
  const createPicker = async ({ domain = "knowledge", value = "", onChange = () => {} } = {}) => { const wrapper = make("div", "category-picker"), select = make("select"), manage = make("button", "secondary", "Gerenciar"); select.setAttribute("aria-label", "Categoria"); manage.type = "button"; manage.onclick = () => open(domain); const categories = await list(domain, true); select.append(new Option("Sem categoria", ""), ...categories.map(item => new Option(`${item.icon} ${item.name}`, item.id))); select.value = value; select.onchange = () => onChange(select.value || null); wrapper.append(select, manage); return wrapper; };
  const injectEntryPoints = () => { [["#notes .page-head", "knowledge"], ["#finance .page-head", "finance"]].forEach(([selector, domain]) => { const head = document.querySelector(selector); if (!head || head.querySelector(`[data-open-categories="${domain}"]`)) return; const button = make("button", "secondary category-entry", "Categorias"); button.type = "button"; button.dataset.openCategories = domain; button.onclick = () => open(domain); const primary = head.querySelector(":scope > button.primary"); if (primary) primary.before(button); else head.appendChild(button); }); };
  window.LuarCategories = { list, open, close, createPicker, invalidate: domain => cache.delete(domain) };
  new MutationObserver(injectEntryPoints).observe(document.body, { childList: true, subtree: true }); injectEntryPoints();
})();
