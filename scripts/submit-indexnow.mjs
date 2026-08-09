const host = 'luarhub.site';
const key = '4cd007b3a9194c24af0503a5dc5f7e1d';
const sitemap = await fetch(`https://${host}/sitemap.xml`).then(response => {
  if (!response.ok) throw new Error(`Sitemap indisponível: ${response.status}`);
  return response.text();
});
const urlList = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList })
});
if (!response.ok && response.status !== 202) throw new Error(`IndexNow recusou o envio: ${response.status} ${await response.text()}`);
console.log(`IndexNow recebeu ${urlList.length} URLs (${response.status}).`);
