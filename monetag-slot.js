const notifyAdStatus=status=>parent.postMessage({type:'luar-ad-status',status},location.origin);
const adLoading=document.getElementById('adLoading');
const adTimeout=setTimeout(()=>{
  if(document.body.classList.contains('ad-creative-ready'))return;
  document.body.classList.add('ad-unavailable');
  adLoading.innerHTML='<strong>Publicidade indisponível no momento</strong><small>O espaço tentará carregar novamente ao trocar de página.</small>';
  notifyAdStatus('unavailable');
},7000);
const adObserver=new MutationObserver(()=>{
  if(!document.body.querySelector('iframe,a[href],img'))return;
  clearTimeout(adTimeout);
  document.body.classList.remove('ad-unavailable');
  document.body.classList.add('ad-creative-ready');
  notifyAdStatus('ready');
  adObserver.disconnect();
});
adObserver.observe(document.body,{childList:true,subtree:true});
