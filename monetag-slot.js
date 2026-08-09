(function(s){s.dataset.zone='11539704',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
const notifyAdStatus=status=>parent.postMessage({type:'luar-ad-status',status},location.origin);
const adLoading=document.getElementById('adLoading');
const adTimeout=setTimeout(()=>{
  if(document.body.classList.contains('ad-creative-ready'))return;
  document.body.classList.add('ad-unavailable');
  adLoading.innerHTML='<strong>Nenhuma campanha disponível agora</strong><small>A Monetag não entregou um anúncio para este acesso.</small>';
  notifyAdStatus('unavailable');
},5000);
const adObserver=new MutationObserver(()=>{
  if(!document.body.querySelector('iframe,a[href],img'))return;
  clearTimeout(adTimeout);
  document.body.classList.remove('ad-unavailable');
  document.body.classList.add('ad-creative-ready');
  notifyAdStatus('ready');
  adObserver.disconnect();
});
adObserver.observe(document.body,{childList:true,subtree:true});
