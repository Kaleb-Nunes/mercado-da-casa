/* Despensa: correção defensiva do cache offline para produção.
   Dados financeiros, respostas de APIs, URLs desconhecidas e recursos de outros projetos
   não são armazenados. Os dados do usuário em localStorage não são alterados. */
const CACHE = "despensa-v7";
const CORE = [
  "./", "./index.html", "./manifest.webmanifest",
  "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png",
  "./icon-maskable-512.png", "./favicon.svg", "./ofertas.json", "./vendor/firebase.js"
];
const ESCOPO = new URL("./", self.location.href).pathname;
const CORE_PATHS = new Set(CORE.map(p => new URL(p, self.location.href).pathname));
const antigaDoApp = (nome) => /^despensa-v[0-9]+$/.test(nome);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  /* Não excluir caches de outras aplicações ou versões de homologação do mesmo origin. */
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && antigaDoApp(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Não interceptar chamadas externas, projetos irmãos ou caminhos de API. */
  if (url.origin !== self.location.origin || !url.pathname.startsWith(ESCOPO)) return;
  if (url.pathname.startsWith(ESCOPO + "api/") || url.pathname.startsWith("/api/")) return;

  const navegacao = req.mode === "navigate";
  const estatico = CORE_PATHS.has(url.pathname) && !url.search;
  /* Não armazena URLs com query nem responde por endpoints não permitidos. */
  if (!estatico && !navegacao) return;

  e.respondWith(fetch(req).then((res) => {
    if (estatico && res.ok && res.type === "basic" &&
        !res.headers.has("set-cookie") &&
        !/private|no-store/i.test(res.headers.get("cache-control") || "")) {
      const copia = res.clone();
      e.waitUntil(caches.open(CACHE).then(c => c.put(req, copia)));
    }
    return res;
  }).catch((err) => {
    if (estatico) return caches.match(req).then(r => r || Promise.reject(err));
    if (navegacao) return caches.match("./index.html").then(r => r || Promise.reject(err));
    return Promise.reject(err);
  }));
});
