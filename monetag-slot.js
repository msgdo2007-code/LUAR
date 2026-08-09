(function(s){s.dataset.zone='11539704',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));
const notifyAdStatus=status=>parent.postMessage({type:'luar-ad-status',status},location.origin);
const monetagScript=document.querySelector('script[data-zone="11539704"]');
let statusSent=false;
const markReady=delayed=>{
  if(statusSent)return;
  statusSent=true;
  document.body.classList.add(delayed?'ad-network-delayed':'ad-network-ready');
  notifyAdStatus('ready');
};
monetagScript?.addEventListener('load',()=>markReady(false),{once:true});
monetagScript?.addEventListener('error',()=>markReady(true),{once:true});
setTimeout(()=>markReady(true),7000);
