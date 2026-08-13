const notifyAdStatus=status=>parent.postMessage({type:'luar-ad-status',status},location.origin);
const adTrigger=document.getElementById('adTrigger');
let statusSent=false;
const deliveredCreative=()=>[...document.body.querySelectorAll('iframe,a[href],img[src]')].some(element=>!element.closest('#adLoading'));
const markReady=status=>{
  if(statusSent)return;
  statusSent=true;
  document.body.classList.add(status==='ready'?'ad-network-ready':'ad-network-unavailable');
  if(adTrigger){
    adTrigger.hidden=false;
    if(status==='unavailable'){
      adTrigger.querySelector('strong').textContent='Nenhuma campanha disponível agora';
      adTrigger.querySelector('small').textContent='A Monetag não enviou uma campanha para esta visita.';
      adTrigger.querySelector('b').textContent='TENTE NOVAMENTE MAIS TARDE';
    }
  }
  notifyAdStatus(status);
};
const observeAdResponse=(url,status)=>{
  if(!/11568818/.test(String(url||'')))return;
  if(status===204)markReady('unavailable');
  else if(status>=200&&status<400)markReady('ready');
};
const nativeOpen=XMLHttpRequest.prototype.open,nativeSend=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(method,url,...rest){this.__luarAdUrl=String(url||'');return nativeOpen.call(this,method,url,...rest)};
XMLHttpRequest.prototype.send=function(...args){this.addEventListener('loadend',()=>observeAdResponse(this.__luarAdUrl,this.status),{once:true});return nativeSend.apply(this,args)};
const nativeFetch=window.fetch?.bind(window);
if(nativeFetch)window.fetch=(...args)=>nativeFetch(...args).then(response=>{observeAdResponse(args[0]?.url||args[0],response.status);return response});

/* Código exato da zona In-Page Push fornecida pelo painel da Monetag. */
(function(s){s.dataset.zone='11568818',s.src='https://nap5k.com/tag.min.js'})([document.documentElement,document.body].filter(Boolean).pop().appendChild(document.createElement('script')));

const monetagScript=document.querySelector('script[data-zone="11568818"]');
const observer=new MutationObserver(()=>{if(deliveredCreative()){observer.disconnect();markReady('ready')}});
observer.observe(document.body,{childList:true,subtree:true});
monetagScript?.addEventListener('error',()=>markReady('unavailable'),{once:true});
setTimeout(()=>markReady(deliveredCreative()?'ready':'unavailable'),12000);
