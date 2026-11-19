/* Elida: funciona sem internet no mercado. Rede primeiro, cópia guardada se cair.
   Produção e homologação usam caches com nomes diferentes. */
importScripts("./ambiente.js");
/* Mesma decisão do app: só a lista de homologação de ambiente.js é homologação. */
const AMB = self.ElidaAmbiente.resolver(self.location);
const PRODUCAO = AMB.producao;
const CACHE = AMB.prefixoCache + "-v8";
const CORE = ["./", "./index.html", "./ambiente.js", "./dieta.js", "./manifest.webmanifest", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./favicon.svg", "./ofertas.json", "./vendor/firebase.js", "./fonts/fraunces.woff2", "./fonts/onest.woff2"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  /* Apaga só versões antigas deste app neste ambiente. Outros sites do mesmo domínio
     (kaleb-nunes.github.io/...) e a homologação não são tocados. */
  const meu = (k) => PRODUCAO ? /^despensa-v\d+$/.test(k) : /^despensa-hml-v\d+$/.test(k);
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && meu(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true })
        .then((r) => r || caches.match("./"))
        .then((r) => r || caches.match("./index.html")))
    );
  }
});
