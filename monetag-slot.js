(function(s){s.dataset.zone='11539704',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
const notifyAdStatus=status=>parent.postMessage({type:'luar-ad-status',status},location.origin);
const monetagScript=document.querySelector('script[data-zone="11539704"]');
let statusSent=false;
const deliveredCreative=()=>[...document.body.querySelectorAll('iframe,a[href],img[src]')].some(element=>!element.closest('#adLoading'));
const markReady=status=>{
  if(statusSent)return;
  statusSent=true;
  document.body.classList.add(status==='ready'?'ad-network-ready':'ad-network-unavailable');
  notifyAdStatus(status);
};
const observer=new MutationObserver(()=>{if(deliveredCreative()){observer.disconnect();markReady('ready')}});
observer.observe(document.body,{childList:true,subtree:true});
monetagScript?.addEventListener('load',()=>setTimeout(()=>markReady(deliveredCreative()?'ready':'unavailable'),3500),{once:true});
monetagScript?.addEventListener('error',()=>markReady('unavailable'),{once:true});
setTimeout(()=>markReady(deliveredCreative()?'ready':'unavailable'),7000);
