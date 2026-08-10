const notifyAdStatus=status=>parent.postMessage({type:'luar-ad-status',status},location.origin);
const adTrigger=document.getElementById('adTrigger');
let statusSent=false;
const deliveredCreative=()=>[...document.body.querySelectorAll('iframe,a[href],img[src]')].some(element=>!element.closest('#adLoading'));
const markReady=status=>{
  if(statusSent)return;
  statusSent=true;
  document.body.classList.add(status==='ready'?'ad-network-ready':'ad-network-unavailable');
  if(adTrigger){adTrigger.hidden=false;adTrigger.dataset.mode=status==='ready'?'campaign':'retry';if(status==='unavailable'){adTrigger.querySelector('strong').textContent='Nenhuma campanha disponível agora';adTrigger.querySelector('small').textContent='A Monetag não enviou uma oferta para esta visita.';adTrigger.querySelector('b').textContent='TENTAR NOVAMENTE'}}
  notifyAdStatus(status);
};
const observeAdResponse=(url,status)=>{if(!/\/11539704(?:\?|$)/.test(String(url||'')))return;if(status===204)markReady('unavailable');else if(status>=200&&status<400)markReady('ready')};
const nativeOpen=XMLHttpRequest.prototype.open,nativeSend=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(method,url,...rest){this.__luarAdUrl=String(url||'');return nativeOpen.call(this,method,url,...rest)};
XMLHttpRequest.prototype.send=function(...args){this.addEventListener('loadend',()=>observeAdResponse(this.__luarAdUrl,this.status),{once:true});return nativeSend.apply(this,args)};
const nativeFetch=window.fetch?.bind(window);
if(nativeFetch)window.fetch=(...args)=>nativeFetch(...args).then(response=>{observeAdResponse(args[0]?.url||args[0],response.status);return response});
adTrigger?.addEventListener('click',event=>{if(adTrigger.dataset.mode!=='retry')return;event.preventDefault();event.stopImmediatePropagation();location.reload()},{capture:true});
/* Zona fornecida pelo painel da Monetag. */
(function(s){s.dataset.zone='11539704',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
const monetagScript=document.querySelector('script[data-zone="11539704"]');
const observer=new MutationObserver(()=>{if(deliveredCreative()){observer.disconnect();markReady('ready')}});
observer.observe(document.body,{childList:true,subtree:true});
monetagScript?.addEventListener('error',()=>markReady('unavailable'),{once:true});
setTimeout(()=>markReady(deliveredCreative()?'ready':'unavailable'),7000);
