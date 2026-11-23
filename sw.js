/* Elida: funciona sem internet no mercado. Rede primeiro, cópia guardada se cair.
   Produção e homologação usam caches com nomes diferentes. */
importScripts("./ambiente.js");
/* Mesma decisão do app: só a lista de homologação de ambiente.js é homologação. */
const AMB = self.ElidaAmbiente.resolver(self.location);
const PRODUCAO = AMB.producao;
const CACHE = AMB.prefixoCache + "-v32";
/* Leitor de rótulos (cerca de 5 MB): cache próprio, fora da versão do app, para não baixar de novo a cada atualização. */
const CACHE_OCR = AMB.prefixoCache + "-ocr-1";
const CORE = ["./", "./index.html", "./ambiente.js", "./dieta.js", "./elida-regras.js", "./elida-busca.js", "./elida-ocr.js", "./elida-backup-seguro.js", "./elida-supabase-config.js", "./vendor/supabase/sdk.js", "./elida-conta.js", "./elida-entrada.js", "./elida-entrada.css", "./elida-uau.css", "./elida-demo.js", "./elida-uau.js", "./elida-radar.js", "./elida-dossie.js", "./marca/familia-confere-rotulo.webp", "./marca/orientacao-rotulo.webp", "./marca/ervas-boas-vindas.webp", "./marca/logo-horizontal.svg", "./marca/apple-login.png", "./marca/facebook-login.png", "./marca/google-login.png", "./elida-aprovacao.js", "./elida-app.js", "./manifest.webmanifest", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./favicon.svg", "./ofertas.json", "./vendor/firebase.js", "./fonts/fraunces.woff2", "./fonts/onest.woff2"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  /* Apaga só versões antigas deste app neste ambiente. Outros sites do mesmo domínio
     (kaleb-nunes.github.io/...) e a homologação não são tocados. */
  const meu = (k) => PRODUCAO ? /^despensa-v\d+$/.test(k) : /^despensa-hml-v\d+$/.test(k);
  /* CACHE_OCR (despensa[-hml]-ocr-N) não casa com essas expressões e sobrevive às atualizações do app. */
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && meu(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Política de cache explícita: somente recursos estáticos públicos do aplicativo.
   Jamais armazenar /api/, respostas autenticadas, caminhos desconhecidos ou URLs
   com query string. Em navegação, servir apenas o shell offline, nunca dados de API. */
const CORE_PATHS = new Set(CORE.map((p) => new URL(p, self.location.href).pathname));
const OCR_PREFIX = new URL("./vendor/ocr/", self.location.href).pathname;
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.search) return;
  if (url.pathname.startsWith(new URL("./api/", self.location.href).pathname)
      || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith(OCR_PREFIX)) {
    /* Restringe o cache do OCR a arquivos locais conhecidos, sem rotas dinâmicas. */
    if (!/\.(?:js|gz|wasm)(?:\.js)?$/.test(url.pathname)) return;
    e.respondWith(caches.open(CACHE_OCR).then((c) =>
      c.match(req).then((r) => r || fetch(req).then((res) => {
        if (res.ok && res.type === "basic" && !res.headers.has("set-cookie")
            && !/private|no-store/i.test(res.headers.get("cache-control") || "")) {
          const copia = res.clone();
          c.put(req, copia);
        }
        return res;
      }))));
    return;
  }

  const estatico = CORE_PATHS.has(url.pathname);
  const navegacao = req.mode === "navigate";
  if (!estatico && !navegacao) return;
  e.respondWith(fetch(req).then((res) => {
    if (estatico && res.ok && res.type === "basic" && !res.headers.has("set-cookie")
        && !/private|no-store/i.test(res.headers.get("cache-control") || "")) {
      const copia = res.clone();
      e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copia)));
    }
    return res;
  }).catch((err) => {
    if (estatico) return caches.match(req).then((r) => r || Promise.reject(err));
    if (navegacao) return caches.match("./index.html").then((r) => r || Promise.reject(err));
    return Promise.reject(err);
  }));
});

