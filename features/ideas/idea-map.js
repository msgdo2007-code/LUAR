(() => {
  const THEMES = { free: "Mapa livre", blackhole: "Buraco Negro", earth: "Planeta Terra", brain: "Cérebro" };
  let root, canvas, ctx, detail, categorySelect, prioritySelect, statusSelect, searchInput, selectedId = "", hoverId = "", dragging = null, panning = null;
  let categories = [], camera = { x: 0, y: 0, zoom: 1 }, raf = 0;

  const mapState = () => {
    state.profile = state.profile || {};
    const current = state.profile.ideaMap && typeof state.profile.ideaMap === "object" ? state.profile.ideaMap : {};
    current.theme = THEMES[current.theme] ? current.theme : "free";
    current.selectedCategory = String(current.selectedCategory || "all");
    current.connections = Array.isArray(current.connections) ? current.connections : [];
    current.positions = current.positions && typeof current.positions === "object" ? current.positions : {};
    Object.keys(THEMES).forEach(theme => current.positions[theme] = current.positions[theme] && typeof current.positions[theme] === "object" ? current.positions[theme] : {});
    state.profile.ideaMap = current;
    return current;
  };
  const notes = () => Array.isArray(state.notes) ? state.notes : [];
  const categoryKey = note => note.categoryId || (note.category ? `legacy:${note.category.toLocaleLowerCase("pt-BR")}` : "none");
  const categoryInfo = note => categories.find(item => item.id === note.categoryId) || { id: categoryKey(note), name: note.category || "Sem categoria", color: note.color || "#829087", icon: note.emoji || "✦" };
  const visibleNotes = () => { const query = String(searchInput?.value || "").trim().toLocaleLowerCase("pt-BR"), priority = prioritySelect?.value || "all", status = statusSelect?.value || "all"; return notes().filter(note => (!query || `${note.title || ""} ${note.content || ""}`.toLocaleLowerCase("pt-BR").includes(query)) && (priority === "all" || (note.priority || "medium") === priority) && (status === "all" || (note.status || "active") === status)); };
  const persist = () => { writeLocalState(); scheduleCloudSave(); };
  const pos = (note, create = true) => { const store = mapState().positions[mapState().theme]; if (!store[note.id] && create) store[note.id] = { x: 0, y: 0, locked: false }; return store[note.id]; };
  const sizeOf = note => ({ small: 7, medium: 10, large: 14 }[note.size] || (note.priority === "high" ? 14 : note.priority === "low" ? 7 : 10));
  const screen = point => ({ x: (point.x + camera.x) * camera.zoom + canvas.width / devicePixelRatio / 2, y: (point.y + camera.y) * camera.zoom + canvas.height / devicePixelRatio / 2 });
  const world = point => ({ x: (point.x - canvas.width / devicePixelRatio / 2) / camera.zoom - camera.x, y: (point.y - canvas.height / devicePixelRatio / 2) / camera.zoom - camera.y });

  function layout(theme = mapState().theme) {
    const all = notes(), selected = mapState().selectedCategory, groups = new Map();
    all.forEach(note => { const key = categoryKey(note); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(note); });
    const groupEntries = [...groups.entries()];
    all.forEach((note, index) => {
      const current = mapState().positions[theme][note.id]; if (current?.locked) return;
      const key = categoryKey(note), groupIndex = Math.max(0, groupEntries.findIndex(([id]) => id === key)), members = groups.get(key), memberIndex = members.indexOf(note), count = Math.max(1, members.length), angle = memberIndex / count * Math.PI * 2 + groupIndex * .72;
      let x = 0, y = 0;
      if (theme === "blackhole") { const chosen = selected !== "all" && key === selected, radius = chosen ? 95 + memberIndex * 14 : key === "none" ? 330 + memberIndex * 10 : 185 + groupIndex * 52 + memberIndex * 9; x = Math.cos(angle) * radius; y = Math.sin(angle) * radius * .65; }
      else if (theme === "earth") { const chosen = selected === "all" ? groupIndex === 0 : key === selected; if (chosen) { const golden = memberIndex * 2.399, radius = Math.sqrt(memberIndex + 1) * 28; x = Math.cos(golden) * radius; y = Math.sin(golden) * radius; } else { const radius = key === "none" ? 350 : 240 + groupIndex * 30; x = Math.cos(angle) * radius; y = Math.sin(angle) * radius * .75; } }
      else if (theme === "brain") { const chosen = selected === "all" || key === selected, side = groupIndex % 2 ? 1 : -1; if (chosen) { x = side * (55 + Math.cos(angle) * (95 + groupIndex * 8)); y = Math.sin(angle) * 150 + (memberIndex % 3 - 1) * 15; } else { const radius = key === "none" ? 360 : 270; x = Math.cos(angle) * radius; y = Math.sin(angle) * radius * .7; } }
      else { const chosen = selected !== "all" && key === selected, visibleIndex = selected === "all" ? groupIndex : groupEntries.filter(([id]) => id !== selected).findIndex(([id]) => id === key), groupAngle = Math.max(0, visibleIndex) / Math.max(1, groupEntries.length - (selected === "all" ? 0 : 1)) * Math.PI * 2, centerRadius = chosen || groupEntries.length === 1 ? 0 : selected === "all" ? 175 : 245; x = Math.cos(groupAngle) * centerRadius + Math.cos(angle) * (45 + memberIndex * 11); y = Math.sin(groupAngle) * centerRadius + Math.sin(angle) * (45 + memberIndex * 11); }
      mapState().positions[theme][note.id] = { x, y, locked: current?.locked === true };
    });
    draw();
  }

  function drawBackdrop(theme, width, height) {
    ctx.save(); ctx.translate(width / 2, height / 2);
    if (theme === "blackhole") { const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, 95); gradient.addColorStop(0, "#000"); gradient.addColorStop(.45, "#020403"); gradient.addColorStop(.68, "rgba(50,255,126,.34)"); gradient.addColorStop(1, "transparent"); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, 105, 0, Math.PI * 2); ctx.fill(); [150, 230, 315].forEach(radius => { ctx.strokeStyle = "rgba(50,255,126,.08)"; ctx.beginPath(); ctx.ellipse(0, 0, radius, radius * .65, 0, 0, Math.PI * 2); ctx.stroke(); }); }
    if (theme === "earth") { const gradient = ctx.createRadialGradient(-45, -55, 5, 0, 0, 185); gradient.addColorStop(0, "rgba(120,220,255,.28)"); gradient.addColorStop(.55, "rgba(34,105,139,.18)"); gradient.addColorStop(1, "rgba(50,255,126,.05)"); ctx.fillStyle = gradient; ctx.strokeStyle = "rgba(110,220,190,.2)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 185, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); for (let i = 0; i < 28; i++) { const angle = i * 2.399, radius = Math.sqrt(i) * 27; ctx.fillStyle = "rgba(50,255,126,.11)"; ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 2.2, 0, Math.PI * 2); ctx.fill(); } }
    if (theme === "brain") { ctx.strokeStyle = "rgba(50,255,126,.13)"; ctx.lineWidth = 2; [-1, 1].forEach(side => { ctx.beginPath(); ctx.ellipse(side * 80, 0, 105, 165, side * .08, 0, Math.PI * 2); ctx.stroke(); }); for (let y = -120; y <= 120; y += 40) { ctx.beginPath(); ctx.moveTo(-150, y); ctx.bezierCurveTo(-50, y - 35, 50, y + 35, 150, y); ctx.stroke(); } }
    ctx.restore();
  }

  function drawCategoryCenters(shownNotes) {
    const grouped = new Map();
    shownNotes.forEach(note => { const point = pos(note, false); if (!point) return; const key = categoryKey(note); if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push({ note, point }); });
    grouped.forEach((items, key) => {
      const center = items.reduce((total, item) => ({ x: total.x + item.point.x / items.length, y: total.y + item.point.y / items.length }), { x: 0, y: 0 }), info = categoryInfo(items[0].note), selected = mapState().selectedCategory === key, radius = Math.max(34, 26 + items.length * 8);
      const light = document.body.classList.contains("light"); ctx.save(); ctx.setLineDash([4, 6]); ctx.strokeStyle = `${info.color}${light ? "88" : "55"}`; ctx.fillStyle = `${info.color}${light ? "1c" : "12"}`; ctx.lineWidth = selected ? 2 : 1; ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = selected ? light ? "#142019" : "#fff" : info.color; ctx.font = `${selected ? 800 : 700} ${selected ? 11 : 9}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.fillText(`${info.icon || "✦"} ${info.name}`, center.x, center.y - radius - 8); ctx.restore();
    });
  }

  function draw() {
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      if (!canvas || !canvas.isConnected) return; const ratio = devicePixelRatio || 1, rect = canvas.getBoundingClientRect(), light = document.body.classList.contains("light");
      if (canvas.width !== Math.round(rect.width * ratio) || canvas.height !== Math.round(rect.height * ratio)) { canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height); ctx.fillStyle = light ? "#f7faf8" : "#070b08"; ctx.fillRect(0, 0, rect.width, rect.height); ctx.save(); ctx.translate((camera.x * camera.zoom) + rect.width / 2, (camera.y * camera.zoom) + rect.height / 2); ctx.scale(camera.zoom, camera.zoom); drawBackdrop(mapState().theme, 0, 0);
      drawCategoryCenters(visibleNotes());
      const shown = new Set(visibleNotes().map(note => note.id));
      mapState().connections.forEach(link => { if (!shown.has(link.sourceId) || !shown.has(link.targetId)) return; const a = pos(notes().find(note => note.id === link.sourceId), false), b = pos(notes().find(note => note.id === link.targetId), false); if (!a || !b) return; const emphasized = hoverId && (link.sourceId === hoverId || link.targetId === hoverId); ctx.strokeStyle = emphasized ? light ? "rgba(0,145,73,.82)" : "rgba(50,255,126,.72)" : light ? "rgba(45,72,58,.3)" : "rgba(150,175,160,.22)"; ctx.lineWidth = emphasized ? 2 : 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); });
      visibleNotes().forEach(note => { const point = pos(note), info = categoryInfo(note), radius = sizeOf(note), active = selectedId === note.id || hoverId === note.id; ctx.save(); ctx.translate(point.x, point.y); ctx.shadowColor = info.color; ctx.shadowBlur = note.glow === "strong" ? 28 : note.glow === "soft" ? 8 : 16; ctx.fillStyle = note.status === "completed" ? "#718078" : info.color; ctx.globalAlpha = note.status === "paused" ? .55 : 1; ctx.beginPath(); for (let i = 0; i < 10; i++) { const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .42 : radius; const x = Math.cos(angle) * r, y = Math.sin(angle) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); if (active) { ctx.shadowBlur = 0; ctx.strokeStyle = light ? "#142019" : "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); } ctx.restore(); ctx.fillStyle = active ? light ? "#142019" : "#fff" : light ? "#52645a" : "#aab6ae"; ctx.font = `${active ? 700 : 600} 10px Inter, sans-serif`; ctx.textAlign = "center"; ctx.fillText(String(note.title || "Ideia").slice(0, 28), point.x, point.y + radius + 14); });
      ctx.restore();
    });
  }

  function hit(point) { const target = world(point); return [...visibleNotes()].reverse().find(note => { const p = pos(note), radius = sizeOf(note) + 9; return Math.hypot(target.x - p.x, target.y - p.y) <= radius; }); }
  function pointer(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function bindCanvas() {
    canvas.onpointerdown = event => { canvas.setPointerCapture(event.pointerId); const point = pointer(event), note = hit(point); if (note) { selectedId = note.id; dragging = { id: note.id, start: world(point) }; renderDetail(); draw(); } else { selectedId = ""; renderDetail(); panning = { point, x: camera.x, y: camera.y }; } };
    canvas.onpointermove = event => { const point = pointer(event), note = hit(point); hoverId = note?.id || ""; if (dragging) { const item = notes().find(note => note.id === dragging.id), current = pos(item); if (!current.locked) { const value = world(point); current.x = value.x; current.y = value.y; } } else if (panning) { camera.x = panning.x + (point.x - panning.point.x) / camera.zoom; camera.y = panning.y + (point.y - panning.point.y) / camera.zoom; } draw(); };
    canvas.onpointerup = () => { if (dragging) persist(); dragging = null; panning = null; };
    canvas.onpointerleave = () => { hoverId = ""; draw(); };
    canvas.onwheel = event => { event.preventDefault(); camera.zoom = Math.max(.35, Math.min(2.8, camera.zoom * (event.deltaY > 0 ? .9 : 1.1))); draw(); };
  }

  function renderDetail() {
    const note = notes().find(item => item.id === selectedId); if (!detail) return;
    detail.closest(".idea-map-layout")?.classList.toggle("has-idea-selection", !!note);
    if (!note) { detail.innerHTML = `<div class="idea-detail-empty"><i>✦</i><b>Selecione uma estrela</b><small>Veja detalhes, edite ou conecte ideias.</small></div>`; return; }
    const info = categoryInfo(note), connected = mapState().connections.filter(link => link.sourceId === note.id || link.targetId === note.id), options = notes().filter(item => item.id !== note.id && !connected.some(link => link.sourceId === item.id || link.targetId === item.id));
    detail.innerHTML = `<header style="--idea-color:${info.color}"><i>${info.icon || "✦"}</i><div><span>${info.name}</span><h3></h3></div><button type="button" data-edit-idea>Editar</button></header><p></p><div class="idea-detail-meta"><span>Prioridade <b>${note.priority || "medium"}</b></span><span>Status <b>${note.status || "active"}</b></span><span>Conexões <b>${connected.length}</b></span></div><label class="idea-connect-field">CONECTAR A OUTRA IDEIA<select><option value="">Selecionar ideia</option></select><button type="button">Criar conexão</button></label><div class="idea-connections-list"></div><button type="button" class="secondary idea-lock">${pos(note).locked ? "Desbloquear posição" : "Bloquear posição"}</button>`;
    detail.querySelector("h3").textContent = note.title || "Ideia sem título"; detail.querySelector("p").textContent = note.content || "Sem descrição."; const select = detail.querySelector("select"); options.forEach(item => select.add(new Option(item.title || "Ideia", item.id)));
    detail.querySelector("[data-edit-idea]").onclick = () => openForm("notes", note.id); detail.querySelector(".idea-connect-field button").onclick = () => { const targetId = select.value; if (!targetId) return; mapState().connections.push({ id: `connection-${id()}`, sourceId: note.id, targetId }); persist(); renderDetail(); draw(); };
    const list = detail.querySelector(".idea-connections-list"); connected.forEach(link => { const otherId = link.sourceId === note.id ? link.targetId : link.sourceId, other = notes().find(item => item.id === otherId), row = document.createElement("button"); row.type = "button"; row.innerHTML = `<span>↗ <b></b></span><em>Remover</em>`; row.querySelector("b").textContent = other?.title || "Ideia removida"; row.onclick = () => { mapState().connections = mapState().connections.filter(item => item.id !== link.id); persist(); renderDetail(); draw(); }; list.appendChild(row); });
    detail.querySelector(".idea-lock").onclick = () => { pos(note).locked = !pos(note).locked; persist(); renderDetail(); };
  }

  async function loadCategories() { try { categories = await window.LuarCategories?.list("knowledge", true) || []; } catch { categories = []; } populateCategories(); draw(); }
  function populateCategories() { if (!categorySelect) return; const legacy = [...new Set(notes().filter(note => !note.categoryId && note.category).map(note => note.category))]; categorySelect.replaceChildren(new Option("Todas as categorias", "all"), new Option("Sem categoria", "none"), ...categories.map(item => new Option(`${item.icon} ${item.name}`, item.id)), ...legacy.map(name => new Option(`${name} · antiga`, `legacy:${name.toLocaleLowerCase("pt-BR")}`))); categorySelect.value = [...categorySelect.options].some(option => option.value === mapState().selectedCategory) ? mapState().selectedCategory : "all"; }

  function build() {
    root = document.getElementById("ideaMapApp"); if (!root || root.dataset.ready) return; root.dataset.ready = "true";
    root.innerHTML = `<article class="card idea-map-shell"><div class="idea-map-toolbar"><div class="idea-view-tabs"><button class="active" type="button" data-idea-view="map">✦ Mapa</button><button type="button" data-idea-view="list">☷ Lista</button></div><select id="ideaMapTheme" aria-label="Tema do mapa">${Object.entries(THEMES).map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select><select id="ideaMapCategory" aria-label="Categoria destacada"></select><select id="ideaMapPriority" aria-label="Filtrar por prioridade"><option value="all">Todas prioridades</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select><select id="ideaMapStatus" aria-label="Filtrar por status"><option value="all">Todos os status</option><option value="active">Ativa</option><option value="paused">Pausada</option><option value="completed">Concluída</option></select><label>⌕<input id="ideaMapSearch" type="search" placeholder="Pesquisar ideias"></label><div class="idea-zoom-controls" aria-label="Controles de zoom"><button type="button" id="ideaMapZoomOut" aria-label="Diminuir zoom">−</button><button type="button" id="ideaMapZoomIn" aria-label="Aumentar zoom">＋</button></div><button type="button" id="ideaMapCenter">Centralizar</button><button type="button" id="ideaMapArrange">Reorganizar</button></div><div class="idea-map-layout"><div class="idea-canvas-wrap"><canvas id="ideaMapCanvas" aria-label="Mapa visual de ideias"></canvas><div class="idea-map-help">Arraste estrelas · Arraste o fundo · Use zoom para explorar</div></div><aside class="idea-detail" id="ideaMapDetail"></aside></div></article>`;
    canvas = root.querySelector("canvas"); ctx = canvas.getContext("2d"); detail = root.querySelector("#ideaMapDetail"); categorySelect = root.querySelector("#ideaMapCategory"); prioritySelect = root.querySelector("#ideaMapPriority"); statusSelect = root.querySelector("#ideaMapStatus"); searchInput = root.querySelector("#ideaMapSearch"); root.querySelector("#ideaMapTheme").value = mapState().theme; bindCanvas(); renderDetail();
    root.querySelector("#ideaMapTheme").onchange = event => { mapState().theme = event.target.value; layout(); persist(); };
    categorySelect.onchange = () => { mapState().selectedCategory = categorySelect.value; camera = { x: 0, y: 0, zoom: 1 }; layout(); persist(); };
    searchInput.oninput = draw; prioritySelect.onchange = draw; statusSelect.onchange = draw; root.querySelector("#ideaMapZoomOut").onclick = () => { camera.zoom = Math.max(.35, camera.zoom * .82); draw(); }; root.querySelector("#ideaMapZoomIn").onclick = () => { camera.zoom = Math.min(2.8, camera.zoom * 1.22); draw(); }; root.querySelector("#ideaMapCenter").onclick = () => { camera = { x: 0, y: 0, zoom: 1 }; draw(); }; root.querySelector("#ideaMapArrange").onclick = () => { Object.values(mapState().positions[mapState().theme]).forEach(point => point.locked = false); layout(); persist(); };
    root.querySelectorAll("[data-idea-view]").forEach(button => button.onclick = () => { root.querySelectorAll("[data-idea-view]").forEach(item => item.classList.toggle("active", item === button)); root.closest("#notes").classList.toggle("idea-list-mode", button.dataset.ideaView === "list"); });
    new ResizeObserver(draw).observe(canvas); loadCategories(); layout();
  }

  function enhanceForm() { if (typeof edit === "undefined" || edit.entity !== "notes") return; const form = document.getElementById("entityForm"); if (!form) return; form.querySelectorAll('[name="priority"],[name="status"],[name="size"],[name="glow"]').forEach(field => field.closest("label")?.classList.add("idea-visual-field")); }

  function renderDashboardMiniMap() {
    const host = document.getElementById("dashboardIdeaMapSlot") || document.getElementById("dashboardWidgetZone"); if (!host) return; host.querySelector(".dashboard-idea-map-widget")?.remove();
    const card = document.createElement("article"); card.className = "dashboard-idea-map-widget"; card.innerHTML = `<header><span><small>MAPA DE IDEIAS</small><b>${notes().length} ${notes().length === 1 ? "estrela" : "estrelas"}</b></span><button type="button" aria-label="Abrir mapa completo">↗</button></header><canvas aria-label="Mini mapa interativo de ideias"></canvas><small class="mini-map-tip">Arraste as estrelas</small>`; host.appendChild(card); card.querySelector("header button").onclick = () => showPage("notes");
    const mini = card.querySelector("canvas"), miniCtx = mini.getContext("2d"), points = mapState().positions.free; if (notes().some(note => !points[note.id])) layout("free"); let dragged = "";
    const metrics = () => { const width = mini.clientWidth, height = mini.clientHeight, ratio = devicePixelRatio || 1; mini.width = Math.round(width * ratio); mini.height = Math.round(height * ratio); const all = notes().map(note => points[note.id]).filter(Boolean), extent = Math.max(180, ...all.flatMap(point => [Math.abs(point.x), Math.abs(point.y)])), scale = Math.min(width, height) / (extent * 2.35); return { width, height, ratio, scale }; };
    const paint = () => { const m = metrics(); miniCtx.setTransform(m.ratio, 0, 0, m.ratio, 0, 0); miniCtx.clearRect(0, 0, m.width, m.height); miniCtx.translate(m.width / 2, m.height / 2); miniCtx.strokeStyle = "rgba(255,255,255,.2)"; mapState().connections.forEach(link => { const a = points[link.sourceId], b = points[link.targetId]; if (!a || !b) return; miniCtx.beginPath(); miniCtx.moveTo(a.x * m.scale, a.y * m.scale); miniCtx.lineTo(b.x * m.scale, b.y * m.scale); miniCtx.stroke(); }); notes().forEach(note => { const point = points[note.id]; if (!point) return; const info = categoryInfo(note), radius = note.id === dragged ? 7 : 5; miniCtx.shadowColor = info.color; miniCtx.shadowBlur = 10; miniCtx.fillStyle = info.color; miniCtx.beginPath(); miniCtx.arc(point.x * m.scale, point.y * m.scale, radius, 0, Math.PI * 2); miniCtx.fill(); }); };
    const pointer = event => { const rect = mini.getBoundingClientRect(), m = metrics(); return { x: (event.clientX - rect.left - m.width / 2) / m.scale, y: (event.clientY - rect.top - m.height / 2) / m.scale, scale: m.scale }; };
    mini.onpointerdown = event => { const value = pointer(event); dragged = notes().find(note => { const point = points[note.id]; return point && Math.hypot(value.x - point.x, value.y - point.y) < 18 / value.scale; })?.id || ""; if (dragged) mini.setPointerCapture(event.pointerId); paint(); };
    mini.onpointermove = event => { if (!dragged) return; const value = pointer(event); points[dragged] = { ...points[dragged], x: value.x, y: value.y }; paint(); };
    mini.onpointerup = () => { if (dragged) persist(); dragged = ""; paint(); }; mini.onpointercancel = mini.onpointerup; new ResizeObserver(paint).observe(mini); paint();
  }

  function render() { build(); if (!root) return; populateCategories(); notes().forEach(note => { note.priority ||= "medium"; note.status ||= "active"; note.size ||= "medium"; note.glow ||= "medium"; }); Object.keys(THEMES).forEach(theme => { if (Object.keys(mapState().positions[theme]).length < notes().length) layout(theme); }); renderDetail(); draw(); enhanceForm(); }
  window.LuarIdeaMap = { render, arrange: layout, renderDashboard: renderDashboardMiniMap, refreshTheme: () => { draw(); renderDashboardMiniMap(); } };
  window.addEventListener("luar:categories-changed", event => { if (event.detail?.domain === "knowledge") loadCategories(); });
  document.addEventListener("click", event => { const button = event.target.closest('[data-action="delete"][data-entity="notes"]'); if (!button) return; const noteId = button.dataset.id, current = mapState(); current.connections = current.connections.filter(link => link.sourceId !== noteId && link.targetId !== noteId); Object.values(current.positions).forEach(theme => delete theme[noteId]); if (selectedId === noteId) selectedId = ""; }, true);
  new MutationObserver(enhanceForm).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", render, { once: true }); setTimeout(render, 0);
})();
