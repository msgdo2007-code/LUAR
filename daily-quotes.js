(() => {
  const quotes = [
    'Eu acredito em você.',
    'Você ainda vai muito longe.',
    'Não desista agora.',
    'Você é capaz de superar isso.',
    'Eu tenho orgulho de você.',
    'Continue, seu esforço dará resultado.',
    'Você merece uma vida melhor.',
    'Seu futuro ainda pode ser incrível.',
    'Não deixe o medo vencer.',
    'Você nasceu para crescer.',
    'Levante a cabeça e tente novamente.',
    'Você não chegou até aqui por acaso.',
    'Acredite mais na sua força.',
    'Essa fase difícil vai passar.',
    'Você consegue dar a volta por cima.',
    'Não abandone quem você deseja ser.',
    'Ainda existe esperança.',
    'Você tem potencial para vencer.',
    'Faça isso pelo seu futuro.',
    'Continue lutando por você.',
    'Você é maior que seus problemas.',
    'Não permita que alguém diminua você.',
    'Sua vida pode mudar completamente.',
    'Tenha coragem para começar.',
    'Você merece sentir orgulho de si.',
    'O seu esforço não será perdido.',
    'Você pode começar de novo.',
    'Um erro não define você.',
    'Use a dor para crescer.',
    'Sua história ainda está sendo escrita.',
    'Não pare antes de conseguir.',
    'Você é mais forte a cada tentativa.',
    'Faça o que precisa ser feito.',
    'Construa a vida que você merece.',
    'Ninguém pode lutar por você melhor que você.',
    'Não espere confiança para agir.',
    'Sua atitude pode mudar tudo.',
    'Você ainda pode vencer este dia.',
    'O difícil também faz você crescer.',
    'Não troque seu futuro por um momento ruim.',
    'Escolha continuar.',
    'Você tem motivos para tentar novamente.',
    'A sua hora vai chegar.',
    'Não tenha medo de evoluir.',
    'Você não nasceu para desistir.',
    'Seja melhor do que foi ontem.',
    'Seu progresso começa com uma decisão.',
    'Vá atrás do que acredita.',
    'Você pode mudar o rumo da sua vida.',
    'Não deixe a tristeza apagar sua força.',
    'O amanhã precisa da sua coragem.',
    'Você está mais perto do que imagina.',
    'Transforme suas palavras em atitudes.',
    'Comece pequeno, mas comece.',
    'Faça seu futuro sentir orgulho.',
    'Você não precisa vencer tudo hoje.',
    'Apenas não pare de avançar.',
    'Sua força aparece quando você continua.',
    'Você merece outra oportunidade.',
    'Não se abandone nos dias difíceis.',
    'Cuide da pessoa que você está se tornando.',
    'Sua disciplina vai levar você longe.',
    'Confie no seu processo.',
    'Você consegue aprender e melhorar.',
    'Não fuja da vida que deseja.',
    'Lute pelo que faz sentido para você.',
    'Seu sonho merece sua dedicação.',
    'Você tem mais força do que medo.',
    'Cada dia é uma nova chance.',
    'A mudança começa em você.',
    'Pare de duvidar do seu potencial.',
    'Sua melhor fase ainda pode chegar.',
    'Continue até se orgulhar.',
    'Não deixe o passado prender você.',
    'Você não está atrasado.',
    'Vá no seu tempo, mas continue.',
    'Seu esforço de hoje mudará seu amanhã.',
    'Escolha aquilo que faz você crescer.',
    'Você não precisa provar nada para ninguém.',
    'Prove para você que consegue.',
    'Seja corajoso nos dias difíceis.',
    'Não desista por estar cansado.',
    'Descanse e volte mais forte.',
    'Sua caminhada tem valor.',
    'Você pode ser melhor sem deixar de ser você.',
    'O seu momento ruim não é o fim.',
    'Você ainda tem muito para conquistar.',
    'Não permita que uma queda pare você.',
    'Levante quantas vezes forem necessárias.',
    'Você merece conquistar seus objetivos.',
    'Tenha orgulho de continuar tentando.',
    'A vida ainda pode surpreender você.',
    'Não aceite uma vida que não faz você feliz.',
    'Você tem coragem para mudar.',
    'Faça hoje valer a pena.',
    'Um passo pode iniciar uma nova história.',
    'Você ainda vai agradecer por não ter desistido.',
    'Torne-se a pessoa que você precisava conhecer.',
    'Eu sei que você consegue.',
    'Continue, ainda há muito esperando por você.'
  ];

  let userId = '';
  let timer = null;

  function brasiliaDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
  }

  function brasiliaDateKey(date = new Date()) {
    const { year, month, day } = brasiliaDateParts(date);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function quoteForDate(date = new Date()) {
    const { year, month, day } = brasiliaDateParts(date);
    const index = Math.floor(Date.UTC(year, month - 1, day) / 86400000) % quotes.length;
    return { number: index + 1, text: quotes[index] };
  }

  const storageKey = () => `luar-daily-quote:${userId}`;

  function close(markAsSeen = true) {
    const layer = document.getElementById('dailyQuoteLayer');
    if (!layer) return;
    if (markAsSeen && userId) localStorage.setItem(storageKey(), brasiliaDateKey());
    layer.classList.remove('open');
    layer.setAttribute('aria-hidden', 'true');
  }

  function ensureLayer() {
    let layer = document.getElementById('dailyQuoteLayer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'dailyQuoteLayer';
    layer.className = 'daily-quote-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<section class="daily-quote-card" role="dialog" aria-modal="true" aria-labelledby="dailyQuoteTitle"><button class="daily-quote-close" type="button" aria-label="Fechar frase do dia">×</button><div class="daily-quote-orbit" aria-hidden="true"><i></i><b>☾</b></div><span>FRASE DO DIA</span><h2 id="dailyQuoteTitle"></h2><p id="dailyQuoteDate"></p><button class="daily-quote-confirm" type="button">Levar comigo hoje</button></section>';
    document.body.appendChild(layer);
    layer.querySelector('.daily-quote-close').addEventListener('click', () => close(true));
    layer.querySelector('.daily-quote-confirm').addEventListener('click', () => close(true));
    layer.addEventListener('click', event => {
      if (event.target === layer) close(true);
    });
    return layer;
  }

  function showIfNeeded() {
    if (!userId || !document.body.classList.contains('app-mode')) return;
    if (document.getElementById('onboardingLayer')?.classList.contains('open')) return;
    const dateKey = brasiliaDateKey();
    if (localStorage.getItem(storageKey()) === dateKey) return;
    const layer = ensureLayer();
    const quote = quoteForDate();
    layer.querySelector('#dailyQuoteTitle').textContent = quote.text;
    layer.querySelector('#dailyQuoteDate').textContent = `Mensagem ${quote.number} de ${quotes.length} · renova à meia-noite de Brasília`;
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => layer.querySelector('.daily-quote-confirm')?.focus());
  }

  function start(user) {
    userId = String(user?.id || user?.email || '');
    clearInterval(timer);
    if (!userId) return;
    setTimeout(showIfNeeded, 900);
    timer = setInterval(showIfNeeded, 30000);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    userId = '';
    close(false);
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('dailyQuoteLayer')?.classList.contains('open')) close(true);
  });

  window.LuarDailyQuote = { start, stop, showIfNeeded, quotes };
})();
