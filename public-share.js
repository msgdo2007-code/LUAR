(() => {
  const target = document.querySelector('.article-main article') || document.querySelector('main');
  if (!target || document.querySelector('.public-share')) return;
  const url = location.href.split('#')[0], title = document.querySelector('h1')?.textContent?.trim() || document.title, bar = document.createElement('aside');
  bar.className = 'public-share'; bar.setAttribute('aria-label', 'Compartilhar esta página');
  bar.innerHTML = '<strong>Compartilhar</strong><button data-share="copy">Copiar link</button><button data-share="whatsapp">WhatsApp</button><button data-share="discord">Discord</button><button data-share="x">X</button><button data-share="facebook">Facebook</button><button data-share="linkedin">LinkedIn</button>';
  target.appendChild(bar);
  bar.addEventListener('click', async event => { const channel = event.target.dataset.share; if (!channel) return; window.LuarTracking?.emit('content_share',{channel}); if (channel === 'copy' || channel === 'discord') { await navigator.clipboard.writeText(`${title} — ${url}`); const original=event.target.textContent; event.target.textContent='Link copiado'; setTimeout(()=>event.target.textContent=original,2200); return; } const links={whatsapp:`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,x:`https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,facebook:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,linkedin:`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}; if(links[channel])window.open(links[channel],'_blank','noopener,noreferrer,width=720,height=640'); });
})();
