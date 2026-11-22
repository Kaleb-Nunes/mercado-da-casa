(async function(){
  "use strict";
  if(window.ElidaConta && window.ElidaConta.bootstrap) await window.ElidaConta.bootstrap();
  /* Ambiente. Produção é só o endereço publicado. Qualquer outro (prévia, teste local) é homologação:
     os dados ficam com prefixo próprio e o Firebase de produção não é usado. */
  /* Ambiente pela configuração explícita de ambiente.js: só endereços da lista de homologação
     são homologação; qualquer outro (inclusive domínio próprio) é produção. */
  var AMB = window.ElidaAmbiente ? window.ElidaAmbiente.resolver(location) : { producao: true, homologacao: false, prefixoDados: "", catalogoFicticio: false, dadosDeTeste: false };
  var PRODUCAO = AMB.producao, HML = AMB.homologacao, PFX = AMB.prefixoDados + (window.ElidaConta ? window.ElidaConta.sufixo() : "");
  var KEY = PFX + "mercado-casa-v1";
  var CATS = ["Mercearia","Proteínas","Hortifruti","Bebidas","Bebê","Limpeza e casa","Outros"];
  var TIPOS = ["Mercado","Feira","Açougue","Farmácia","Bebê","Outros"];
  var MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  var BASE_DATE = "2026-11-17", BASE_LOCAL = "Referência";

  /* Catálogo inicial de exemplo: itens comuns, com preço de referência de novembro de 2026 */
  var SEED = [
    ["Mercearia","Arroz branco Kika","pacote 5 kg",19.99,"",1],
    ["Mercearia","Feijão preto Urbano","pacote 1 kg",6.99,"",1],
    ["Mercearia","Tapioca Tupã","pacote 1 kg",8.99,"",1],
    ["Mercearia","Aveia em flocos Vitão","pacote 400 g",8.69,"",0],
    ["Mercearia","Macarrão parafuso MariMassas","pacote 500 g",2.29,"",0],
    ["Mercearia","Milho de pipoca Kanty","pacote 400 g",4.49,"",0],
    ["Mercearia","Molho de tomate Paladori","sachê 300 g",0.99,"Com CPF no caixa. Sem CPF: R$ 1,29",1],
    ["Mercearia","Flocão de milho Sinhá","pacote 400 g",2.59,"",1],
    ["Proteínas","Ovos brancos","bandeja 30 un.",16.99,"",1],
    ["Proteínas","Frango passarinho Pioneiro","pacote 750 g",7.99,"Na promoção de 2 pacotes. Normal: R$ 8,99",1],
    ["Proteínas","Filé de peito de frango Canção","pacote 1 kg",21.99,"",0],
    ["Proteínas","Carne moída de primeira","kg",54.90,"Músculo moído sai mais barato",0],
    ["Proteínas","Músculo moído","kg",44.90,"",0],
    ["Proteínas","Atum sólido natural Gomes da Costa","lata 170 g",12.49,"",0],
    ["Hortifruti","Tomate","kg",21.99,"",1],
    ["Hortifruti","Cebola","kg",9.99,"",1],
    ["Hortifruti","Alho","kg",26.99,"",0],
    ["Hortifruti","Batata lavada","kg",6.49,"",1],
    ["Hortifruti","Batata rosa","kg",8.99,"",0],
    ["Hortifruti","Cenoura","kg",5.49,"",0],
    ["Hortifruti","Abóbora cabotiá","kg",4.99,"",0],
    ["Hortifruti","Repolho verde","unidade",4.49,"",0],
    ["Hortifruti","Banana prata orgânica","pacote 800 g",6.29,"",1],
    ["Hortifruti","Laranja","kg",6.99,"",0],
    ["Hortifruti","Maçã gala","kg",9.99,"",0],
    ["Hortifruti","Mamão papaia","kg",9.99,"",0],
    ["Hortifruti","Manga Tommy","kg",6.79,"",0],
    ["Hortifruti","Limão taiti","kg",15.49,"",0],
    ["Bebidas","Água de coco Mais Coco","caixa 1 L",8.99,"",0],
    ["Bebidas","Energético Baly","lata 473 ml",6.79,"",0]
  ];

  /* Só na homologação: cenário fictício para testar no celular (nenhum dado da família). */
  function dadosDeTeste(){
    var s = seedState(), hoje = todayStr(), k = monthKey(hoje);
    var add = function(id, cat, nome, por, preco, lista){ s.items.push({id:id, cat:cat, nome:nome, por:por, hist: preco ? [{p:preco, m:"Mercado Teste", d:hoje}] : [], nota:"", basico:false, lista:!!lista, qtd:1, ok:false}); };
    add("t1", "Mercearia", "Leite condensado (teste)", "lata 395 g", 6.49, true);
    add("t2", "Mercearia", "Qjo mussarela fatiado (teste)", "pacote 150 g", 9.9, true);
    add("t3", "Mercearia", "Biscoito recheado (teste)", "pacote 130 g", 3.79, true);
    add("t4", "Bebê", "Fórmula infantil (teste)", "lata 800 g", 89.9, true);
    add("t5", "Limpeza e casa", "Detergente (teste)", "frasco 500 ml", 2.49, true);
    add("t6", "Mercearia", "Bebida de arroz (teste)", "caixa 1 L", 12.9, false);
    s.dieta = DietaMotor.dietaDoModelo("sem-leite");
    s.meses[k] = {orc: 1500, gastos: [
      {id:"g1", valor: 214.37, local:"Mercado Teste", tipo:"Mercado", data: hoje, obs:"compra de teste"},
      {id:"g2", valor: 38.5, local:"Feira Teste", tipo:"Feira", data: hoje, obs:""}]};
    s.mes = k; s.dica = false;
    return s;
  }
  function seedState(){
    var items = SEED.map(function(r,i){
      return {id:"s"+i, cat:r[0], nome:r[1], por:r[2], hist:[{p:r[3], m:BASE_LOCAL, d:BASE_DATE}], nota:r[4], basico:!!r[5], lista:false, qtd:1, ok:false};
    });
    var meses = {};
    return {v:1, items:items, meses:meses, mes:monthKey(todayStr()), dica:true, dieta:defaultDieta(), importados:[]};
  }

  /* ---------- Utilidades ---------- */
  function pad(n){ return (n < 10 ? "0" : "") + n; }
  function todayStr(){ var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
  function monthKey(s){ return String(s).slice(0,7); }
  function monthName(k){ var p = k.split("-"); return MESES[parseInt(p[1],10)-1] + " " + p[0]; }
  function monthShort(k){ var p = k.split("-"); return MESES[parseInt(p[1],10)-1].slice(0,3).toLowerCase() + "/" + p[0].slice(2); }
  function shiftMonth(k, n){ var p = k.split("-"); var d = new Date(parseInt(p[0],10), parseInt(p[1],10)-1+n, 1); return d.getFullYear() + "-" + pad(d.getMonth()+1); }
  function dShort(s){ var p = String(s).split("-"); return p[2] + "/" + p[1]; }
  function daysInMonth(k){ var p = k.split("-"); return new Date(parseInt(p[0],10), parseInt(p[1],10), 0).getDate(); }
  function fmt(n){ return (Math.round(n*100)/100).toLocaleString("pt-BR",{minimumFractionDigits:2, maximumFractionDigits:2}); }
  function brl(n){ return "R$ " + fmt(n); }
  function parseMoney(v){
    if(v == null) return null;
    var s = String(v).trim().replace(/[^\d,.]/g,"");
    if(!s) return null;
    if(s.indexOf(",") >= 0){ s = s.replace(/\./g,"").replace(",","."); }
    var n = parseFloat(s);
    return isFinite(n) && n >= 0 ? Math.round(n*100)/100 : null;
  }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  /* Sanitização de URLs/miniaturas: valores de backups e códigos importados NÃO são HTML confiável. */
  function urlExternaSegura(valor){
    if(typeof valor !== "string" || valor.length > 2048) return "";
    try {
      var u = new URL(valor);
      return u.protocol === "https:" && !u.username && !u.password ? u.href : "";
    } catch(e){ return ""; }
  }
  function miniaturaSegura(valor){
    if(typeof valor !== "string" || valor.length > 1500000) return "";
    /* Miniaturas do app são codificadas em base64. SVG e URLs remotas não são permitidos. */
    return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(valor) ? valor : "";
  }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function isKg(it){ return it.por === "kg"; }
  function cur(it){ return it.hist && it.hist.length ? it.hist[it.hist.length-1] : null; }
  function prevPrice(it){ return it.hist && it.hist.length > 1 ? it.hist[it.hist.length-2] : null; }
  function variation(it){ var c = cur(it), p = prevPrice(it); if(!c || !p || !p.p) return 0; return (c.p - p.p) / p.p * 100; }
  function initials(s){ return String(s).slice(0,1).toUpperCase(); }
  function norm(s){ return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
  function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
  function dLong(s){ var p = String(s).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function daysUntil(s){ var p = String(s).split("-"); var t = new Date(+p[0], +p[1]-1, +p[2]); var n = new Date(); n.setHours(0,0,0,0); return Math.round((t - n) / 86400000); }
  var ICON_MAP = [["molho","🥫"],["extrato","🥫"],["leite de coco","🥥"],["agua de coco","🥥"],["coco","🥥"],["pipoca","🍿"],["flocao","🌽"],["cuscuz","🌽"],["milho","🌽"],["macarrao","🍝"],["massa","🍝"],["espaguete","🍝"],["arroz","🍚"],["feijao","🫘"],["lentilha","🫘"],["grao","🫘"],["ovo","🥚"],["frango","🍗"],["peito","🍗"],["coxa","🍗"],["sobrecoxa","🍗"],["salsicha","🌭"],["carne","🥩"],["musculo","🥩"],["bife","🥩"],["patinho","🥩"],["acem","🥩"],["peixe","🐟"],["tilapia","🐟"],["sardinha","🐟"],["atum","🐟"],["tomate","🍅"],["cebola","🧅"],["alho","🧄"],["batata","🥔"],["mandioca","🥔"],["aipim","🥔"],["cenoura","🥕"],["abobora","🎃"],["repolho","🥬"],["couve","🥬"],["alface","🥬"],["espinafre","🥬"],["brocolis","🥦"],["banana","🍌"],["laranja","🍊"],["mexerica","🍊"],["maca","🍎"],["manga","🥭"],["mamao","🍈"],["melao","🍈"],["limao","🍋"],["morango","🍓"],["uva","🍇"],["abacate","🥑"],["energetico","⚡"],["refrigerante","🥤"],["suco","🧃"],["agua","💧"],["cafe","☕"],["aveia","🥣"],["granola","🥣"],["tapioca","🫓"],["pao","🍞"],["farinha","🌾"],["acucar","🍬"],["sal","🧂"],["oleo","🫒"],["azeite","🫒"],["amendoim","🥜"],["castanha","🌰"],["fralda","🧷"],["lenco","🧻"],["papel","🧻"],["sabao","🧼"],["detergente","🧴"],["amaciante","🧴"]];
  var CAT_IC = {"Mercearia":"🛒","Proteínas":"🍖","Hortifruti":"🥗","Bebidas":"🥤","Bebê":"🍼","Limpeza e casa":"🧽","Outros":"🛍️"};
  var TIPO_IC = {"Mercado":"🛒","Feira":"🥕","Açougue":"🥩","Farmácia":"💊","Bebê":"🍼","Outros":"🛍️"};
  var EMOJI_CHOICES = ["🍚","🫘","🥚","🍗","🥩","🐟","🍝","🥣","🌽","🫓","🍿","🥫","🍅","🧅","🧄","🥔","🥕","🎃","🥬","🥦","🍌","🍊","🍎","🥭","🍋","🍈","🥑","🥥","⚡","🥤","☕","🍞","🥜","🧂","🫒","🍼","🧼","🧻","🛒"];
  function autoIcon(name, cat){
    var n = norm(name);
    for(var i = 0; i < ICON_MAP.length; i++){ if(new RegExp("(^|[^a-z0-9])" + escRe(ICON_MAP[i][0])).test(n)) return ICON_MAP[i][1]; }
    return CAT_IC[cat] || "🛒";
  }
  var FOTO_KEY = PFX + "mercado-casa-fotos", fotos = {};
  function loadFotos(){ try{ var r = localStorage.getItem(FOTO_KEY); if(r){ var o = JSON.parse(r); if(o && typeof o === "object") fotos = o; } }catch(e){} }
  function saveFotos(){ try{ localStorage.setItem(FOTO_KEY, JSON.stringify(fotos)); return true; }catch(e){ toast("Sem espaço pra mais fotos neste celular"); return false; } }
  function thumb(it, cls, icon, foto){
    var f = miniaturaSegura(foto !== undefined ? foto : fotos[it.id]);
    var classe = esc(cls || "");
    if(f) return '<span class="thumb ' + classe + '"><img src="' + esc(f) + '" alt=""></span>';
    return '<span class="thumb ' + classe + '" aria-hidden="true">' + esc(icon || it.icon || autoIcon(it.nome, it.cat)) + '</span>';
  }
  function fileToThumb(file, cb){
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function(){
      var s = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - s) / 2, sy = (img.naturalHeight - s) / 2;
      var c = document.createElement("canvas"); c.width = c.height = 240;
      c.getContext("2d").drawImage(img, sx, sy, s, s, 0, 0, 240, 240);
      URL.revokeObjectURL(url); cb(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = function(){ URL.revokeObjectURL(url); toast("Não deu pra abrir essa foto"); };
    img.src = url;
  }
  function picPicker(current, hasFoto){
    return '<div class="fl"><label>Imagem do item</label><div class="pic-actions">' +
      '<label class="btn-sm" for="foto-input">📷 Tirar ou escolher foto</label>' +
      (hasFoto ? '<button class="btn-sm" type="button" data-act="remover-foto">Remover foto</button>' : '') +
      '</div><input type="file" id="foto-input" class="vh" accept="image/*">' +
      '<div class="emojis" role="radiogroup" aria-label="Ícone">' + EMOJI_CHOICES.map(function(e){
        return '<button class="emo' + (e === current ? ' on' : '') + '" type="button" role="radio" aria-checked="' + (e === current ? 'true' : 'false') + '" data-act="set-icone" data-v="' + e + '">' + e + '</button>';
      }).join("") + '</div><p class="note-sm">A foto fica só neste celular e não entra no backup.</p></div>';
  }
  var MK_COLORS = ["#0F3B2E","#B4531A","#2F5D8A","#7A3E6A","#8A6A1F","#3B6E4F","#9C2F3B","#36507A"];
  /* "Koch BC", "Supermercados Koch" e "Koch" são o mesmo mercado: a chave é a primeira palavra que não é genérica */
  function mkKey(name){ var n = norm(name).replace(/[^a-z0-9 ]/g, " ").replace(/^\s*((supermercados?|super|mercados?|rede|atacado)\s+)+/, "").trim(); return n.split(/\s+/)[0] || n; }
  function sameMk(a, b){ return !!a && !!b && mkKey(a) === mkKey(b); }
  function mkColor(name){ var n = mkKey(name), x = 0; for(var i = 0; i < n.length; i++){ x = (x * 31 + n.charCodeAt(i)) >>> 0; } return MK_COLORS[x % MK_COLORS.length]; }
  function mkInitial(name){ var w = mkKey(name) || "?"; return w.charAt(0).toUpperCase(); }
  function mkBadge(name, cls){ if(!name) return ""; return '<span class="mk ' + (cls || "") + '" style="background:' + mkColor(name) + '" aria-hidden="true">' + esc(mkInitial(name)) + '</span>'; }
  function priceInMonth(it, key){ var r = null; (it.hist || []).forEach(function(x){ if(String(x.d).slice(0,7) === key) r = x; }); return r; }
  function priceBefore(it, key){ var r = null; (it.hist || []).forEach(function(x){ if(String(x.d).slice(0,7) < key) r = x; }); return r; }
  function monthChanges(key){
    var out = [];
    state.items.forEach(function(it){
      var b = priceInMonth(it, key), a = priceBefore(it, key);
      if(a && b && a.p > 0) out.push({it: it, a: a, b: b, pct: (b.p - a.p) / a.p * 100});
    });
    out.sort(function(x, y){ return y.pct - x.pct; });
    return out;
  }
  function byMarket(it){
    var m = {};
    (it.hist || []).forEach(function(x){ if(x.m && x.m !== BASE_LOCAL) m[x.m] = x; });
    return Object.keys(m).map(function(k){ return m[k]; }).sort(function(a, b){ return a.p - b.p; });
  }
  function cheaperElsewhere(it){
    var c = cur(it); if(!c) return null;
    var list = byMarket(it); if(list.length < 2) return null;
    var best = list[0];
    return (best.m !== c.m && best.p < c.p * 0.98) ? best : null;
  }
  function pctTxt(v){ return (Math.round(Math.abs(v) * 10) / 10).toLocaleString("pt-BR") + "%"; }
  function mesNome(k){ return MESES[parseInt(k.slice(5),10)-1].toLowerCase(); }
  function dicas(k){
    var out = [], m = mesData(k, false), gasto = gastoTotal(m), orc = m.orc || 0, nowKey = monthKey(todayStr());
    if(k === nowKey && orc > 0){
      var day = new Date().getDate(), dim = daysInMonth(k);
      var left = dim - day + 1, sobra = orc - gasto;
      if(sobra < 0) out.push(["⚠️", "O mês já passou " + brl(-sobra) + " do orçamento. Até o dia " + dim + ", só o essencial da lista."]);
      else if(gasto > 0 && sobra / left < 8) out.push(["⚠️", "Sobram " + brl(sobra) + " pra " + left + (left === 1 ? " dia" : " dias") + " (" + brl(sobra / left) + " por dia). Priorize proteína e o básico da lista."]);
    }
    if(k === nowKey){
      var om = ofertasPorItem(), lst = state.items.filter(function(i){ return i.lista && om[i.id]; });
      if(!lst.length) lst = state.items.filter(function(i){ return i.basico && om[i.id] && cur(i); });
      if(lst.length){
        var bo = lst.map(function(i){ var c = cur(i); return {it: i, o: om[i.id], e: c ? c.p - om[i.id].p : 0}; }).sort(function(a, b){ return b.e - a.e; })[0];
        out.push(["🏷️", bo.it.nome + " está em oferta no " + bo.o.m + " por " + brl(bo.o.p) + (bo.e > 0 ? ", " + brl(bo.e) + " a menos que da última vez" : "") + (bo.o.fim ? " (" + ateTxt(bo.o.fim) + ")" : "") + "."]);
      }
    }
    var ch = monthChanges(k).filter(function(c){ return c.pct >= 8; });
    if(ch.length){ var c0 = ch[0]; out.push(["📈", c0.it.nome + " subiu " + pctTxt(c0.pct) + " (de " + brl(c0.a.p) + " pra " + brl(c0.b.p) + "). Compare em outro mercado antes de levar."]); }
    var pool = state.items.filter(function(i){ return i.lista; }), fromList = pool.length > 0; if(!fromList) pool = state.items;
    var cnt = {}, eco = {};
    pool.forEach(function(it){ var b = cheaperElsewhere(it), c = cur(it); if(b){ cnt[b.m] = (cnt[b.m] || 0) + 1; eco[b.m] = (eco[b.m] || 0) + (c.p - b.p) * (fromList ? (it.qtd || 1) : 1); } });
    var bm = Object.keys(cnt).sort(function(a, b){ return eco[b] - eco[a]; })[0];
    if(bm) out.push(["🏷️", cnt[bm] + (cnt[bm] === 1 ? " item" : " itens") + (fromList ? " da sua lista" : "") + (cnt[bm] === 1 ? " sai" : " saem") + " mais barato no " + bm + ": uns " + brl(eco[bm]) + " a menos pelos últimos preços."]);
    var mercados = {}; state.items.forEach(function(it){ (it.hist || []).forEach(function(x){ if(x.m) mercados[norm(x.m)] = 1; }); });
    if(out.length < 3 && Object.keys(mercados).length < 2) out.push(["💡", "Quando comprar em outro mercado, corrija os preços lá. Com dois mercados, o app mostra onde cada item sai mais barato."]);
    if(out.length < 3 && !monthChanges(k).length) out.push(["📅", "Em " + mesNome(shiftMonth(k, 1)) + " o app começa a comparar sozinho e mostra o que subiu. Os preços de " + mesNome(k) + " já estão guardados."]);
    return out.slice(0, 3);
  }
  function mudancasHtml(){
    var k = monthKey(todayStr()), ch = monthChanges(k);
    var titulo = '<h3 style="margin:0 0 6px;font-family:var(--font-display);font-weight:600;font-size:19px">O que subiu no mês</h3>';
    if(!ch.length) return '<div class="card pad">' + titulo + '<p class="note-sm">A comparação aparece quando um item tiver preço de dois meses. Os preços de ' + mesNome(k) + ' já estão guardados, então em ' + mesNome(shiftMonth(k, 1)) + ' ela começa sozinha.</p></div>';
    var avg = ch.reduce(function(s, c){ return s + c.pct; }, 0) / ch.length;
    var ups = ch.filter(function(c){ return c.pct >= 0.5; }).slice(0, 4), downs = ch.filter(function(c){ return c.pct <= -0.5; }).reverse().slice(0, 3);
    var row = function(c){ return '<div class="chg"><span>' + esc(c.it.nome) + '</span><b class="' + (c.pct > 0 ? 'up' : 'down') + '">' + (c.pct > 0 ? '↑ ' : '↓ ') + pctTxt(c.pct) + ' · ' + brl(c.b.p) + '</b></div>'; };
    return '<div class="card"><div class="pad" style="padding-bottom:8px">' + titulo + '<div class="s-meta">Sua cesta, comparada ao preço anterior de ' + ch.length + (ch.length === 1 ? ' item' : ' itens') + '</div>' +
      '<div class="cesta ' + (avg > 0 ? 'up' : 'down') + '">' + (avg > 0 ? '+' : '−') + pctTxt(avg) + '</div></div>' + ups.map(row).join("") + downs.map(row).join("") + '</div>';
  }
  /* Dieta: o motor fica em dieta.js. Três avisos: evitar, conferido, informação insuficiente (o padrão). */
  function defaultDieta(){ return DietaMotor.dietaVazia(); }
  function atualizarMarcas(){
    if(!state || !state.dieta || !state.dieta.ativa) return;
    state.items.forEach(function(it){ var ev = DietaMotor.marcaEvitar(it, state.dieta); if(ev) it.ev = ev; else delete it.ev; });
  }
  function dietaAval(it){ return DietaMotor.avaliar(typeof it === "string" ? {nome: it} : it, state && state.dieta, {hoje: todayStr()}); }
  function dietFlag(it){ var r = dietaAval(it); return r.estado === "evitar" ? r.termo : null; }
  function dietaLinha(it){
    var r = dietaAval(it);
    if(r.estado === "evitar") return '<div class="flag-line">Evitar: tem “' + esc(r.termo) + '” · ' + DietaMotor.AVISO_CURTO + '</div>';
    if(r.estado === "conferido") return '<div class="diet-line ok">Rótulo conferido em ' + dShort(r.conferencia.d) + (r.conferencia.q ? ' por ' + esc(r.conferencia.q) : '') + '</div>';
    if(r.estado === "insuficiente" && r.avisoAnterior) return '<div class="flag-line">O nome mudou: antes tinha “' + esc(r.avisoAnterior.termo) + '”. Confira o rótulo</div>';
    if(r.estado === "insuficiente") return '<div class="diet-line">Informação insuficiente: confira o rótulo</div>';
    return '';
  }
  function dietaChip(it){
    var r = dietaAval(it);
    if(r.estado === "evitar") return '<span class="flag">evitar</span>';
    if(r.estado === "conferido") return '<span class="flag ok">conferido</span>';
    if(r.estado === "insuficiente" && r.avisoAnterior) return '<span class="flag">nome mudou</span>';
    if(r.estado === "insuficiente") return '<span class="flag q">conferir</span>';
    return '';
  }
  function dietaBox(it){
    var r = dietaAval(it), mod = DietaMotor.modeloPorId(state.dieta && state.dieta.modelo);
    if(r.estado === "evitar") return '<div class="dbox no" role="alert"><b>Evitar: o nome tem “' + esc(r.termo) + '”, que está na lista da dieta.</b><span>' + esc(DietaMotor.AVISO_FIXO) + '</span></div>';
    if(r.estado === "conferido") return '<div class="dbox ok"><b>Rótulo conferido em ' + dLong(r.conferencia.d) + (r.conferencia.q ? ' por ' + esc(r.conferencia.q) : '') + '</b>' +
      '<span>Isto registra a leitura de vocês, não diz que o produto é seguro. Vale até ' + dLong(r.conferencia.vence) + '. Embalagem nova ou receita nova: leia de novo. ' + esc(DietaMotor.AVISO_FIXO) + '</span>' +
      '<button class="quiet" type="button" data-act="desconferir" data-id="' + esc(it.id) + '">Desfazer conferência</button></div>';
    if(r.estado === "insuficiente" && r.avisoAnterior) return '<div class="dbox no" role="alert"><b>O nome deste item mudou. Antes ele era “' + esc(r.avisoAnterior.nome) + '” e tinha “' + esc(r.avisoAnterior.termo) + '”, que está na lista da dieta.</b><span>Trocar o nome não muda o produto. Leia o rótulo antes de comprar. ' + esc(DietaMotor.AVISO_FIXO) + '</span>' +
      '<button class="btn-sm" type="button" data-act="conferir" data-id="' + esc(it.id) + '">Li o rótulo deste produto</button></div>';
    if(r.estado === "insuficiente") return '<div class="dbox"><b>Informação insuficiente</b><span>Só pelo nome não dá para saber.' + (r.dica ? ' ' + esc(r.dica) : '') + (r.motivo ? ' ' + esc(r.motivo) : '') + ' ' + esc(DietaMotor.AVISO_CURTO) + '</span>' +
      (r.bloqueiaConferencia ? '' : '<button class="btn-sm" type="button" data-act="conferir" data-id="' + esc(it.id) + '">' + esc(mod ? mod.acaoConferir : 'Li o rótulo: não tem nada da lista') + '</button>') + '</div>';
    return '';
  }
  function dietaLigada(){ return !!(state.dieta && state.dieta.ativa && (state.dieta.modelo || (state.dieta.evitar || []).length)); }
  function avisoFixo(){ return dietaLigada() ? '<p class="aviso-fixo" role="note">' + esc(DietaMotor.AVISO_FIXO) + '</p>' : ''; }

  /* ---------- Ofertas: encartes da semana (ofertas.json) e ofertas importadas ---------- */
  var OF_KEY = PFX + "despensa-ofertas", remote = null;
  var DIAS = ["domingo","segunda","terça","quarta","quinta","sexta","sábado"];
  function addDays(s, n){ var p = String(s).split("-"); var d = new Date(+p[0], +p[1]-1, +p[2] + n); return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
  function weekday(s){ var p = String(s).split("-"); return new Date(+p[0], +p[1]-1, +p[2]).getDay(); }
  function ateTxt(fim){
    if(!fim) return "";
    var n = daysUntil(fim);
    if(n < 0) return "encerrada"; if(n === 0) return "termina hoje"; if(n === 1) return "termina amanhã";
    if(n <= 6) return "até " + DIAS[weekday(fim)] + ", " + dShort(fim);
    return "até " + dShort(fim);
  }
  function diasTxt(arr){
    var d = (arr || []).slice().sort(function(a, b){ return a - b; }).map(function(i){ return DIAS[i]; });
    if(d.length <= 1) return d.join("");
    return d.slice(0, -1).join(", ") + " e " + d[d.length - 1];
  }
  function validRemote(o){ return o && o.v === 1 && /^\d{4}-\d{2}-\d{2}$/.test(o.atualizado || ""); }
  function loadRemote(){ try{ var r = localStorage.getItem(OF_KEY); if(r){ var o = JSON.parse(r); if(validRemote(o)) remote = o; } }catch(e){} }
  function fetchRemote(){
    if(!window.fetch || location.protocol === "file:" || location.hostname.indexOf("claude") >= 0) return;
    fetch("ofertas.json", {cache: "no-store"}).then(function(r){ return r.ok ? r.json() : null; }).then(function(o){
      if(!validRemote(o)) return;
      if(remote && remote.atualizado === o.atualizado && JSON.stringify(remote) === JSON.stringify(o)) return;
      remote = o;
      try{ localStorage.setItem(OF_KEY, JSON.stringify(o)); }catch(e){}
      if(ui.view === "inicio" || ui.view === "ofertas" || ui.view === "precos" || ui.view === "lista") render();
    }).catch(function(){});
  }
  function encartesAtivos(){
    var t = todayStr(), mine = meusMercados();
    return ((remote && remote.encartes) || []).filter(function(e){ return e && e.m && (!e.fim || e.fim >= t) && (!e.ini || e.ini <= t); })
      .sort(function(a, b){ var ma = mine[mkKey(a.m)] ? 0 : 1, mb = mine[mkKey(b.m)] ? 0 : 1; return ma - mb || (a.fim || "9") .localeCompare(b.fim || "9") || a.m.localeCompare(b.m); });
  }
  function rotinasDoDia(w){ return ((remote && remote.rotinas) || []).filter(function(r){ return r && (r.dias || []).indexOf(w) >= 0; }); }
  function avisosAtivos(){
    var t = todayStr(), lidos = state.avisosLidos || [];
    return ((remote && remote.avisos) || []).filter(function(a){ return a && a.id && (!a.ate || a.ate >= t) && lidos.indexOf(a.id) < 0; });
  }
  function meusMercados(){
    var s = {};
    Object.keys(state.meses).forEach(function(k){ state.meses[k].gastos.forEach(function(g){ if(g.local) s[mkKey(g.local)] = 1; }); });
    state.items.forEach(function(it){ (it.hist || []).forEach(function(x){ if(x.m) s[mkKey(x.m)] = 1; }); });
    return s;
  }
  function allOfertas(){
    var t = todayStr(), out = [];
    ((remote && remote.ofertas) || []).forEach(function(o, i){ if(o && o.nome) out.push({id: o.id || ("r" + i + "-" + norm(o.nome).slice(0, 12)), m: o.m, nome: o.nome, cat: o.cat, por: o.por, p: +o.p, de: +o.de || 0, ini: o.ini || "", fim: o.fim || "", item: o.item || "", url: o.url || "", t: o.t || ""}); });
    (state.ofertas || []).forEach(function(o){ out.push(o); });
    return out.filter(function(o){ return o.m && o.p > 0 && (!o.fim || o.fim >= t) && (!o.ini || o.ini <= addDays(t, 2)); });
  }
  function findOferta(id){ var a = allOfertas(); for(var i = 0; i < a.length; i++){ if(a[i].id === id) return a[i]; } return null; }
  var STOP = {"de":1,"da":1,"do":1,"das":1,"dos":1,"com":1,"tipo":1,"para":1,"sem":1,"pct":1,"pacote":1,"unidade":1,"bandeja":1};
  function toks(s){ return norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(function(w){ return w.length >= 3 && !STOP[w] && !/\d/.test(w); }); }
  function sizeKey(s){
    var t = norm(s).replace(/,/g, "."), m = t.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|un)\b/);
    if(!m) return /(^|[^a-z])kg($|[^a-z])/.test(t) ? "kg" : "";
    var v = parseFloat(m[1]), u = m[2];
    if(u === "kg"){ v *= 1000; u = "g"; } if(u === "l"){ v *= 1000; u = "ml"; }
    return Math.round(v) + u;
  }
  /* Liga a oferta a um item cadastrado: pelo id, pelo nome igual ou pelo mesmo produto no mesmo tamanho */
  function matchItem(o){
    if(o.item){ var a = findItem(o.item); if(a) return a; }
    var b = findByName(o.nome); if(b) return b;
    var ot = toks(o.nome), osz = sizeKey((o.por || "") + " " + o.nome), best = null;
    if(!ot.length) return null;
    state.items.forEach(function(it){
      if(best) return;
      var tt = toks(it.nome); if(!tt.length || tt[0] !== ot[0]) return;
      if(tt.length > 1 && ot.length > 1 && tt[1] !== ot[1]) return;
      var isz = sizeKey((it.por || "") + " " + it.nome);
      if(isz !== osz) return;
      best = it;
    });
    return best;
  }
  function ofertaAtiva(it){ var o = it && it.oferta; if(!o || !(o.p > 0)) return null; if(o.fim && o.fim < todayStr()) return null; return o; }
  function precoEfetivo(it){ var o = ofertaAtiva(it), c = cur(it); if(o && (!c || o.p < c.p)) return o.p; return c ? c.p : 0; }
  /* Melhor oferta da semana pra cada item: só entra se for mais barata do que o último preço pago */
  function ofertasPorItem(){
    var map = {};
    allOfertas().forEach(function(o){
      var it = matchItem(o); if(!it) return;
      var c = cur(it); if(c && !(o.p < c.p * 0.99)) return;
      if(!map[it.id] || o.p < map[it.id].p) map[it.id] = o;
    });
    return map;
  }

  /* ---------- Estado ---------- */
  var mem = null;
  var state = null;
  var ui = {view:"inicio", filtro:"Todos", busca:"", sheet:null, armed:null};
  var installEvt = null;

  function load(){
    try{ var raw = localStorage.getItem(KEY); if(raw){ var s = JSON.parse(raw); if(valid(s)) return s; } }catch(e){}
    return mem;
  }
  function save(){
    atualizarMarcas();
    mem = state;
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){}
    agendarEnvio();
  }
  function valid(s){ return s && typeof s === "object" && Array.isArray(s.items) && s.meses && typeof s.meses === "object"; }
  function latestOrc(beforeKey){
    var keys = Object.keys(state.meses).sort(), orc = 0;
    keys.forEach(function(k){ if(!beforeKey || k <= beforeKey){ if(state.meses[k].orc) orc = state.meses[k].orc; } });
    return orc;
  }
  function mesData(k, create){
    if(state.meses[k]) return state.meses[k];
    var m = {orc: latestOrc(k), gastos: []};
    if(create) state.meses[k] = m;
    return m;
  }
  function gastoTotal(m){ return m.gastos.reduce(function(a,g){ return a + (g.valor || 0); }, 0); }
  function lastLocal(){
    var all = [];
    Object.keys(state.meses).forEach(function(k){ state.meses[k].gastos.forEach(function(g){ all.push(g); }); });
    all.sort(function(a,b){ return a.data < b.data ? 1 : -1; });
    return all.length ? all[0].local : "";
  }
  function locais(){
    var seen = {}, out = [];
    Object.keys(state.meses).forEach(function(k){ state.meses[k].gastos.forEach(function(g){ if(g.local && !seen[g.local]){ seen[g.local] = 1; out.push(g.local); } }); });
    state.items.forEach(function(it){ var c = cur(it); if(c && c.m && c.m !== BASE_LOCAL && !seen[c.m]){ seen[c.m] = 1; out.push(c.m); } });
    return out.slice(0,6);
  }

  /* ---------- Ícones ---------- */
  var IC = {
    left:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    right:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
    shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6Z"/></svg>',
    basket:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 26h48l-5 26a4 4 0 0 1-4 3H17a4 4 0 0 1-4-3Z"/><path d="m22 26 8-14M42 26l-8-14"/><path d="M24 36v10M32 36v10M40 36v10"/></svg>',
    receipt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3Z"/></svg>'
  };

  /* ---------- Início ---------- */
  function renderInicio(){
    var k = state.mes, m = mesData(k, false), gasto = gastoTotal(m), orc = m.orc || 0;
    var saldo = orc - gasto, pct = orc > 0 ? Math.min(100, gasto / orc * 100) : 0;
    var nowKey = monthKey(todayStr()), isNow = k === nowKey;
    var tip = "";
    if(orc > 0){
      if(saldo < 0){ tip = "Passou " + brl(-saldo) + " do orçamento"; }
      else if(isNow){
        var left = daysInMonth(k) - new Date().getDate() + 1;
        tip = "Dá " + brl(saldo / left) + " por dia até " + daysInMonth(k) + "/" + k.slice(5);
      } else if(k < nowKey){ tip = "Mês fechado com " + brl(saldo) + " de sobra"; }
      else { tip = "Mês ainda não começou"; }
    } else { tip = "Defina quanto pode gastar no mês"; }

    var jantar = jantarSalvo();
    var compras = state.items.filter(function(it){return it.lista;});
    var carrinho = compras.filter(function(it){return it.ok;}).length;
    var h = '<section class="inicio-jantar"><div class="jantar-corpo"><h2>' +
      (jantar ? esc(jantar.nome) : 'O que falta para o jantar?') + '</h2><p>' +
      (jantar ? 'Sua refeição está salva. Confira a despensa para a próxima compra.' : 'Escolha o prato, confira a despensa e leve só o que falta.') +
      '</p><button class="bigbtn" type="button" data-act="jantar">Planejar meu jantar</button></div></section>' +
      '<div class="mercado-acoes"><button class="inicio-rotulo" type="button" data-act="rotulo-foto">' +
      '<img src="marca/familia-confere-rotulo.webp" width="88" height="78" alt="">' +
      '<span>Ler rótulo por foto<small>Conferir a embalagem</small></span>' + IC.right + '</button>' +
      '<button type="button" class="inicio-delegar" data-act="delegar"><span>Comprar para alguém<small>Preparar uma lista para enviar</small></span>' + IC.right + '</button></div>';
    h += '<button type="button" class="inicio-consulta" data-act="consulta"><img src="marca/orientacao-rotulo.webp" width="68" height="64" alt=""><span><b>Levar à consulta</b><small>Guarde uma dúvida da compra para conversar com sua nutricionista.</small></span>'+IC.right+'</button>';
    if(compras.length){
      h += '<button type="button" class="compra-progresso" data-act="nav" data-view="lista"><b>Retomar minha compra</b>' +
        '<span>' + carrinho + ' de ' + compras.length + ' no carrinho</span><progress aria-label="Itens no carrinho" value="' + carrinho + '" max="' + compras.length + '"></progress></button>';
    }
    var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone;
    var android = /Android/i.test(navigator.userAgent) && !standalone;
    if(android && state.dicaIos !== false){
      h += '<div class="tip"><b>Deixe como app no Android</b><span>' + (installEvt ? 'Toque em <b>Instalar</b> e ele vai pra tela inicial.' : 'No Chrome, toque nos 3 pontinhos (⋮) e depois em <b>Adicionar à tela inicial</b> ou <b>Instalar app</b>.') + '</span>' +
        (installEvt ? '<button class="act" type="button" data-act="instalar">Instalar</button>' : '') +
        '<button class="x" type="button" data-act="fechar-ios">Entendi</button></div>';
    }
    if(ios && state.dicaIos !== false){
      h += '<div class="tip"><b>Deixe como app no iPhone</b><span>No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta pra cima) e depois em <b>Adicionar à Tela de Início</b>. Faça isso antes de anotar qualquer coisa: no iPhone, o app da tela inicial guarda os dados separado do Safari.</span>' +
        '<button class="x" type="button" data-act="fechar-ios">Entendi</button></div>';
    }
    var dd = state.dieta;
    if(dd && dd.ativa && dd.revisao){
      var nd = daysUntil(dd.revisao);
      if(nd <= 7){
        h += '<div class="tip"><b>' + (nd > 1 ? 'Faltam ' + nd + ' dias pra rever a dieta' : nd === 1 ? 'Amanhã é dia de rever a dieta' : nd === 0 ? 'Hoje é dia de rever a dieta' : 'A revisão da dieta era em ' + dLong(dd.revisao)) + '</b>' +
          '<span>Se o médico mudar a orientação, atualize os gatilhos pra o app continuar avisando certo.</span>' +
          '<button class="act" type="button" data-act="nav" data-view="rotulo">Ver dieta</button></div>';
      }
    }
    h += '<div class="mnav"><button class="round" type="button" data-act="mes-ant" aria-label="Mês anterior">' + IC.left + '</button>' +
      '<b>' + esc(monthName(k)) + '</b>' +
      '<button class="round" type="button" data-act="mes-prox" aria-label="Próximo mês">' + IC.right + '</button></div>';
    h += '<div class="hero"><div class="h-label">' + (saldo < 0 ? "Acima do orçamento" : "Ainda dá pra gastar") + '</div>' +
      '<div class="h-big' + (saldo < 0 ? ' neg' : '') + '"><small>R$</small>' + fmt(Math.abs(saldo)) + '</div>' +
      '<div class="h-line">Gasto <b>' + brl(gasto) + '</b> de <b>' + brl(orc) + '</b></div>' +
      '<div class="h-bar' + (saldo < 0 ? ' over' : '') + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="h-foot"><span class="h-tip">' + esc(tip) + '</span><button class="h-edit" type="button" data-act="orcamento">Alterar orçamento</button></div></div>';
    h += '<div class="quick">' +
      '<button class="qbtn" type="button" data-act="novo-gasto"><span class="ic">' + IC.plus + '</span><span>Anotar gasto<small>leva 10 segundos</small></span></button>' +
      '<button class="qbtn" type="button" data-act="nav" data-view="lista"><span class="ic">' + IC.list + '</span><span>Lista<small>' + listaCount() + '</small></span></button>' +
      '<button class="qbtn" type="button" data-act="colar-import" style="grid-column:1/-1"><span class="ic">' + IC.receipt + '</span><span>Importar compra do cupom<small>cole o código que chegou no WhatsApp</small></span></button></div>';
    if(isNow) h += rtCardHtml();
    if(isNow){ var och = ofertasCardHtml(); if(och) h += '<div class="section"><div class="s-head"><span class="s-title">Ofertas da semana</span>' + (remote ? '<span class="s-meta">atualizado ' + dShort(remote.atualizado) + '</span>' : '') + '</div>' + och + '</div>'; }
    var dc = dicas(k);
    if(dc.length) h += '<div class="section"><div class="s-head"><span class="s-title">Dicas pra economizar</span></div><div class="card"><ul class="tips">' +
      dc.map(function(d){ return '<li><span class="ti" aria-hidden="true">' + d[0] + '</span><span>' + esc(d[1]) + '</span></li>'; }).join("") + '</ul></div></div>';

    var gs = m.gastos.slice().sort(function(a,b){ return a.data < b.data ? 1 : (a.data > b.data ? -1 : 0); });
    h += '<div class="section"><div class="s-head"><span class="s-title">Gastos de ' + esc(MESES[parseInt(k.slice(5),10)-1].toLowerCase()) + '</span><span class="s-meta">' + gs.length + (gs.length === 1 ? ' compra' : ' compras') + '</span></div><div class="card">';
    if(!gs.length){
      h += '<div class="empty"><b>Nenhum gasto ainda</b>Toque no + para anotar a primeira compra do mês.</div>';
    } else {
      h += '<ul class="rows">' + gs.map(function(g){
        return '<li><button class="row" type="button" data-act="editar-gasto" data-id="' + esc(g.id) + '">' + (g.local ? mkBadge(g.local) : '<span class="avatar emoji" aria-hidden="true">' + (TIPO_IC[g.tipo] || '🛒') + '</span>') +
          '<span class="r-main"><span class="r-name">' + esc(g.local || g.tipo) + '</span><span class="r-meta">' + dShort(g.data) + ' · ' + esc(g.tipo) + (g.obs ? ' · ' + esc(g.obs) : '') + (Sync.casa && g.por ? ' · por ' + esc(g.por) : '') + '</span></span>' +
          '<span class="r-val">' + brl(g.valor) + '</span></button></li>';
      }).join("") + '</ul>';
    }
    h += '</div></div>';

    if(gs.length){
      var by = {}; gs.forEach(function(g){ by[g.tipo] = (by[g.tipo] || 0) + g.valor; });
      var keys = Object.keys(by).sort(function(a,b){ return by[b] - by[a]; });
      h += '<div class="section"><div class="s-head"><span class="s-title">Para onde foi o dinheiro</span></div><div class="card"><div class="bars">' +
        keys.map(function(t){ return '<div class="bar-row"><span>' + esc(t) + '</span><b class="num">' + brl(by[t]) + '</b><span class="t"><i style="width:' + (by[t] / gasto * 100) + '%"></i></span></div>'; }).join("") +
        '</div></div></div>';
    }

    if(gs.length){
      var bmk = {}; gs.forEach(function(g){ var l = g.local || g.tipo; bmk[l] = (bmk[l] || 0) + g.valor; });
      var mks = Object.keys(bmk).sort(function(a, b){ return bmk[b] - bmk[a]; });
      h += '<div class="section"><div class="s-head"><span class="s-title">Por mercado</span></div><div class="card"><ul class="rows">' +
        mks.map(function(l){ return '<li><div class="row">' + mkBadge(l) + '<span class="r-main"><span class="r-name">' + esc(l) + '</span><span class="r-meta">' + Math.round(bmk[l] / gasto * 100) + '% do mês</span></span><span class="r-val">' + brl(bmk[l]) + '</span></div></li>'; }).join("") +
        '</ul></div></div>';
    }
    var past = Object.keys(state.meses).filter(function(x){ return x !== k && state.meses[x].gastos.length; }).sort().reverse().slice(0,6);
    if(past.length){
      h += '<div class="section"><div class="s-head"><span class="s-title">Outros meses</span></div><div class="card"><ul class="rows">' +
        past.map(function(x){ var mm = state.meses[x], g = gastoTotal(mm), s = (mm.orc || 0) - g;
          return '<li><button class="row" type="button" data-act="ir-mes" data-k="' + x + '"><span class="r-main"><span class="r-name">' + esc(monthName(x)) + '</span><span class="r-meta">orçamento ' + brl(mm.orc || 0) + '</span></span>' +
            '<span class="r-val">' + brl(g) + '<small>' + (s >= 0 ? 'sobrou ' + brl(s) : 'passou ' + brl(-s)) + '</small></span></button></li>'; }).join("") +
        '</ul></div></div>';
    }

    h += '<div class="card pad"><div class="safe">' + IC.shield + '<div><p><b>Seus dados ficam só neste celular.</b> Uma vez por mês, faça um backup e guarde o arquivo no seu Drive ou nos Arquivos do celular. Se trocar de celular ou limpar o navegador, é só restaurar.</p>' +
      '<div class="links"><button class="link" type="button" data-act="backup">Fazer backup</button><button class="link" type="button" data-act="restaurar">Restaurar</button>' +
      '<a class="link" id="wa-resumo" href="#" target="_blank" rel="noopener">Enviar resumo do mês</a>' +
      (state.carta ? '<button class="link" type="button" data-act="ver-carta">Ler a mensagem</button>' : '') + '</div></div></div></div>';

    document.getElementById("view-inicio").innerHTML = h;
    var a = document.getElementById("wa-resumo");
    if(a) a.href = "https://wa.me/?text=" + encodeURIComponent(resumoTexto());
  }
  var TIPO_OF = {"Hortifruti":"oferta de hortifruti","Carnes":"oferta de carnes","Semanal":"encarte semanal"};
  function tipoTxt(r){ return TIPO_OF[r.tipo] || ("oferta de " + String(r.tipo || "").toLowerCase()); }
  function ofertasCardHtml(){
    var ofs = allOfertas(); if(!remote && !ofs.length) return "";
    var w = new Date().getDay();
    var hoje = rotinasDoDia(w).filter(function(r){ return r.tipo !== "Semanal"; });
    var amanha = rotinasDoDia((w + 1) % 7).filter(function(r){ return r.tipo !== "Semanal" && !hoje.some(function(x){ return sameMk(x.m, r.m) && x.tipo === r.tipo; }); });
    var enc = encartesAtivos(), om = ofertasPorItem(), boas = Object.keys(om).filter(function(k){ return cur(findItem(k)); }).length, lines = [];
    hoje.slice(0, 2).forEach(function(r){ lines.push([r.icone || "🏷️", '<b>Hoje tem ' + esc(tipoTxt(r)) + ' no ' + esc(r.m) + '</b>']); });
    if(!lines.length) amanha.slice(0, 1).forEach(function(r){ lines.push([r.icone || "🏷️", '<b>Amanhã tem ' + esc(tipoTxt(r)) + ' no ' + esc(r.m) + '</b>']); });
    if(boas) lines.push(["💚", '<b>' + boas + (boas === 1 ? ' oferta mais barata' : ' ofertas mais baratas') + '</b> do que você pagou da última vez']);
    else if(ofs.length) lines.push(["🏷️", ofs.length + (ofs.length === 1 ? ' oferta com preço' : ' ofertas com preço') + ' cadastradas']);
    if(enc.length){
      var soon = enc.slice().sort(function(a, b){ return (a.fim || "9").localeCompare(b.fim || "9"); })[0];
      lines.push(["📰", enc.length + (enc.length === 1 ? ' encarte valendo' : ' encartes valendo') + (soon && soon.fim && daysUntil(soon.fim) <= 2 ? ' · ' + esc(soon.titulo || soon.m) + ' ' + esc(ateTxt(soon.fim)) : '')]);
    }
    if(!lines.length) lines.push(["📰", "Nenhum encarte valendo agora. A lista volta a encher na próxima atualização."]);
    return '<button class="ofcard" type="button" data-act="nav" data-view="ofertas">' +
      lines.map(function(l){ return '<span class="of-line"><span class="ti" aria-hidden="true">' + esc(l[0]) + '</span><span>' + l[1] + '</span></span>'; }).join("") +
      '<span class="of-go">Ver ofertas da semana ›</span></button>';
  }
  function comPor(g){ if(Sync.casa && Sync.casa.eu) g.por = Sync.casa.eu; return g; }
  function listaCount(){ var n = state.items.filter(function(i){ return i.lista; }).length; return n ? n + (n === 1 ? " item" : " itens") + " pra comprar" : "vazia"; }
  function resumoTexto(){
    var k = state.mes, m = mesData(k,false), g = gastoTotal(m);
    var L = ["*Elida · " + monthName(k) + "*", "Orçamento: " + brl(m.orc || 0), "Gasto: " + brl(g), ((m.orc||0) - g >= 0 ? "Sobra: " : "Passou: ") + brl(Math.abs((m.orc||0) - g)), ""];
    m.gastos.slice().sort(function(a,b){ return a.data > b.data ? 1 : -1; }).forEach(function(x){ L.push(dShort(x.data) + " · " + (x.local || x.tipo) + " · " + brl(x.valor)); });
    return L.join("\n");
  }

  /* ---------- Preços ---------- */
  function renderPrecos(){
    var v = document.getElementById("view-precos");
    if(!v.dataset.built){
      v.innerHTML = '<div class="head-row"><div><h2 class="title">Preços</h2><p class="sub">O último valor pago em cada item.</p></div>' +
        '<div style="display:flex;gap:8px"><button class="btn-sm" type="button" data-act="nav" data-view="ofertas">🏷️ Ofertas</button><button class="btn-sm" type="button" data-act="novo-item">' + IC.plus + 'Novo</button></div></div>' + '<div id="precos-mudancas"></div>' +
        '<div class="searchbox"><label class="search" for="busca">' + IC.search + '<input id="busca" type="search" placeholder="Buscar item" autocomplete="off" enterkeyhint="search"></label>' +
        '<div class="chips" id="chips-cat"></div></div><div id="precos-lista" class="section"></div>';
      v.dataset.built = "1";
    }
    document.getElementById("precos-mudancas").innerHTML = mudancasHtml();
    var cats = ["Todos"].concat(CATS.filter(function(c){ return state.items.some(function(i){ return i.cat === c; }); }));
    document.getElementById("chips-cat").innerHTML = cats.map(function(c){
      return '<button class="chip' + (ui.filtro === c ? ' on' : '') + '" type="button" data-act="filtro" data-v="' + esc(c) + '">' + esc(c) + '</button>';
    }).join("");
    renderPrecosLista();
  }
  function renderPrecosLista(){
    var q = ui.busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    var list = state.items.filter(function(it){
      if(ui.filtro !== "Todos" && it.cat !== ui.filtro) return false;
      if(!q) return true;
      return it.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").indexOf(q) >= 0;
    });
    var h = "", om = ofertasPorItem();
    if(!list.length){
      h = '<div class="card"><div class="empty"><b>Nada encontrado</b>Toque em "Novo" para cadastrar esse item.</div></div>';
    } else {
      CATS.forEach(function(c){
        var group = list.filter(function(i){ return i.cat === c; }).sort(function(a,b){ return a.nome.localeCompare(b.nome,"pt-BR"); });
        if(!group.length) return;
        h += '<div class="section"><div class="s-head"><span class="s-title">' + esc(c) + '</span><span class="s-meta">' + group.length + '</span></div><div class="card"><ul class="rows">' +
          group.map(function(it){
            var c0 = cur(it), vr = variation(it);
            var vtag = Math.abs(vr) >= 0.5 ? '<span class="var ' + (vr > 0 ? 'up' : 'down') + '">' + (vr > 0 ? '↑ ' : '↓ ') + Math.round(Math.abs(vr)) + '%</span>' : '';
            return '<li><button class="row" type="button" data-act="item" data-id="' + esc(it.id) + '">' + thumb(it) + '<span class="r-main"><span class="r-name">' + esc(it.nome) + (it.lista ? '<span class="in-list" title="Na lista"></span>' : '') + dietaChip(it) + '</span>' +
              '<span class="r-meta">' + esc(it.por) + (c0 ? ' · ' + esc(c0.m || '') + ' ' + dShort(c0.d) : ' · sem preço') + vtag + (cheaperElsewhere(it) ? '<span class="var down">+ barato no ' + esc(cheaperElsewhere(it).m) + '</span>' : '') + (om[it.id] ? '<span class="var down">oferta ' + brl(om[it.id].p) + ' no ' + esc(om[it.id].m) + '</span>' : '') + '</span></span>' +
              '<span class="r-val">' + (c0 ? brl(c0.p) : '—') + (isKg(it) && c0 ? '<small>por kg</small>' : '') + '</span></button></li>';
          }).join("") + '</ul></div></div>';
      });
    }
    h += avisoFixo();
    document.getElementById("precos-lista").innerHTML = h;
  }

  /* ---------- Lista ---------- */
  function lineTotal(it){ return precoEfetivo(it) * (it.qtd || 1); }
  function qtdLabel(it){ return isKg(it) ? String(it.qtd).replace(".",",") + " kg" : it.qtd + " ×"; }
  function renderLista(){
    var items = state.items.filter(function(i){ return i.lista; });
    items.sort(function(a,b){ return (a.ok === b.ok) ? CATS.indexOf(a.cat) - CATS.indexOf(b.cat) || a.nome.localeCompare(b.nome,"pt-BR") : (a.ok ? 1 : -1); });
    var est = items.reduce(function(s,i){ return s + lineTotal(i); }, 0);
    var cart = items.filter(function(i){ return i.ok; }).reduce(function(s,i){ return s + lineTotal(i); }, 0);
    var done = items.filter(function(i){ return i.ok; }).length;
    var h = '<div><h2 class="title">Lista</h2><p class="sub">Monte antes de sair. No mercado, toque no círculo quando pôr no carrinho.</p></div>';
    h += '<button type="button" class="btn-sm" data-act="nova-duvida" data-motivo="falta">Registrar dificuldade para a consulta</button>';
    if(!items.length){
      h += '<div class="card"><div class="empty">' + IC.basket + '<b>Sua lista está vazia</b>Comece com o básico da casa ou escolha os itens em Preços.' +
        '<div class="sh-actions" style="margin-top:14px"><button class="bigbtn" type="button" data-act="basico">Começar com o básico</button>' +
        '<button class="bigbtn ghost" type="button" data-act="nav" data-view="precos">Escolher em Preços</button></div></div></div>';
      document.getElementById("view-lista").innerHTML = h;
      return;
    }
    h += '<div class="sum"><div><span>Estimado</span><b>' + brl(est) + '</b></div><div class="cart"><span>No carrinho · ' + done + ' de ' + items.length + '</span><b>' + brl(cart) + '</b></div></div>';
    h += '<div class="lista-acoes"><button type="button" class="btn-sm" data-act="delegar">Comprar para alguém</button><button type="button" class="btn-sm" data-act="comparar-custo">Comparar custo da receita</button></div>';
    h += '<div class="card"><ul class="rows">' + items.map(function(it){
      var c = cur(it), of = ofertaAtiva(it);
      return '<li><div class="litem' + (it.ok ? ' done' : '') + '">' +
        '<button class="check' + (it.ok ? ' on' : '') + '" type="button" data-act="ok" data-id="' + esc(it.id) + '" aria-pressed="' + (it.ok ? 'true' : 'false') + '" aria-label="' + esc(it.nome) + ' no carrinho">' + IC.check + '</button>' + thumb(it) +
        '<div class="r-main"><div class="r-name">' + esc(it.nome) + '</div><div class="r-meta">' + esc(it.por) + (c ? ' · ' + brl(c.p) + (isKg(it) ? '/kg' : '') : (of ? ' · ainda sem preço pago' : ' · sem preço')) + '</div>' +
        dietaLinha(it) +
        (of ? '<div class="cheap-line">Oferta no ' + esc(of.m) + ': ' + (of.nome && norm(of.nome) !== norm(it.nome) ? esc(of.nome) + ', ' : '') + brl(of.p) + (isKg(it) ? '/kg' : '') + (of.fim ? ' · ' + esc(ateTxt(of.fim)) : '') + '</div>' :
          (cheaperElsewhere(it) ? '<div class="cheap-line">Mais barato no ' + esc(cheaperElsewhere(it).m) + ': ' + brl(cheaperElsewhere(it).p) + '</div>' : '')) +
        '<div class="stepper"><button type="button" data-act="menos" data-id="' + esc(it.id) + '" aria-label="Menos">−</button><span>' + qtdLabel(it) + '</span><button type="button" data-act="mais" data-id="' + esc(it.id) + '" aria-label="Mais">+</button></div></div>' +
        '<button class="r-val" type="button" data-act="item" data-id="' + esc(it.id) + '" style="background:none;border:0;padding:0" aria-label="' + (precoEfetivo(it) ? brl(lineTotal(it)) : 'Sem preço') + ' corrigir preço de ' + esc(it.nome) + '">' + (precoEfetivo(it) ? brl(lineTotal(it)) : '<span aria-hidden="true">—</span>') + '<small> corrigir</small></button>' +
        '</div></li>';
    }).join("") + '</ul></div>';
    h += '<div class="sh-actions"><button class="bigbtn" type="button" data-act="finalizar">' + IC.check + 'Finalizar compra</button>' +
      '<a class="bigbtn wa" id="wa-lista" href="#" target="_blank" rel="noopener">' + IC.wa + 'Enviar lista no WhatsApp</a>' +
      '<button class="quiet' + (ui.armed === "limpar" ? ' armed' : '') + '" type="button" data-act="limpar">' + (ui.armed === "limpar" ? 'Toque de novo para limpar a lista' : 'Limpar lista') + '</button></div>';
    h += avisoFixo();
    document.getElementById("view-lista").innerHTML = h;
    var a = document.getElementById("wa-lista");
    if(a) a.href = "https://wa.me/?text=" + encodeURIComponent(listaTexto());
  }
  function listaTexto(){
    var items = state.items.filter(function(i){ return i.lista; });
    var L = ["*Lista de mercado*",""];
    items.forEach(function(it){ var of = ofertaAtiva(it); var fl = dietFlag(it); L.push((it.ok ? "✅ " : "⬜ ") + it.nome + " (" + qtdLabel(it) + " " + it.por + ")" + (precoEfetivo(it) ? " · ~" + brl(lineTotal(it)) : "") + (of ? " · oferta no " + of.m : "") + (fl ? " · ⚠️ evitar: tem " + fl : "")); });
    L.push("", "Estimado: " + brl(items.reduce(function(s,i){ return s + lineTotal(i); }, 0)));
    if(dietaLigada()) L.push("_Dieta: " + (state.dieta.nome || "ligada") + ". O app só olha o nome dos itens. Os avisos são lembrete da orientação médica. Leia o rótulo._");
    return L.join("\n");
  }

  /* ---------- Folhas ---------- */
  var sheet = document.getElementById("sheet"), scrim = document.getElementById("scrim");
  var lastFocus = null;
  function openSheet(html, focusId){
    lastFocus = document.activeElement;
    sheet.innerHTML = '<div class="grab" aria-hidden="true"></div><button class="sh-close" type="button" data-act="fechar" aria-label="Fechar">×</button>' + html;
    sheet.scrollTop = 0;
    sheet.classList.add("on"); scrim.classList.add("on");
    document.body.style.overflow = "hidden";
    setTimeout(function(){ var f = focusId && document.getElementById(focusId); if(f){ try{ f.focus(); if(f.select) f.select(); }catch(e){} } }, 280);
  }
  function closeSheet(){
    if(ui.sheet && ui.sheet.falando && window.speechSynthesis) speechSynthesis.cancel();
    sheet.classList.remove("on"); scrim.classList.remove("on"); ui.sheet = null; ui.armed = null;
    if(window.ElidaOCR) window.ElidaOCR.encerrar();
    setTimeout(function(){ if(!sheet.classList.contains("on")) sheet.innerHTML = ""; }, 350);
    document.body.style.overflow = "";
    if(lastFocus && lastFocus.focus){ try{ lastFocus.focus(); }catch(e){} }
  }
  function chipGroup(name, options, value){
    return '<div class="chips" role="radiogroup">' + options.map(function(o){
      return '<button class="chip' + (o === value ? ' on' : '') + '" type="button" role="radio" aria-checked="' + (o === value ? 'true' : 'false') + '" data-act="pick" data-g="' + name + '" data-v="' + esc(o) + '">' + esc(o) + '</button>';
    }).join("") + '</div><input type="hidden" id="' + name + '" value="' + esc(value) + '">';
  }

  function sheetGasto(g){
    var editing = !!g;
    g = g || {data: todayStr(), local: lastLocal(), tipo: "Mercado", valor: null, obs: ""};
    ui.sheet = {type:"gasto", id: editing ? g.id : null, mes: editing ? monthKey(g.data) : null};
    var locs = locais();
    openSheet('<h3 class="sh-title" id="sh-title">' + (editing ? 'Editar gasto' : 'Anotar gasto') + '</h3><p class="sh-sub">Quanto saiu no total da nota?</p>' +
      '<div class="form"><div class="money"><span>R$</span><input id="f-valor" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + (g.valor != null ? fmt(g.valor) : '') + '" aria-label="Valor"></div>' +
      '<div class="fl"><label for="f-local">Onde</label><input class="inp" id="f-local" value="' + esc(g.local) + '" autocomplete="off" placeholder="Ex.: Koch, feira, farmácia">' +
      (locs.length ? '<div class="chips">' + locs.map(function(l){ return '<button class="chip" type="button" data-act="set-local" data-v="' + esc(l) + '">' + esc(l) + '</button>'; }).join("") + '</div>' : '') + '</div>' +
      '<div class="fl"><label>Tipo</label>' + chipGroup("f-tipo", TIPOS, g.tipo) + '</div>' +
      '<div class="fl"><label for="f-data">Data</label><input class="inp" id="f-data" type="date" value="' + esc(g.data) + '"></div>' +
      '<div class="fl"><label for="f-obs">Observação (opcional)</label><input class="inp" id="f-obs" value="' + esc(g.obs || '') + '" autocomplete="off" placeholder="Ex.: compra da semana"></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="salvar-gasto">' + (editing ? 'Salvar alterações' : 'Anotar') + '</button>' +
      (editing ? '<button class="quiet" type="button" data-act="apagar-gasto" id="btn-apagar">Apagar este gasto</button>' : '<button class="quiet" type="button" data-act="colar-import">Tenho o código de um cupom</button>') +
      '</div></div>', "f-valor");
  }
  function salvarGasto(){
    var v = parseMoney(document.getElementById("f-valor").value);
    if(v === null || v <= 0){ toast("Digite o valor"); document.getElementById("f-valor").focus(); return; }
    var data = document.getElementById("f-data").value || todayStr();
    var g = {id: ui.sheet.id || uid(), data: data, local: document.getElementById("f-local").value.trim(), tipo: document.getElementById("f-tipo").value || "Outros", valor: v, obs: document.getElementById("f-obs").value.trim()};
    if(Sync.casa && Sync.casa.eu) g.por = Sync.casa.eu;
    if(ui.sheet.id){
      var old = mesData(ui.sheet.mes, true);
      old.gastos = old.gastos.filter(function(x){ return x.id !== ui.sheet.id; });
    }
    var m = mesData(monthKey(data), true);
    m.gastos.push(g);
    state.mes = monthKey(data);
    var wasEdit = !!ui.sheet.id;
    save(); closeSheet(); show("inicio"); toast(wasEdit ? "Gasto atualizado" : "Gasto anotado");
  }

  function sheetItem(it){
    ui.sheet = {type:"item", id: it.id};
    var c = cur(it), locs = locais();
    var hist = (it.hist || []).slice().reverse().slice(0,5);
    openSheet('<div class="pic-row"><span id="pic-preview">' + thumb(it, 'lg') + '</span><div><h3 class="sh-title" id="sh-title">' + esc(it.nome) + '</h3><p class="sh-sub">' + esc(it.por) + ' · ' + esc(it.cat) + '</p></div></div>' +
      dietaBox(it) +
      '<div class="form"><div class="fl"><label for="f-preco">Preço de hoje' + (isKg(it) ? ' (por kg)' : '') + '</label>' +
      '<div class="money"><span>R$</span><input id="f-preco" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + (c ? fmt(c.p) : '') + '"></div></div>' +
      '<div class="fl"><label for="f-mercado">Mercado</label><input class="inp" id="f-mercado" value="' + esc(c && c.m !== BASE_LOCAL ? c.m : lastLocal()) + '" autocomplete="off">' +
      (locs.length ? '<div class="chips">' + locs.map(function(l){ return '<button class="chip" type="button" data-act="set-mercado" data-v="' + esc(l) + '">' + esc(l) + '</button>'; }).join("") + '</div>' : '') + '</div>' +
      (it.nota ? '<p class="note-sm">' + esc(it.nota) + '</p>' : '') +
      picPicker(it.icon || autoIcon(it.nome, it.cat), !!fotos[it.id]) +
      (byMarket(it).length > 1 ? '<div class="fl"><label>Por mercado (último preço)</label><ul class="hist">' + byMarket(it).map(function(x, i){ return '<li><span>' + mkBadge(x.m, 'sm') + esc(x.m) + ' · ' + dShort(x.d) + (i === 0 ? ' · <b class="down">mais barato</b>' : '') + '</span><b class="num">' + brl(x.p) + '</b></li>'; }).join("") + '</ul></div>' : '') +
      (hist.length ? '<div class="fl"><label>Últimos preços</label><ul class="hist">' + hist.map(function(h){ return '<li><span>' + dShort(h.d) + ' · ' + esc(h.m || '') + '</span><b class="num">' + brl(h.p) + '</b></li>'; }).join("") + '</ul></div>' : '') +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="salvar-preco">Salvar preço</button>' +
      '<button class="bigbtn ghost" type="button" data-act="toggle-lista">' + (it.lista ? 'Tirar da lista' : 'Pôr na lista') + '</button>' +
      '<button class="quiet" type="button" data-act="apagar-item" id="btn-apagar">Apagar item</button></div></div>', "f-preco");
  }
  function findItem(id){ for(var i = 0; i < state.items.length; i++){ if(state.items[i].id === id) return state.items[i]; } return null; }
  function salvarPreco(){
    var it = findItem(ui.sheet.id); if(!it) return closeSheet();
    var p = parseMoney(document.getElementById("f-preco").value);
    if(p === null || p <= 0){ toast("Digite o preço"); return; }
    var mk = document.getElementById("f-mercado").value.trim();
    var c = cur(it), today = todayStr();
    if(c && c.d === today && c.m === mk){ c.p = p; } else { it.hist.push({p:p, m:mk, d:today}); }
    if(it.hist.length > 24) it.hist = it.hist.slice(-24);
    save(); closeSheet(); render(); toast("Preço atualizado");
  }

  function sheetNovoItem(){
    ui.sheet = {type:"novo", icon:"", foto:""};
    openSheet('<div class="pic-row"><span id="pic-preview">' + thumb({nome:"", cat:"Mercearia"}, 'lg', '🛒', '') + '</span><div><h3 class="sh-title" id="sh-title">Novo item</h3><p class="sh-sub">Cadastre uma vez, depois é só atualizar o preço.</p></div></div>' +
      '<div class="form"><div class="fl"><label for="n-nome">Nome</label><input class="inp" id="n-nome" autocomplete="off" placeholder="Ex.: Sardinha em lata"><div class="warnbox" id="n-flag" hidden></div></div>' +
      '<div class="fl"><label>Categoria</label>' + chipGroup("n-cat", CATS, ui.filtro !== "Todos" ? ui.filtro : "Mercearia") + '</div>' +
      '<div class="fl"><label for="n-por">Como é vendido</label><input class="inp" id="n-por" autocomplete="off" placeholder="kg, unidade, pacote 1 kg, lata 125 g">' +
      '<div class="chips"><button class="chip" type="button" data-act="set-por" data-v="kg">kg</button><button class="chip" type="button" data-act="set-por" data-v="unidade">unidade</button><button class="chip" type="button" data-act="set-por" data-v="pacote ">pacote</button><button class="chip" type="button" data-act="set-por" data-v="lata ">lata</button></div></div>' +
      '<div class="fl"><label for="n-preco">Preço (opcional)</label><div class="money"><span>R$</span><input id="n-preco" inputmode="decimal" autocomplete="off" placeholder="0,00"></div></div>' +
      '<div class="fl"><label for="n-mercado">Mercado</label><input class="inp" id="n-mercado" value="' + esc(lastLocal()) + '" autocomplete="off"></div>' +
      picPicker("", false) +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="salvar-item">Cadastrar</button><button class="quiet" type="button" data-act="fechar">Cancelar</button></div></div>', "n-nome");
  }
  function salvarItem(){
    var nome = document.getElementById("n-nome").value.trim();
    if(!nome){ toast("Digite o nome"); document.getElementById("n-nome").focus(); return; }
    var p = parseMoney(document.getElementById("n-preco").value);
    var it = {id: uid(), cat: document.getElementById("n-cat").value || "Outros", nome: nome, por: document.getElementById("n-por").value.trim() || "unidade",
      hist: [], nota: "", basico: false, lista: false, qtd: 1, ok: false, icon: ui.sheet.icon || ""};
    if(ui.sheet.foto){ fotos[it.id] = ui.sheet.foto; saveFotos(); }
    if(p !== null && p > 0) it.hist.push({p: p, m: document.getElementById("n-mercado").value.trim(), d: todayStr()});
    state.items.push(it); ui.filtro = it.cat; ui.busca = "";
    var b = document.getElementById("busca"); if(b) b.value = "";
    save(); closeSheet(); render(); toast("Item cadastrado");
  }

  function sheetFinalizar(){
    var items = state.items.filter(function(i){ return i.lista && i.ok; });
    var all = state.items.filter(function(i){ return i.lista; });
    var total = (items.length ? items : all).reduce(function(s,i){ return s + lineTotal(i); }, 0);
    ui.sheet = {type:"finalizar"};
    openSheet('<h3 class="sh-title" id="sh-title">Finalizar compra</h3><p class="sh-sub">Confira com o valor da nota. Os itens marcados saem da lista e os preços deles ficam guardados nesse mercado.</p>' +
      '<div class="form"><div class="money"><span>R$</span><input id="f-valor" inputmode="decimal" autocomplete="off" value="' + fmt(total) + '" aria-label="Valor da nota"></div>' +
      '<div class="fl"><label for="f-local">Onde</label><input class="inp" id="f-local" value="' + esc(lastLocal()) + '" autocomplete="off"></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="confirmar-compra">Anotar no mês</button><button class="quiet" type="button" data-act="fechar">Voltar</button></div></div>', "f-valor");
  }
  function confirmarCompra(){
    var v = parseMoney(document.getElementById("f-valor").value);
    if(v === null || v <= 0){ toast("Digite o valor da nota"); return; }
    var data = todayStr(), m = mesData(monthKey(data), true);
    var loc = document.getElementById("f-local").value.trim();
    m.gastos.push(comPor({id: uid(), data: data, local: loc, tipo: "Mercado", valor: v, obs: "Lista"}));
    state.items.forEach(function(i){
      if(!(i.lista && i.ok)) return;
      var c = cur(i), of = ofertaAtiva(i);
      var p = (of && sameMk(of.m, loc)) ? of.p : (c ? c.p : 0);
      if(p > 0 && loc){
        var same = null; i.hist.forEach(function(x){ if(x.d === data && norm(x.m) === norm(loc)) same = x; });
        if(same) same.p = p; else i.hist.push({p: p, m: loc, d: data});
        if(i.hist.length > 24) i.hist = i.hist.slice(-24);
      }
      delete i.oferta;
    });
    state.items.forEach(function(i){ if(i.lista && i.ok){ i.lista = false; i.ok = false; i.qtd = 1; } });
    state.mes = monthKey(data);
    save(); closeSheet(); show("inicio"); toast("Compra anotada no mês");
  }

  var jantarExemplo = {nome:"Arroz com feijão e abóbora assada", ingredientes:["Arroz", "Feijão", "Abóbora", "Azeite", "Alho"]};

  function jantarSalvo(){
    var j = state.jantar;
    if(!j || typeof j.nome !== "string" || !j.nome.trim() || j.nome.length > 80 ||
       !Array.isArray(j.ingredientes) || !j.ingredientes.length || j.ingredientes.length > 30) return null;
    return j.ingredientes.every(function(n){ return typeof n === "string" && n.trim() && n.length <= 80; }) ? j : null;
  }
  function abrirJantar(){
    var salvo = jantarSalvo(), prato = salvo || jantarExemplo, perfil = perfilAtivo();
    ui.sheet = {type:"jantar", prato:prato};
    openSheet('<h3 class="sh-title" id="sh-title">' + esc(prato.nome) + '</h3><p class="sh-sub">' +
      (salvo ? 'Sua refeição salva.' : 'Exemplo de jantar. Você pode trocar pelos ingredientes do seu plano.') + '</p>' +
      '<button class="link" type="button" data-act="editar-jantar">' + (salvo ? 'Editar minha refeição' : 'Usar minha própria refeição') + '</button>' +
      '<fieldset class="jantar-despensa"><legend>O que você já tem em casa?</legend>' +
      prato.ingredientes.map(function(n, i){
        return '<label><input type="checkbox" name="tenho-ingrediente" value="' + i + '"> ' + esc(n) + '</label>';
      }).join("") + '</fieldset><p class="sub">' +
      (perfil ? 'Perfil ativo: ' + esc(perfil.apelido) + ' · ' + esc(nomesRestricoes(perfil)) + '. ' : '') +
      'Confira os ingredientes com seu plano e o rótulo das embalagens. Esta lista organiza compras e não avalia a adequação do prato.</p>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="comprar-jantar"></button></div>');
    atualizarJantar();
  }
  function atualizarJantar(){
    var faltam = sheet.querySelectorAll('[name="tenho-ingrediente"]:not(:checked)').length;
    sheet.querySelector('[data-act="comprar-jantar"]').textContent = faltam ?
      'Levar à lista · ' + faltam + (faltam === 1 ? ' ingrediente' : ' ingredientes') : 'Concluir · já tenho tudo';
  }
  function editarJantar(){
    var prato = jantarSalvo();
    ui.sheet = {type:"editar-jantar"};
    openSheet('<h3 class="sh-title" id="sh-title">Minha refeição</h3><form id="form-jantar" class="form">' +
      '<label class="fl">Nome do prato<input class="inp" name="prato" required maxlength="80" placeholder="Ex.: Frango com legumes" value="' + esc(prato ? prato.nome : "") + '"></label>' +
      '<label class="fl">Ingredientes, um por linha<textarea class="inp" name="ingredientes" rows="6" required maxlength="2430" placeholder="Frango&#10;Cenoura&#10;Batata">' +
      esc(prato ? prato.ingredientes.join("\n") : "") + '</textarea></label><p class="sub">Salva este prato para a próxima compra neste aparelho.</p>' +
      '<button class="bigbtn" type="submit">Salvar e conferir a despensa</button></form>');
  }
  function salvarJantar(form){
    var nome = form.elements.prato.value.trim();
    var ingredientes = form.elements.ingredientes.value.split(/\r?\n/).map(function(n){ return n.trim(); }).filter(Boolean);
    var vistos = new Set();
    ingredientes = ingredientes.filter(function(n){ var k = norm(n); if(vistos.has(k)) return false; vistos.add(k); return true; });
    if(!nome || !ingredientes.length || ingredientes.length > 30 || ingredientes.some(function(n){ return n.length > 80; })){
      toast("Informe o prato e até 30 ingredientes de até 80 caracteres cada."); return;
    }
    state.jantar = {nome:nome, ingredientes:ingredientes};
    save(); renderInicio(); abrirJantar();
  }
  function comprarJantar(){
    if(!ui.sheet || ui.sheet.type !== "jantar") return;
    var prato = ui.sheet.prato, faltantes = sheet.querySelectorAll('[name="tenho-ingrediente"]:not(:checked)');
    var novos = 0;
    faltantes.forEach(function(campo){
      var nome = prato.ingredientes[Number(campo.value)], it = findByName(nome);
      if(it && it.lista) return;
      if(!it){
        it = {id:uid(), cat:"Outros", nome:nome, por:"unidade", hist:[], nota:"", basico:false};
        state.items.push(it);
      }
      it.lista = true; it.ok = false; it.qtd = 1; novos++;
    });
    if(novos) save();
    closeSheet();
    if(faltantes.length) show("lista");
    toast(!faltantes.length ? "Você já tem todos os ingredientes." : novos ? "Lista atualizada com o que falta." : "Os ingredientes já estão na lista.");
  }

  var motivosConsulta = {
    rotulo:["Fiquei em dúvida com o rótulo","Qual trecho da embalagem devo conferir neste produto?"],
    preco:["Ficou caro","Que alternativa posso discutir para esta refeição dentro do meu orçamento?"],
    falta:["Não encontrei o produto","O que posso procurar quando este produto faltar?"]
  };
  var CONSULTA_KEY = PFX + "elida-consulta-";
  function lerConsulta(){
    var registros=[];
    try{
      for(var i=0;i<localStorage.length;i++){
        var chave=localStorage.key(i);
        if(!chave || !chave.startsWith(CONSULTA_KEY)) continue;
        var id=chave.slice(CONSULTA_KEY.length), r;
        try{r=JSON.parse(localStorage.getItem(CONSULTA_KEY+id));}catch(erro){continue;}
        if(r && chave === CONSULTA_KEY+r.id && Object.hasOwn(motivosConsulta,r.motivo) &&
           typeof r.item==="string" && typeof r.pergunta==="string" && typeof r.resposta==="string") registros.push(r);
      }
    }catch(e){toast("O aparelho não conseguiu abrir todas as suas anotações.");}
    return registros.sort(function(a,b){return b.quando-a.quando;});
  }
  function gravarConsulta(r){
    try{localStorage.setItem(CONSULTA_KEY+r.id,JSON.stringify(r));return true;}
    catch(e){toast("O aparelho não conseguiu salvar. Sua anotação continua na tela.",4000);return false;}
  }
  function abrirConsulta(){
    var registros=lerConsulta();
    ui.sheet={type:"consulta"};
    openSheet('<h3 class="sh-title" id="sh-title">Levar à consulta</h3><p class="sh-sub">Guarde a pergunta que surgiu no mercado. Na consulta, mostre o que aconteceu e anote o que combinaram para a próxima compra.</p>' +
      '<button class="bigbtn" type="button" data-act="nova-duvida">Registrar dificuldade</button>' +
      (registros.length ? '<ul class="consulta-casos">'+registros.map(function(r){
        return '<li><button type="button" class="row" data-act="ver-duvida" data-id="'+esc(r.id)+'"><span class="r-main"><b class="r-name">'+esc(r.item)+'</b><small class="r-meta">'+esc(motivosConsulta[r.motivo][0])+' · '+(r.resposta?'Combinado anotado':'Para conversar')+'</small></span>'+IC.right+'</button></li>';
      }).join("")+'</ul>' : '<details class="consulta-exemplo"><summary>Ver exemplo de uma família</summary><p><b>No mercado</b><br>O pão da lista acabou. Quem foi às compras voltou sem ele.</p><p><b>Pergunta para a consulta</b><br>Que outra opção podemos procurar para o café da manhã quando isso acontecer?</p></details>') +
      '<p class="sub">Anotações guardadas neste aparelho. Mostre ou compartilhe uma pergunta por vez quando desejar.</p>');
  }
  function novaDuvida(motivoInicial){
    var motivo=Object.hasOwn(motivosConsulta,motivoInicial)?motivoInicial:"rotulo";
    ui.sheet={type:"duvida-form"};
    openSheet('<h3 class="sh-title" id="sh-title">O que aconteceu na compra?</h3><form id="form-duvida" class="form">' +
      '<label class="fl">Produto ou refeição<input required maxlength="80" class="inp" name="item" placeholder="Ex.: pão para o café da manhã"></label>' +
      '<label class="fl">Dificuldade<select class="inp" name="motivo">'+Object.keys(motivosConsulta).map(function(k){
        return '<option value="'+k+'"'+(k===motivo?' selected':'')+'>'+motivosConsulta[k][0]+'</option>';
      }).join("")+'</select></label><label class="fl">Pergunta para a consulta<textarea required maxlength="350" class="inp" name="pergunta">'+motivosConsulta[motivo][1]+'</textarea></label>' +
      '<button class="bigbtn" type="submit">Guardar neste aparelho</button></form>');
  }
  function abrirDuvida(id){
    var r=lerConsulta().find(function(a){return a.id===id;});
    if(!r){abrirConsulta();return;}
    ui.sheet={type:"consulta",id:id};
    openSheet('<h3 class="sh-title" id="sh-title">'+esc(r.item)+'</h3><p class="sh-sub">'+esc(motivosConsulta[r.motivo][0])+' · '+esc(new Date(r.quando).toLocaleDateString("pt-BR"))+'</p>' +
      '<p class="consulta-pergunta">'+esc(r.pergunta)+'</p><button type="button" class="btn-sm" data-act="mensagem-consulta">Revisar mensagem para a consulta</button>' +
      '<form id="form-combinado" class="form"><label class="fl">O que combinamos para a próxima compra?<textarea maxlength="350" required class="inp" name="resposta" placeholder="Anote com suas palavras depois da conversa.">'+esc(r.resposta)+'</textarea></label><button class="bigbtn" type="submit">Guardar combinado</button></form>' +
      '<div class="links"><button class="link" type="button" data-act="consulta">Todas as anotações</button><button class="quiet" type="button" data-act="excluir-duvida">Excluir anotação</button></div>');
  }
  function mensagemConsulta(){
    var r=lerConsulta().find(function(a){return a.id===ui.sheet.id;});
    if(!r){abrirConsulta();return;}
    var texto=[r.item,motivosConsulta[r.motivo][0],r.pergunta].join("\n");
    openSheet('<h3 class="sh-title" id="sh-title">Mensagem para a consulta</h3><label class="fl">Revise antes de compartilhar<textarea class="inp" id="pedido-compra">'+esc(texto)+'</textarea></label>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="enviar-pedido">'+(navigator.share?'Escolher destinatário':'Copiar mensagem')+'</button><button class="quiet" type="button" data-act="ver-duvida" data-id="'+esc(r.id)+'">Voltar à anotação</button></div>');
  }

  function abrirCompraDelegada(){
    var pendentes = state.items.filter(function(it){return it.lista && !it.ok;});
    if(!pendentes.length){
      ui.sheet = {type:"delegar"};
      openSheet('<h3 class="sh-title" id="sh-title">Comprar para alguém</h3><p class="sh-sub">Sua lista está sem itens pendentes. Escolha o jantar e marque o que já tem em casa antes de preparar a mensagem.</p><button class="bigbtn" type="button" data-act="jantar">Planejar meu jantar</button>');
      return;
    }
    var lista = pendentes.map(function(it){return "• " + it.nome + " (" + qtdLabel(it) + (isKg(it) ? "" : " " + it.por) + ")";}).join("\n");
    ui.sheet = {type:"delegar"};
    openSheet('<h3 class="sh-title" id="sh-title">Comprar para alguém</h3><p class="sh-sub">Revise a mensagem. Inclua apenas as instruções que deseja enviar.</p>' +
      '<label class="fl">Mensagem para quem vai ao mercado<textarea class="inp" id="pedido-compra" rows="7">' +
      esc("Lista de compras\n" + lista) + '</textarea></label>' +
      (jantarSalvo() ? '<button class="link" type="button" data-act="incluir-prato">Incluir nome da refeição salva</button>' : '') + '<p class="sub">Você pode acrescentar uma orientação, como “me mande uma foto do rótulo antes de trocar a marca”.</p>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="enviar-pedido">' +
      (navigator.share ? 'Escolher com quem compartilhar' : 'Copiar mensagem') + '</button></div>');
  }
  async function enviarPedido(){
    var campo = document.getElementById("pedido-compra");
    if(!campo || !campo.value.trim()){ toast("Escreva a mensagem antes de enviar."); return; }
    if(navigator.share){
      try{await navigator.share({text:campo.value}); return;}
      catch(e){if(e.name === "AbortError") return;}
    }
    copy(campo.value,campo);
  }
  function compararCusto(){
    ui.sheet = {type:"custo"};
    function opcao(letra){
      return '<fieldset class="custo-opcao"><legend>Opção ' + letra + '</legend>' +
        [['preco','Preço do pacote (R$)'],['peso','Peso do pacote (g)'],['uso','Quantidade na receita (g)']].map(function(c){
          return '<label class="fl">' + c[1] + '<input required class="inp" type="number" step="any" min="0.000001" name="' + c[0] + letra + '"></label>';
        }).join("") + '</fieldset>';
    }
    openSheet('<h3 class="sh-title" id="sh-title">Comparar custo da receita</h3><p class="sh-sub">Compare dois ingredientes que você já escolheu para a receita. Use os preços da loja.</p><form class="form" id="form-custo">' +
      opcao("A") + opcao("B") + '<button class="bigbtn" type="submit">Calcular custos</button><div id="custos" aria-live="polite"></div></form>');
  }
  function calcularCustos(f){
    document.getElementById("custos").textContent = ["A","B"].map(function(k){
      var preco=f.elements["preco"+k].valueAsNumber, peso=f.elements["peso"+k].valueAsNumber, uso=f.elements["uso"+k].valueAsNumber;
      return "Opção "+k+" · "+brl(preco*uso/peso)+" na receita · "+brl(preco*Math.ceil(uso/peso))+" em pacotes inteiros.";
    }).join("\n");
  }

  function sheetOrcamento(){
    var m = mesData(state.mes, false);
    ui.sheet = {type:"orc"};
    openSheet('<h3 class="sh-title" id="sh-title">Orçamento de ' + esc(monthName(state.mes).toLowerCase()) + '</h3><p class="sh-sub">Quanto a casa pode gastar com comida neste mês. Os próximos meses começam com esse valor, e dá pra mudar quando quiser.</p>' +
      '<div class="form"><div class="money"><span>R$</span><input id="f-orc" inputmode="decimal" autocomplete="off" value="' + fmt(m.orc || 0) + '"></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="salvar-orc">Salvar</button><button class="quiet" type="button" data-act="fechar">Cancelar</button></div></div>', "f-orc");
  }

  /* ---------- Backup ----------
     Arquivo .json com tudo o que o app guarda: itens, preços, lista, gastos, orçamentos,
     dieta, ofertas anotadas e fotos dos produtos. Não vai criptografado: guarde em lugar
     privado (Drive, Arquivos) e não mande em grupo. O texto copiado não leva as fotos. */
  var BK_ANTES = PFX + "elida-antes-restaurar", BK_ULTIMO = PFX + "elida-ultimo-backup";
  function resumoEstado(st, ft){
    var g = 0, ms = 0; Object.keys(st.meses || {}).forEach(function(k){ ms++; g += ((st.meses[k] || {}).gastos || []).length; });
    var nf = ft ? Object.keys(ft).length : 0;
    return (st.items || []).length + " itens, " + g + " gastos em " + ms + (ms === 1 ? " mês" : " meses") + (ft ? ", " + nf + (nf === 1 ? " foto" : " fotos") : ", sem fotos");
  }
  function pacoteBackup(){ return {formato: "elida-backup", versao: 2, criado: new Date().toISOString(), estado: state, fotos: fotos, perfis: perfisEstado.guardar ? IA.migrarPerfis(perfisEstado) : undefined}; }
  function lerBackup(txt){
    var pos = String(txt || "").indexOf("{"); if(pos < 0) throw new Error("vazio");
    var o = JSON.parse(String(txt).slice(pos)), st, ft = null, criado = "";
    var pf = null;
    if(o && o.formato === "elida-backup"){ st = o.estado; if(o.fotos && typeof o.fotos === "object") ft = o.fotos; criado = String(o.criado || "").slice(0, 10); if(o.perfis) pf = IA.migrarPerfis(o.perfis); }
    else st = o;
    if(!valid(st)) throw new Error("invalido");
    return {estado: st, fotos: ft, criado: criado, perfis: pf};
  }
  function sheetBackup(){
    ui.sheet = {type:"backup"};
    var ult = ""; try{ ult = localStorage.getItem(BK_ULTIMO) || ""; }catch(e){}
    openSheet('<h3 class="sh-title" id="sh-title">Backup criptografado</h3>' +
      '<p class="sh-sub">O backup contém dados pessoais, gastos, fotos e possivelmente perfis de saúde. Ele será cifrado no próprio aparelho com AES-256-GCM. Nenhuma senha será enviada para servidores. Se perder sua senha, não conseguirá recuperar o arquivo.' +
      (ult ? ' Último backup: ' + esc(dShort(ult)) + '.' : '') + '</p>' +
      '<div class="form"><label class="fl">Senha exclusiva (mínimo de 12 caracteres)<input class="inp" type="password" id="f-senha-backup" autocomplete="new-password" minlength="12" maxlength="512" required></label>' +
      '<label class="fl">Confirme a senha<input class="inp" type="password" id="f-senha-backup-2" autocomplete="new-password" minlength="12" maxlength="512" required></label></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="salvar-backup">Criar backup criptografado</button>' +
      '<button class="quiet" type="button" data-act="fechar">Cancelar</button></div>', "f-senha-backup");
  }
  async function salvarArquivoBackup(){
    if(!window.ElidaBackupSeguro || !window.crypto || !crypto.subtle){ toast("Este navegador não permite backup criptografado"); return; }
    var a=document.getElementById("f-senha-backup"), b=document.getElementById("f-senha-backup-2");
    var senha=a && a.value || "", confirmacao=b && b.value || "";
    if(senha.length<12 || senha!==confirmacao){ toast("Informe e confirme uma senha de pelo menos 12 caracteres"); return; }
    if(a)a.value=""; if(b)b.value="";
    var btn=sheet.querySelector('[data-act="salvar-backup"]');
    if(btn)btn.disabled=true;
    try{
      var env=await window.ElidaBackupSeguro.criar(pacoteBackup(),senha);
      var nome="elida-backup-criptografado-"+todayStr()+".elida";
      var blob=new Blob([JSON.stringify(env)],{type:"application/json"});
      var feito=function(){try{localStorage.setItem(BK_ULTIMO,todayStr());}catch(e){} toast("Backup criptografado criado. Guarde também a senha em local separado.");};
      try{
        var file=new File([blob],nome,{type:"application/json"});
        if(navigator.canShare && navigator.canShare({files:[file]})){
          await navigator.share({files:[file]});
          feito();return;
        }
      }catch(e){if(e && e.name==="AbortError")return;}
      var link=document.createElement("a"),url=URL.createObjectURL(blob);
      link.href=url;link.download=nome;document.body.appendChild(link);link.click();
      setTimeout(function(){URL.revokeObjectURL(url);link.remove();},1500);
      feito();
    }catch(e){toast("Falha ao cifrar backup: "+String(e && e.message || "verifique o navegador").slice(0,120));}
    finally{senha="";confirmacao="";if(btn)btn.disabled=false;}
  }
  function sheetRestaurar(){
    ui.sheet = {type:"restaurar"};
    var antes = null; try{ antes = JSON.parse(localStorage.getItem(BK_ANTES) || "null"); }catch(e){}
    openSheet('<h3 class="sh-title" id="sh-title">Restaurar backup</h3><p class="sh-sub">Escolha seu arquivo .elida criptografado ou cole o conteúdo. Informe a senha usada na exportação. Backups antigos sem criptografia continuam aceitos somente para migração e exigem cuidado.</p>' +
      '<div class="form"><label class="fl">Arquivo de backup<input type="file" id="f-arquivo" class="inp" accept=".elida,.json,application/json"></label>' +
      '<label class="fl">Senha do backup criptografado<input class="inp" id="f-senha-restaurar" type="password" autocomplete="off" maxlength="512"></label>' +
      '<label class="fl">Ou cole o texto do backup<textarea class="inp" id="f-restaurar" rows="4" placeholder="Cole o conteúdo do arquivo, caso necessário"></textarea></label></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="confirmar-restaurar">Analisar backup</button>' +
      (antes && valid(antes.estado) ? '<button class="quiet" type="button" data-act="desfazer-restaurar">Desfazer última restauração</button>' : '') +
      '<button class="quiet" type="button" data-act="fechar">Cancelar</button></div>', "f-arquivo");
  }
  async function previaRestaurar(txt){
    var b, conteudo=String(txt || "");
    if(conteudo.length>30*1024*1024){toast("Arquivo grande demais");return;}
    try{
      var primeiro=conteudo.indexOf("{");
      if(primeiro<0 || primeiro>4096) throw new Error("Arquivo inválido");
      var env=JSON.parse(conteudo.slice(primeiro));
      if(window.ElidaBackupSeguro && window.ElidaBackupSeguro.identificar(env)){
        var input=document.getElementById("f-senha-restaurar");
        var senha=input && input.value || "";
        if(input)input.value="";
        var aberto=await window.ElidaBackupSeguro.abrir(env,senha);
        senha="";
        b=lerBackup(JSON.stringify(aberto));
      }else{
        b=lerBackup(conteudo);
      }
    }catch(err){
      toast("Não foi possível abrir: senha incorreta, arquivo alterado ou backup inválido");
      return;
    }
    ui.sheet={type:"restaurar-previa",backup:b};
    openSheet('<h3 class="sh-title" id="sh-title">Restaurar este backup?</h3>' +
      '<div class="warnbox" role="alert"><b>Backup' + (b.criado ? ' de ' + esc(dShort(b.criado)) : '') + ':</b> ' + esc(resumoEstado(b.estado,b.fotos)) + '.<br>' +
      (b.perfis && b.perfis.perfis.length ? 'O backup também tem ' + b.perfis.perfis.length + (b.perfis.perfis.length===1 ? ' perfil alimentar' : ' perfis alimentares') + '.<br>' : '') +
      '<b>Agora no app:</b> ' + esc(resumoEstado(state,fotos)) + '.<br>O que está no app será trocado. Não haverá cópia automática para desfazer. Faça antes um backup criptografado dos seus dados atuais.</div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="aplicar-restaurar">Confirmar restauração</button><button class="quiet" type="button" data-act="fechar">Cancelar</button></div>');
  }
  function aplicarRestauracao(b){
    /* Não produzir cópia automática em texto claro no armazenamento do navegador.
       Exporte primeiro um backup criptografado se quiser preservar o estado anterior. */
    var s = b.estado;
    s.dieta = DietaMotor.migrar(s.dieta);
    var marcas = {}; (state.items || []).forEach(function(x){ if(x.ev) marcas[x.id] = x.ev; });
    s.items.forEach(function(x){ if(!x.ev && marcas[x.id]) x.ev = marcas[x.id]; });
    state = s;
    if(b.fotos){ fotos = b.fotos; saveFotos(); }
    if(b.perfis && b.perfis.perfis.length){ perfisEstado = b.perfis; perfisEstado.guardar = true; perfisEstado.consentidoEm = perfisEstado.consentidoEm || todayStr(); salvarPerfis(); }
    save(); closeSheet(); show("inicio");
    toast("Backup restaurado. Nenhuma cópia sem criptografia foi criada.");
  }
  function desfazerRestauracao(){
    var c = null; try{ c = JSON.parse(localStorage.getItem(BK_ANTES) || "null"); }catch(e){}
    if(!c || !valid(c.estado)){ toast("Não há restauração para desfazer"); return; }
    state = c.estado; if(c.fotos){ fotos = c.fotos; saveFotos(); }
    if(c.perfis){ perfisEstado = IA.migrarPerfis(c.perfis); perfisEstado.guardar = true; salvarPerfis(); }
    save(); try{ localStorage.removeItem(BK_ANTES); }catch(e){}
    closeSheet(); show("inicio"); toast("Voltou ao que estava antes da restauração");
  }

  function novoPreview(){
    var pv = document.getElementById("pic-preview"); if(!pv || !ui.sheet || ui.sheet.type !== "novo") return;
    var nome = (document.getElementById("n-nome") || {}).value || "", cat = (document.getElementById("n-cat") || {}).value || "Mercearia";
    var icon = ui.sheet.icon || autoIcon(nome, cat);
    pv.innerHTML = thumb({nome: nome, cat: cat}, "lg", icon, ui.sheet.foto || "");
    sheet.querySelectorAll(".emo").forEach(function(b){ var on = b.dataset.v === icon; b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); });
  }
  function itemPreview(it){
    var pv = document.getElementById("pic-preview"); if(pv) pv.innerHTML = thumb(it, "lg");
    var icon = it.icon || autoIcon(it.nome, it.cat);
    sheet.querySelectorAll(".emo").forEach(function(b){ var on = b.dataset.v === icon; b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); });
  }

  function decodePayload(s){
    try{
      s = String(s).replace(/\s+/g, "");
      s = s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length % 4) s += "=";
      var bin = atob(s), bytes = new Uint8Array(bin.length);
      for(var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    }catch(e){}
    return null;
  }
  function decodeCarta(s){ var o = decodePayload(s); return (o && o.n && o.m) ? o : null; }
  function parseImport(text){
    var s = String(text || "").trim(), k = s.indexOf("importar=");
    if(k >= 0) s = s.slice(k + 9);
    var mt = s.match(/[A-Za-z0-9_-]{40,}/); if(!mt) return null;
    var o = decodePayload(mt[0]);
    if(!o || o.v !== 1 || !o.m || !/^\d{4}-\d{2}-\d{2}$/.test(o.d || "") || typeof o.t !== "number" || !Array.isArray(o.i)) return null;
    return o;
  }
  function findByName(nome){
    var n = norm(nome).trim();
    for(var i = 0; i < state.items.length; i++){ if(norm(state.items[i].nome).trim() === n) return state.items[i]; }
    return null;
  }
  function sheetColar(){
    ui.sheet = {type:"colar"};
    openSheet('<h3 class="sh-title" id="sh-title">Colar código</h3><p class="sh-sub">Cole aqui a mensagem com o código do cupom, do encarte ou o convite da casa. Pode colar a mensagem inteira.</p>' +
      '<div class="form"><textarea class="inp" id="f-import" placeholder="Cole aqui"></textarea>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="ler-import">Ler código</button><button class="quiet" type="button" data-act="fechar">Cancelar</button></div></div>', "f-import");
  }
  function sheetImport(o){
    ui.sheet = {type:"import", data:o};
    var ja = (state.importados || []).indexOf(o.id) >= 0;
    var rows = o.i.map(function(r){
      var it = (r[5] && findItem(r[5])) || findByName(r[0]);
      var qtxt = (r[2] === "kg" ? String(r[4]).replace(".", ",") + " kg" : (r[4] || 1) + " ×");
      return '<li><span>' + esc(r[0]) + ' · ' + qtxt + (it ? '' : ' · <b class="down">novo</b>') + '</span><b class="num">' + brl(+r[3]) + (r[2] === "kg" ? '/kg' : '') + '</b></li>';
    }).join("");
    openSheet('<div class="pic-row">' + mkBadge(o.m) + '<div><h3 class="sh-title" id="sh-title">' + esc(o.m) + '</h3><p class="sh-sub">' + dLong(o.d) + ' · ' + o.i.length + ' itens</p></div></div>' +
      '<div class="form"><div class="money"><span>R$</span><input id="f-imp-total" inputmode="decimal" value="' + fmt(o.t) + '" aria-label="Total da nota" readonly></div>' +
      (ja ? '<div class="warnbox">Essa compra já foi importada. Importar de novo contaria o gasto duas vezes.</div>' : '') +
      '<div class="fl"><label>Itens e preço unitário</label><ul class="hist">' + rows + '</ul></div>' +
      '<p class="note-sm">Ao importar: o total entra nos gastos de ' + mesNome(monthKey(o.d)) + ', os preços ficam guardados no ' + esc(o.m) + ' e os itens comprados saem da lista.</p>' +
      '<div class="sh-actions">' + (ja ? '' : '<button class="bigbtn" type="button" data-act="confirmar-import">Importar compra</button>') + '<button class="quiet" type="button" data-act="fechar">' + (ja ? 'Fechar' : 'Cancelar') + '</button></div></div>');
  }
  function confirmImport(){
    var o = ui.sheet && ui.sheet.data; if(!o) return;
    state.importados = state.importados || [];
    if(o.id && state.importados.indexOf(o.id) >= 0){ toast("Essa compra já foi importada"); return; }
    mesData(monthKey(o.d), true).gastos.push(comPor({id: uid(), data: o.d, local: o.m, tipo: o.tp || "Mercado", valor: o.t, obs: "Cupom importado"}));
    var novos = 0, atual = 0;
    o.i.forEach(function(r){
      var p = +r[3]; if(!(p > 0)) return;
      var it = (r[5] && findItem(r[5])) || findByName(r[0]);
      if(!it){ it = {id: uid(), cat: CATS.indexOf(r[1]) >= 0 ? r[1] : "Outros", nome: r[0], por: r[2] || "unidade", hist: [], nota: "", basico: false, lista: false, qtd: 1, ok: false, icon: ""}; state.items.push(it); novos++; }
      else atual++;
      var same = null; it.hist.forEach(function(x){ if(x.d === o.d && norm(x.m) === norm(o.m)) same = x; });
      if(same) same.p = p; else it.hist.push({p: p, m: o.m, d: o.d});
      it.hist.sort(function(a, b){ return a.d < b.d ? -1 : (a.d > b.d ? 1 : 0); });
      if(it.hist.length > 24) it.hist = it.hist.slice(-24);
      if(it.lista){ it.lista = false; it.ok = false; it.qtd = 1; }
      delete it.oferta;
    });
    if(o.id) state.importados.push(o.id);
    state.mes = monthKey(o.d);
    save(); closeSheet(); show("inicio");
    toast(atual + (atual === 1 ? " preço atualizado" : " preços atualizados") + (novos ? ", " + novos + (novos === 1 ? " item novo" : " itens novos") : ""));
  }
  function showWelcome(){
    var c = state.carta; if(!c) return;
    var w = document.getElementById("welcome");
    var paras = String(c.m).split(/\n+/).filter(function(x){ return x.trim(); });
    var html = '<div class="w-inner"><div class="w-brand reveal" style="animation-delay:0s"><svg class="w-mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="#0F3B2E"/><g transform="translate(0 -7)"><rect x="158" y="112" width="196" height="52" rx="17" fill="#D9B45A"/><path d="M174 130.5H338M174 146.5H338" stroke="#B8892B" stroke-width="5" stroke-linecap="round" opacity=".55"/><path d="M168 176H344C344 197 374 203 374 234V350C374 385 346 414 311 414H201C166 414 138 385 138 350V234C138 203 168 197 168 176Z" fill="#F4F1E6"/><g transform="translate(-7 0)"><path d="M256 386C209 362 195 307 222 268C243 239 284 227 318 233C324 291 302 352 256 386Z" fill="#0F3B2E"/><path d="M257 383C263 334 283 285 313 239" stroke="#F4F1E6" stroke-width="9" stroke-linecap="round" fill="none"/></g></g></svg><span>Elida<b>.</b></span></div>' +
      '<h1 class="w-name reveal" id="w-name" style="animation-delay:.2s">' + esc(c.n) + ',</h1><div class="w-text">' +
      paras.map(function(p, i){ return '<p class="reveal" style="animation-delay:' + (0.7 + i * 0.55).toFixed(2) + 's">' + esc(p) + '</p>'; }).join("") + '</div>';
    var t = 0.7 + paras.length * 0.55;
    if(c.a) html += '<div class="w-sign reveal" style="animation-delay:' + t.toFixed(2) + 's">' + esc(c.a) + '</div>';
    if(c.f) html += '<div class="w-note reveal" style="animation-delay:' + (t + 0.25).toFixed(2) + 's">' + esc(c.f) + '</div>';
    if(c.c && c.c.length) html += '<div class="w-chips reveal" style="animation-delay:' + (t + 0.5).toFixed(2) + 's">' + c.c.map(function(x){ return '<span>' + esc(x) + '</span>'; }).join("") + '</div>';
    html += '<button class="w-btn reveal" type="button" data-act="fechar-carta" style="animation-delay:' + (t + 0.75).toFixed(2) + 's">' + esc(c.b || "Abrir") + '</button></div>';
    w.innerHTML = html; w.hidden = false; w.scrollTop = 0; document.body.style.overflow = "hidden";
  }

  /* ---------- Dieta ---------- */
  function words(list, cls){
    if(!list || !list.length) return '<p class="note-sm">Nada cadastrado.</p>';
    return '<div class="words">' + list.map(function(w){ return '<span class="word' + cls + '">' + esc(w) + '</span>'; }).join("") + '</div>';
  }
  function renderDieta(){
    var d = state.dieta || defaultDieta(), mod = DietaMotor.modeloPorId(d.modelo);
    var temLista = !!mod || (d.evitar || []).length > 0, ligada = d.ativa && temLista;
    var h = segDieta("rotulo") + '<div class="head-row"><div><h2 class="title">' + esc(ligada ? (d.nome || 'Dieta') : (temLista ? 'Dieta desligada' : 'Nenhuma dieta')) + '</h2><p class="sub">' +
      (ligada ? 'Cada item da casa recebe um de três avisos, só pelo nome.' : temLista ? 'O app não está avisando nada. Toque em Editar para ligar de novo.' : 'Se alguém da casa tem uma restrição orientada pelo médico, monte a lista aqui.') + '</p></div>' +
      (temLista ? '<button class="btn-sm" type="button" data-act="editar-dieta">' + IC.edit + 'Editar</button>' : '') + '</div>';
    h += '<p class="aviso-fixo" role="note">' + esc(DietaMotor.AVISO_FIXO) + '</p>';
    if(!temLista){
      h += '<div class="card pad"><h3>Começar</h3><p class="note-sm">A lista base sem leite ainda não foi revisada por profissional de saúde. Mostre ao médico ou ao nutricionista antes de confiar nela.</p>' +
        '<div class="sh-actions"><button class="bigbtn" type="button" data-act="usar-modelo">Usar a lista base sem leite</button>' +
        '<button class="bigbtn ghost" type="button" data-act="nova-dieta">Montar a minha lista</button></div></div>';
      document.getElementById("view-rotulo").innerHTML = h;
      return;
    }
    if(d.sugerirModelo && !mod){
      h += '<div class="tip"><b>Existe uma lista base mais completa</b><span>A sua lista ficou do jeito que você deixou. A lista base sem leite também pega queijos pelo nome, abreviações de cupom e nomes em inglês. Ela ainda não foi revisada por profissional.</span>' +
        '<button class="act" type="button" data-act="usar-modelo">Usar a lista base</button></div>';
    }
    if(d.revisao){
      var n = daysUntil(d.revisao);
      h += '<div class="tip"><b>Revisão com o médico: ' + dLong(d.revisao) + '</b><span>' + (n > 1 ? 'Faltam ' + n + ' dias.' : n === 1 ? 'É amanhã.' : n === 0 ? 'É hoje.' : 'Já passou. Se a orientação mudou, atualize aqui.') + '</span></div>';
    }
    if(d.obs) h += '<div class="card pad"><h3>Orientação do médico</h3><p>' + esc(d.obs).replace(/\n/g,'<br>') + '</p></div>';
    if(ligada){
      h += '<div class="card pad"><h3>Os três avisos</h3><ul class="estados">' +
        '<li><span class="flag">evitar</span><span>O nome tem uma palavra da lista. Volta pra prateleira.</span></li>' +
        '<li><span class="flag q">conferir</span><span>Informação insuficiente: só pelo nome não dá para saber. Todo item começa assim.</span></li>' +
        '<li><span class="flag ok">conferido</span><span>Alguém da casa leu o rótulo e marcou no item. Registra a leitura, não é garantia. Vale ' + Math.round(DietaMotor.VALIDADE_CONFERENCIA_DIAS / 30) + ' meses ou até o nome mudar.</span></li></ul></div>';
      var ev = [], nc = 0, ni = 0;
      state.items.forEach(function(i){ var r = dietaAval(i); if(r.estado === "evitar") ev.push(i.nome); else if(r.estado === "conferido") nc++; else if(r.estado === "insuficiente") ni++; });
      h += '<div class="card pad"><h3>Itens da casa</h3><p class="note-sm">' + ev.length + ' para evitar · ' + nc + (nc === 1 ? ' conferido' : ' conferidos') + ' · ' + ni + ' sem informação suficiente</p>' + (ev.length ? words(ev, '') : '') + '</div>';
      if(mod){
        h += '<div class="card pad"><h3>Lista base: ' + esc(mod.nome) + '</h3><p class="note-sm">Versão ' + esc(mod.versao) + '. ' +
          (mod.revisao && mod.revisao.status === "revisada" ? 'Revisada por ' + esc(mod.revisao.profissional) + ' (' + esc(mod.revisao.registro) + ') em ' + dLong(mod.revisao.data) + '.' : '<b>Ainda não revisada por profissional de saúde.</b>') +
          ' “…” no fim quer dizer que pega o começo da palavra.</p>' +
          mod.grupos.map(function(g){ return '<h4 class="g-title">' + esc(g.nome) + '</h4>' + words(g.termos.map(DietaMotor.rotuloTermo), ''); }).join("") + '</div>';
      }
      if((d.evitar || []).length) h += '<div class="card pad"><h3>' + (mod ? 'Termos que você acrescentou' : 'Se aparecer, volta pra prateleira') + '</h3>' + words(d.evitar.map(DietaMotor.rotuloTermo), '') + '</div>';
      var vx = DietaMotor.validarExcecoes(d);
      if(vx.ignoradas.length) h += '<div class="tip"><b>Exceções ignoradas</b><span>' + vx.ignoradas.map(function(x){ return '“' + esc(x.termo) + '” ' + esc(x.motivo); }).join('. ') + '. Elas ficam guardadas, mas o app não usa. Para liberar um produto, escreva o nome completo dele, como “leite de coco”.</span></div>';
      var pode = (mod ? mod.pode : []).concat(vx.validas);
      if(pode.length) h += '<div class="card pad"><h3>Exceções: não entram no aviso</h3><p class="note-sm">Só quer dizer que essas palavras sozinhas não disparam “evitar”. Não quer dizer que o produto pode.</p>' + words(pode, ' neutro') + '</div>';
      var cuid = (mod ? mod.cuidados : []).concat(d.cuidados || []);
      if(cuid.length) h += '<div class="card pad"><h3>Na hora da compra</h3><ul class="plain">' + cuid.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join("") + '</ul></div>';
    }
    document.getElementById("view-rotulo").innerHTML = h;
  }
  function sheetDieta(nova){
    var d = nova || state.dieta || defaultDieta(), mod = DietaMotor.modeloPorId(d.modelo);
    ui.sheet = {type:"dieta"};
    openSheet('<h3 class="sh-title" id="sh-title">' + (nova ? 'Montar a dieta' : 'Editar dieta') + '</h3><p class="sh-sub">Se o médico mudar a orientação, ajuste aqui. Uma palavra ou frase por linha. Termine com * para pegar o começo da palavra: leite* pega leitelho.</p>' +
      '<div class="form"><div class="fl"><label>Avisos da dieta</label>' + chipGroup("d-ativa", ["Ligados","Desligados"], d.ativa ? "Ligados" : "Desligados") + '</div>' +
      '<div class="fl"><label>Lista base</label>' + chipGroup("d-modelo", ["Sem leite","Só a minha lista"], mod ? "Sem leite" : "Só a minha lista") +
      '<p class="note-sm">A lista base sem leite tem ' + DietaMotor.termosDoModelo(DietaMotor.MODELO_SEM_LEITE).length + ' termos e ainda não foi revisada por profissional de saúde.</p></div>' +
      '<div class="fl"><label for="d-nome">Nome da dieta</label><input class="inp" id="d-nome" value="' + esc(d.nome || "") + '" autocomplete="off" placeholder="Ex.: Sem leite e sem soja"></div>' +
      '<div class="fl"><label for="d-evitar">' + (mod ? 'Termos a mais' : 'Termos') + ': se o nome do item tiver um destes, o app avisa “evitar”</label><textarea class="inp txt" id="d-evitar" style="height:150px">' + esc((d.evitar || []).join("\n")) + '</textarea></div>' +
      '<div class="fl"><label for="d-pode">' + (mod ? 'Exceções a mais' : 'Exceções') + ': palavras que não disparam o aviso</label><textarea class="inp txt" id="d-pode">' + esc((d.pode || []).join("\n")) + '</textarea></div>' +
      '<div class="fl"><label for="d-cuidados">' + (mod ? 'Cuidados a mais' : 'Cuidados') + ' na hora da compra</label><textarea class="inp txt" id="d-cuidados">' + esc((d.cuidados || []).join("\n")) + '</textarea></div>' +
      '<div class="fl"><label for="d-obs">Orientação do médico</label><textarea class="inp txt" id="d-obs" placeholder="Ex.: manter a dieta até a próxima consulta">' + esc(d.obs || "") + '</textarea></div>' +
      '<div class="fl"><label for="d-revisao">Próxima revisão com o médico</label><input class="inp" id="d-revisao" type="date" value="' + esc(d.revisao || "") + '"></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="salvar-dieta">Salvar dieta</button>' +
      (state.dieta && state.dieta.anterior ? '<button class="quiet" type="button" data-act="dieta-anterior">Voltar à lista da versão anterior do app</button>' : '') + '</div></div>');
  }
  function linesOf(id){
    var seen = {};
    return document.getElementById(id).value.split(/\n/).map(function(s){ return s.trim(); }).filter(function(s){ var k = norm(s); if(!s || seen[k]) return false; seen[k] = 1; return true; });
  }
  function salvarDieta(){
    var usaModelo = document.getElementById("d-modelo").value === "Sem leite";
    var evitar = linesOf("d-evitar"), ativa = document.getElementById("d-ativa").value !== "Desligados";
    if(ativa && !usaModelo && !evitar.length){ toast("Escreva pelo menos um termo ou use a lista base"); return; }
    var ant = state.dieta && state.dieta.anterior;
    state.dieta = {ativa: ativa, nome: document.getElementById("d-nome").value.trim() || (usaModelo ? DietaMotor.MODELO_SEM_LEITE.nome : "Dieta"),
      modelo: usaModelo ? DietaMotor.MODELO_SEM_LEITE.id : null, evitar: evitar, pode: linesOf("d-pode"), cuidados: linesOf("d-cuidados"),
      obs: document.getElementById("d-obs").value.trim(), revisao: document.getElementById("d-revisao").value || ""};
    if(ant) state.dieta.anterior = ant;
    var ign = DietaMotor.validarExcecoes(state.dieta).ignoradas.length;
    save(); closeSheet(); render(); toast(ign ? "Dieta salva. " + ign + (ign === 1 ? " exceção ignorada" : " exceções ignoradas") + ": anulariam o aviso" : "Dieta salva");
  }
  function usarModelo(){
    var atual = state.dieta || defaultDieta(), base = {};
    DietaMotor.LEGADO_EVITAR.concat(DietaMotor.termosDoModelo(DietaMotor.MODELO_SEM_LEITE)).forEach(function(t){ base[DietaMotor.normalizar(t)] = 1; });
    var nova = DietaMotor.dietaDoModelo(DietaMotor.MODELO_SEM_LEITE.id, atual);
    nova.evitar = (atual.evitar || []).filter(function(t){ return !base[DietaMotor.normalizar(t)]; });
    if(atual.modelo === null && !atual.sugerirModelo) nova.nome = atual.nome || DietaMotor.MODELO_SEM_LEITE.nome;
    if(atual.anterior) nova.anterior = atual.anterior;
    state.dieta = nova; save(); render(); toast("Lista base sem leite ligada");
  }

  /* ---------- Ofertas da semana ---------- */
  function cap(s){ s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function renderOfertas(){
    var v = document.getElementById("view-ofertas"), w = new Date().getDay(), mine = meusMercados();
    var h = '<div><button class="back" type="button" data-act="nav" data-view="inicio">' + IC.left + 'Início</button>' +
      '<h2 class="title">Ofertas da semana</h2><p class="sub">' + (remote ? esc(remote.regiao || "") + ' · atualizado em ' + dShort(remote.atualizado) + (remote.proxima && remote.proxima >= todayStr() ? ' · próxima atualização ' + dShort(remote.proxima) : '') : 'As ofertas chegam quando o app abre com internet.') + '</p></div>';

    avisosAtivos().forEach(function(a){
      h += '<div class="tip"><b>' + esc((a.icone ? a.icone + ' ' : '') + a.titulo) + '</b><span>' + esc(a.texto) + '</span>' +
        (a.fonte && a.fonte.url ? '<span class="src">Fonte: <a href="' + esc(urlExternaSegura(a.fonte.url)) + '" target="_blank" rel="noopener">' + esc(a.fonte.nome || 'link') + '</a></span>' : '') +
        '<button class="x" type="button" data-act="aviso-lido" data-id="' + esc(a.id) + '">Entendi</button></div>';
    });

    var hoje = rotinasDoDia(w), amanha = rotinasDoDia((w + 1) % 7).filter(function(r){ return hoje.indexOf(r) < 0 && r.tipo !== "Semanal"; });
    if(remote && (remote.rotinas || []).length){
      h += '<div class="section"><div class="s-head"><span class="s-title">Hoje, ' + DIAS[w] + '</span></div>';
      if(hoje.length) h += hoje.map(function(r){ return '<div class="today"><span class="ti" aria-hidden="true">' + esc(r.icone || '🏷️') + '</span><div><b>' + esc(cap(tipoTxt(r))) + ' no ' + esc(r.m) + '</b><span>' + esc(r.texto) + '</span></div></div>'; }).join("");
      else h += '<div class="card pad"><p class="note-sm">Hoje não tem dia fixo de oferta nos mercados acompanhados.</p></div>';
      if(amanha.length) h += '<p class="note-sm" style="padding:0 4px">Amanhã: ' + amanha.map(function(r){ return esc(tipoTxt(r)) + ' no ' + esc(r.m); }).join(" · ") + '.</p>';
      h += '</div>';
    }

    var ofs = allOfertas();
    h += '<div class="section"><div class="s-head"><span class="s-title">Preços em oferta</span><span class="s-meta">' + ofs.length + '</span></div>';
    if(!ofs.length){
      h += '<div class="card"><div class="empty"><b>Nenhum preço de oferta cadastrado</b>Os encartes logo abaixo mostram as ofertas. Quer o preço aqui, comparado com o que você já pagou? Tire foto do encarte, mande pro Kaleb e cole o código que ele devolver.' +
        '<div class="sh-actions" style="margin-top:14px"><button class="bigbtn ghost" type="button" data-act="colar-import">Colar código de ofertas</button></div></div></div>';
    } else {
      var rows = ofs.map(function(o){ var it = matchItem(o), c = it && cur(it); return {o: o, it: it, c: c, e: c ? c.p - o.p : null, flag: dietFlag(o.nome)}; });
      rows.sort(function(a, b){
        return (a.flag ? 1 : 0) - (b.flag ? 1 : 0) || ((b.e != null ? b.e : 0) - (a.e != null ? a.e : 0)) || a.o.m.localeCompare(b.o.m) || a.o.nome.localeCompare(b.o.nome, "pt-BR");
      });
      h += '<div class="card"><ul class="rows">' + rows.map(ofRow).join("") + '</ul></div>' +
        '<button class="quiet" type="button" data-act="colar-import">Colar código de outro encarte</button>';
    }
    h += '</div>';

    var enc = encartesAtivos();
    h += '<div class="section"><div class="s-head"><span class="s-title">Encartes valendo</span><span class="s-meta">' + enc.length + '</span></div>';
    if(enc.length){
      h += '<div class="card"><ul class="rows">' + enc.map(function(e){
        var hot = e.fim && daysUntil(e.fim) <= 1;
        return '<li><a class="enc" href="' + esc(urlExternaSegura(e.url)) + '" target="_blank" rel="noopener">' + mkBadge(e.m) +
          '<span class="r-main"><span class="r-name">' + esc(e.titulo) + (mine[mkKey(e.m)] ? '<span class="pill ok">você compra aqui</span>' : '') + '</span>' +
          '<span class="r-meta">' + esc(e.m) + (e.loja ? ' · ' + esc(e.loja) : '') + '</span>' +
          (e.fim ? '<span class="r-meta"><span class="pill' + (hot ? ' hot' : '') + '" style="margin-left:0">' + esc(ateTxt(e.fim)) + '</span></span>' : '') +
          (e.nota ? '<span class="flag-line">' + esc(e.nota) + '</span>' : '') + '</span><span class="go">Abrir ›</span></a></li>';
      }).join("") + '</ul></div>';
    } else {
      h += '<div class="card"><div class="empty">Nenhum encarte valendo agora. A próxima atualização traz os novos.</div></div>';
    }
    if(remote && remote.sem_encarte && remote.sem_encarte.length) h += '<p class="note-sm" style="padding:0 4px">' + esc(remote.sem_encarte.join(", ")) + (remote.sem_encarte.length === 1 ? ' não publica' : ' não publicam') + ' encarte na internet. O preço de lá vem dos seus cupons.</p>';
    h += '</div>';

    var rot = (remote && remote.rotinas) || [];
    if(rot.length){
      h += '<div class="section"><div class="s-head"><span class="s-title">Dias de oferta</span></div><div class="card"><ul class="rows">' + rot.map(function(r){
        var on = (r.dias || []).indexOf(w) >= 0;
        return '<li><div class="rot"><span class="ti" aria-hidden="true">' + esc(r.icone || '🏷️') + '</span><b>' + esc(r.m) + ' · ' + esc(r.tipo) + (on ? '<span class="pill ok">hoje</span>' : '') + '</b>' +
          '<span>' + esc(cap(diasTxt(r.dias))) + '. ' + esc(r.texto) + (r.certeza === "provavel" ? ' Confirme no encarte da semana.' : '') + '</span></div></li>';
      }).join("") + '</ul></div></div>';
    }

    h += '<div class="card pad"><div class="safe">' + IC.shield + '<div><p><b>Preço de encarte vale na loja e no período do encarte.</b> Pode variar de loja pra loja e acabar no estoque. Na dúvida, vale o preço da gôndola. Produto novo também passa pela regra da dieta: leia o rótulo.</p></div></div></div>';
    v.innerHTML = h;
  }
  function ofRow(r){
    var o = r.o, it = r.it, inList = !!(it && it.lista && it.oferta && it.oferta.oid === o.id), cmp = "";
    if(r.c){
      if(r.e > 0.009) cmp = '<div class="of-cmp good">' + brl(r.e) + ' a menos do que você pagou no ' + esc(r.c.m || 'último mercado') + '</div>';
      else if(r.e < -0.009) cmp = '<div class="of-cmp bad">Mais caro do que você pagou no ' + esc(r.c.m || 'último mercado') + ' (' + brl(r.c.p) + ')</div>';
      else cmp = '<div class="of-cmp">Mesmo preço que você pagou</div>';
    }
    return '<li><div class="ofrow">' + (it ? thumb(it) : '<span class="thumb" aria-hidden="true">' + autoIcon(o.nome, o.cat) + '</span>') +
      '<div class="r-main"><div class="r-name">' + esc(o.nome) + (r.flag ? '<span class="flag">evitar</span>' : '') + '</div>' +
      '<div class="r-meta">' + mkBadge(o.m, 'sm') + esc(o.m) + (o.por ? ' · ' + esc(o.por) : '') + (o.fim ? ' · ' + esc(ateTxt(o.fim)) : '') + '</div>' + cmp + '</div>' +
      '<div class="of-side"><span class="r-val">' + brl(o.p) + (o.por === "kg" ? '<small>por kg</small>' : '') + '</span>' + (o.de > o.p ? '<span class="of-de">' + brl(o.de) + '</span>' : '') +
      '<button class="of-add' + (inList ? ' on' : '') + '" type="button" data-act="oferta-lista" data-oid="' + esc(o.id) + '" aria-label="' + (inList ? 'Ver na lista: ' : 'Pôr na lista: ') + esc(o.nome) + '">' + (inList ? '✓ Na lista' : '+ Lista') + '</button></div></div></li>';
  }
  function addOfertaToList(oid){
    var o = findOferta(oid); if(!o) return;
    var it = matchItem(o);
    if(it && it.lista && it.oferta && it.oferta.oid === o.id){ show("lista"); return; }
    if(!it){ it = {id: uid(), cat: CATS.indexOf(o.cat) >= 0 ? o.cat : "Outros", nome: o.nome, por: o.por || "unidade", hist: [], nota: "", basico: false, lista: false, qtd: 1, ok: false, icon: ""}; state.items.push(it); }
    it.oferta = {p: o.p, m: o.m, fim: o.fim || "", oid: o.id, nome: o.nome};
    it.lista = true; it.ok = false;
    save(); render();
    toast(dietFlag(o.nome) || dietFlag(it) ? "Na lista, mas tem termo da dieta: evitar" : "Foi pra lista com o preço da oferta");
  }
  function parseOfertasCode(text){
    var s = String(text || "").trim(), k = s.indexOf("ofertas=");
    if(k >= 0) s = s.slice(k + 8);
    var mt = s.match(/[A-Za-z0-9_-]{40,}/); if(!mt) return null;
    var o = decodePayload(mt[0]);
    if(!o || o.v !== 1 || o.tipo !== "ofertas" || !o.m || !Array.isArray(o.i) || !o.i.length) return null;
    if(o.fim && !/^\d{4}-\d{2}-\d{2}$/.test(o.fim)) return null;
    return o;
  }
  function sheetOfertasImport(o){
    ui.sheet = {type: "ofimport", data: o};
    var ja = !!o.id && (state.ofImportados || []).indexOf(o.id) >= 0, vencido = !!o.fim && o.fim < todayStr();
    var rows = o.i.map(function(r){
      var it = matchItem({nome: r[0], por: r[2], item: r[5] || ""}), c = it && cur(it), e = c ? c.p - (+r[3]) : null;
      return '<li><span>' + esc(r[0]) + (dietFlag(r[0]) ? ' · <b class="up">evitar</b>' : '') +
        (e != null ? (e > 0.009 ? ' · <b class="down">' + brl(e) + ' a menos</b>' : (e < -0.009 ? ' · <b class="up">mais caro</b>' : '')) : '') +
        '</span><b class="num">' + brl(+r[3]) + (r[2] === "kg" ? '/kg' : '') + '</b></li>';
    }).join("");
    openSheet('<div class="pic-row">' + mkBadge(o.m) + '<div><h3 class="sh-title" id="sh-title">' + esc(o.t || ("Ofertas do " + o.m)) + '</h3><p class="sh-sub">' + esc(o.m) + ' · ' + o.i.length + (o.i.length === 1 ? ' oferta' : ' ofertas') + (o.fim ? ' · ' + esc(ateTxt(o.fim)) : '') + '</p></div></div>' +
      '<div class="form">' + (ja ? '<div class="warnbox">Essas ofertas já foram importadas.</div>' : '') + (vencido ? '<div class="warnbox">Esse encarte acabou em ' + dLong(o.fim) + '.</div>' : '') +
      '<div class="fl"><label>Ofertas</label><ul class="hist">' + rows + '</ul></div>' +
      '<p class="note-sm">Ao importar, as ofertas aparecem em Ofertas da semana comparadas com o que você pagou, e somem sozinhas quando o encarte acaba. Os seus preços pagos não mudam.</p>' +
      '<div class="sh-actions">' + (ja || vencido ? '' : '<button class="bigbtn" type="button" data-act="confirmar-ofertas">Importar ofertas</button>') +
      '<button class="quiet" type="button" data-act="fechar">' + (ja || vencido ? 'Fechar' : 'Cancelar') + '</button></div></div>');
  }
  function confirmOfertas(){
    var o = ui.sheet && ui.sheet.data; if(!o) return;
    state.ofImportados = state.ofImportados || []; state.ofertas = state.ofertas || [];
    if(o.id && state.ofImportados.indexOf(o.id) >= 0){ toast("Essas ofertas já foram importadas"); return; }
    var base = o.id || uid(), n = 0;
    o.i.forEach(function(r, i){
      var p = +r[3]; if(!(p > 0) || !r[0]) return;
      state.ofertas.push({id: base + "-" + i, m: o.m, nome: String(r[0]), cat: r[1] || "Outros", por: r[2] || "unidade", p: Math.round(p * 100) / 100, de: +r[4] || 0, ini: o.ini || "", fim: o.fim || "", item: r[5] || "", t: o.t || "", url: o.u || ""});
      n++;
    });
    if(o.id){ state.ofImportados.push(o.id); state.ofImportados = state.ofImportados.slice(-60); }
    save(); closeSheet(); show("ofertas"); toast(n + (n === 1 ? " oferta importada" : " ofertas importadas"));
  }
  function limparOfertasVencidas(){
    var t = todayStr();
    state.ofertas = (state.ofertas || []).filter(function(o){ return !o.fim || o.fim >= t; });
    state.items.forEach(function(it){ if(it.oferta && it.oferta.fim && it.oferta.fim < t) delete it.oferta; });
  }

  /* ---------- Tempo real: a casa no Firebase ----------
     Cada item, gasto, mês e configuração vira um documento em casas/{id}/...
     Só os campos que mudaram são enviados, então duas pessoas mexendo em coisas diferentes não se atropelam.
     Sem internet, o Firestore guarda no celular e envia quando a rede volta. */
  var FB_CONFIG = null; /* {apiKey, authDomain, projectId, appId}: entra aqui quando o projeto do Firebase existir */
  var FB_CONFIG_HML = null; /* projeto Firebase só de teste, com dados falsos; nunca o de produção */
  var CASA_KEY = PFX + "despensa-casa";
  var COLS = ["itens", "gastos", "meses", "config", "ofertas"];
  var Sync = {casa: null, db: null, auth: null, uid: null, ready: false, loaded: {}, started: {}, shadow: {}, membros: {}, unsub: [], pending: 0, timer: null, rtimer: null, evs: [], etimer: null, err: "", online: navigator.onLine !== false};
  function fbCfg(){
    var t = window.__DESPENSA_FB__, inj = t && t.config;
    if(HML) return (inj && /^demo-/.test(inj.projectId || "")) ? inj : FB_CONFIG_HML; /* homologação: só emulador ou projeto de teste */
    return inj || FB_CONFIG;
  }
  /* BLOQUEIO DE SEGURANÇA — ACL ainda sem onboarding: nenhum navegador inicia a
     sincronização legada por config injetada. NÃO trocar para true sem migração,
     testes de regras no emulador e aprovação explícita do fundador. */
  var SYNC_FAMILIAR_ACL_HOMOLOGADA = false;
  function syncDisponivel(){ return SYNC_FAMILIAR_ACL_HOMOLOGADA && !!fbCfg(); }
  function loadCasa(){ try{ var c = JSON.parse(localStorage.getItem(CASA_KEY) || "null"); if(c && c.id && c.id.length >= 20) return c; }catch(e){} return null; }
  function saveCasa(c){ try{ if(c) localStorage.setItem(CASA_KEY, JSON.stringify(c)); else localStorage.removeItem(CASA_KEY); }catch(e){} }
  function novoIdCasa(){ var b = new Uint8Array(20), s = ""; crypto.getRandomValues(b); for(var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function linkCasa(id){ return location.origin + location.pathname.replace(/index\.html$/, "") + "#casa=" + id; }
  function parseCasa(text){ var m = String(text || "").match(/casa=([A-Za-z0-9_-]{20,})/); return m ? m[1] : null; }
  function stableStr(v){
    if(v === null || typeof v !== "object") return JSON.stringify(v);
    if(Array.isArray(v)) return "[" + v.map(function(x){ return x === undefined ? "null" : stableStr(x); }).join(",") + "]";
    return "{" + Object.keys(v).filter(function(k){ return v[k] !== undefined; }).sort().map(function(k){ return JSON.stringify(k) + ":" + stableStr(v[k]); }).join(",") + "}";
  }
  function campos(obj){ var o = {}; Object.keys(obj || {}).forEach(function(k){ if(k.charAt(0) === "_" || obj[k] === undefined) return; o[k] = stableStr(obj[k]); }); return o; }
  function mesmosCampos(a, b){ if(!a || !b) return false; var ka = Object.keys(a), kb = Object.keys(b); if(ka.length !== kb.length) return false; for(var i = 0; i < ka.length; i++){ if(a[ka[i]] !== b[ka[i]]) return false; } return true; }
  function limpo(v){ return v === undefined ? null : JSON.parse(JSON.stringify(v)); }
  function semMeta(d){ var o = {}; Object.keys(d || {}).forEach(function(k){ if(k.charAt(0) !== "_") o[k] = d[k]; }); return o; }
  function uniao(a, b){ var s = {}, out = []; (a || []).concat(b || []).forEach(function(x){ if(!s[x]){ s[x] = 1; out.push(x); } }); return out.slice(-60); }

  function loadSdk(cb, fail){
    if(window.FBSDK) return cb();
    var s = document.createElement("script"); s.src = "vendor/firebase.js"; s.async = true;
    s.onload = function(){ if(window.FBSDK) cb(); else fail(); }; s.onerror = function(){ fail(); };
    document.head.appendChild(s);
  }
  function fbInit(){
    if(Sync.db) return;
    var F = window.FBSDK, t = window.__DESPENSA_FB__ || {};
    var app = F.initializeApp(fbCfg());
    Sync.auth = F.initializeAuth(app, {persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence]});
    try{ Sync.db = F.initializeFirestore(app, {localCache: F.persistentLocalCache({tabManager: F.persistentMultipleTabManager()})}); }
    catch(e){ Sync.db = F.initializeFirestore(app, {localCache: F.memoryLocalCache()}); }
    if(t.emu){ F.connectAuthEmulator(Sync.auth, "http://" + t.emu + ":9099", {disableWarnings: true}); F.connectFirestoreEmulator(Sync.db, t.emu, 8080); }
  }
  function fbReady(cb, fail){
    loadSdk(function(){
      try{ fbInit(); }catch(e){ fail(e); return; }
      if(Sync.uid) return cb();
      var F = window.FBSDK, asked = false, done = false;
      F.onAuthStateChanged(Sync.auth, function(u){
        if(done) return;
        if(u){ done = true; Sync.uid = u.uid; cb(); }
        else if(!asked){ asked = true; F.signInAnonymously(Sync.auth).catch(function(e){ if(!done){ done = true; fail(e); } }); }
      });
    }, function(){ fail(new Error("sdk")); });
  }
  function cref(c){ return window.FBSDK.collection(Sync.db, "casas", Sync.casa.id, c); }
  function dref(c, id){ return window.FBSDK.doc(Sync.db, "casas", Sync.casa.id, c, id); }

  /* O estado do app, quebrado em documentos */
  function entidades(){
    var E = {itens: {}, gastos: {}, meses: {}, config: {}, ofertas: {}};
    state.items.forEach(function(it){ E.itens[it.id] = it; });
    Object.keys(state.meses).forEach(function(k){ var m = state.meses[k]; E.meses[k] = {orc: m.orc || 0}; (m.gastos || []).forEach(function(g){ E.gastos[g.id] = g; }); });
    E.config.dieta = state.dieta || defaultDieta();
    E.config.geral = {importados: state.importados || [], ofImportados: state.ofImportados || []};
    (state.ofertas || []).forEach(function(o){ E.ofertas[o.id] = o; });
    return E;
  }
  function agendarEnvio(){ if(!Sync.casa || !Sync.ready) return; clearTimeout(Sync.timer); Sync.timer = setTimeout(enviar, 250); }
  function enviar(){
    clearTimeout(Sync.timer); Sync.timer = null;
    if(!Sync.casa || !Sync.ready || !Sync.db) return;
    var F = window.FBSDK, E = entidades(), ops = [];
    COLS.forEach(function(c){
      var sh = Sync.shadow[c] || (Sync.shadow[c] = {}), atual = E[c];
      Object.keys(atual).forEach(function(id){
        var obj = atual[id], now = campos(obj), prev = sh[id], upd = {}, n = 0;
        Object.keys(now).forEach(function(k){ if(!prev || prev[k] !== now[k]){ upd[k] = limpo(obj[k]); n++; } });
        if(prev) Object.keys(prev).forEach(function(k){ if(!(k in now)){ upd[k] = F.deleteField(); n++; } });
        if(n){ upd._by = Sync.uid; upd._nome = Sync.casa.eu || ""; upd._at = F.serverTimestamp(); ops.push(["set", c, id, upd]); sh[id] = now; }
      });
      Object.keys(sh).forEach(function(id){ if(!(id in atual)){ ops.push(["del", c, id]); delete sh[id]; } });
    });
    for(var i = 0; i < ops.length; i += 400){
      (function(part){
        var b = F.writeBatch(Sync.db);
        part.forEach(function(o){ if(o[0] === "set") b.set(dref(o[1], o[2]), o[3], {merge: true}); else b.delete(dref(o[1], o[2])); });
        Sync.pending += part.length; syncPill();
        b.commit().then(function(){ Sync.pending = Math.max(0, Sync.pending - part.length); Sync.err = ""; syncPill(); },
          function(e){ Sync.pending = Math.max(0, Sync.pending - part.length); Sync.err = String((e && e.code) || e); syncPill(); });
      })(ops.slice(i, i + 400));
    }
  }

  /* O que chega dos outros celulares */
  function achaGasto(id){ var r = null; Object.keys(state.meses).forEach(function(k){ state.meses[k].gastos.forEach(function(g){ if(g.id === id) r = g; }); }); return r; }
  function tiraGasto(id){ Object.keys(state.meses).forEach(function(k){ var m = state.meses[k]; m.gastos = m.gastos.filter(function(g){ return g.id !== id; }); }); }
  function aplicar(c, id, d){
    var o = semMeta(d);
    if(c === "itens"){
      o.id = id; var it = findItem(id), evLocal = it && it.ev;
      if(it){ Object.keys(it).forEach(function(k){ if(!(k in o)) delete it[k]; }); for(var k in o) it[k] = o[k]; if(!it.ev && evLocal) it.ev = evLocal; }
      else { state.items.push(Object.assign({hist: [], nota: "", basico: false, lista: false, qtd: 1, ok: false, icon: ""}, o)); }
    } else if(c === "gastos"){
      o.id = id; tiraGasto(id); if(o.data) mesData(monthKey(o.data), true).gastos.push(o);
    } else if(c === "meses"){
      mesData(id, true).orc = +o.orc || 0;
    } else if(c === "config"){
      if(id === "dieta" && o && typeof o === "object") state.dieta = DietaMotor.migrar(o);
      if(id === "geral"){ state.importados = uniao(state.importados, o.importados); state.ofImportados = uniao(state.ofImportados, o.ofImportados); }
    } else if(c === "ofertas"){
      o.id = id; state.ofertas = (state.ofertas || []).filter(function(x){ return x.id !== id; }); state.ofertas.push(o);
    }
  }
  function remover(c, id){
    if(c === "itens") state.items = state.items.filter(function(x){ return x.id !== id; });
    else if(c === "gastos") tiraGasto(id);
    else if(c === "ofertas") state.ofertas = (state.ofertas || []).filter(function(x){ return x.id !== id; });
  }
  function salvarLocal(){ mem = state; try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
  function agendarRender(){ clearTimeout(Sync.rtimer); Sync.rtimer = setTimeout(function(){ render(); }, 80); }
  function evento(c, id, tipo, antes, d){
    var quem = d._nome || "Alguém";
    if(c === "gastos") return antes ? [5, quem + " alterou um gasto", quem] : [1, quem + " anotou " + brl(+d.valor || 0) + (d.local ? " no " + d.local : ""), quem];
    if(c === "itens"){
      var it = findItem(id); if(!it) return null;
      if(!antes) return [3, quem + " cadastrou " + it.nome, quem];
      if(!antes.lista && it.lista) return [2, quem + " pôs " + it.nome + " na lista", quem];
      if(!antes.ok && it.ok) return [8, "", quem, "ok"];
      if((antes.hist || []).length < (it.hist || []).length || stableStr(antes.hist) !== stableStr(it.hist)) return [4, quem + " atualizou o preço de " + it.nome, quem];
      return null;
    }
    if(c === "meses") return [6, quem + " mudou o orçamento de " + mesNome(id) + " pra " + brl(+d.orc || 0), quem];
    if(c === "config" && id === "dieta") return [6, quem + " atualizou a dieta", quem];
    if(c === "ofertas") return [7, quem + " importou ofertas de um encarte", quem];
    return null;
  }
  function avisar(ev){
    Sync.evs.push(ev); clearTimeout(Sync.etimer);
    Sync.etimer = setTimeout(function(){
      var evs = Sync.evs; Sync.evs = [];
      evs.sort(function(a, b){ return a[0] - b[0]; });
      var top = evs[0], n = evs.filter(function(e){ return e[0] === top[0]; }).length, msg = top[1];
      if(top[3] === "ok") msg = top[2] + " pôs " + (n === 1 ? "1 item" : n + " itens") + " no carrinho";
      else if(n > 1 && top[0] === 2) msg = top[2] + " pôs " + n + " itens na lista";
      else if(n > 1 && top[0] === 4) msg = top[2] + " atualizou " + n + " preços";
      else if(n > 1 && top[0] === 3) msg = top[2] + " cadastrou " + n + " itens";
      else if(top[0] === 7) msg = top[1];
      if(msg) toast(msg, 3200);
    }, 900);
  }
  function ouvir(c){
    var F = window.FBSDK;
    return F.onSnapshot(cref(c), {includeMetadataChanges: true}, function(snap){
      if(Sync.timer) enviar();
      var mudou = false, primeira = !Sync.started[c];
      snap.docChanges().forEach(function(ch){
        var id = ch.doc.id, sh = Sync.shadow[c] || (Sync.shadow[c] = {});
        if(ch.type === "removed"){ remover(c, id); delete sh[id]; mudou = true; return; }
        var d = ch.doc.data(), now = campos(semMeta(d));
        if(mesmosCampos(sh[id], now)) return;
        var antes = c === "itens" ? (findItem(id) ? JSON.parse(JSON.stringify(findItem(id))) : null) : (c === "gastos" ? achaGasto(id) : true);
        aplicar(c, id, d); sh[id] = now; mudou = true;
        if(!primeira && d._by && d._by !== Sync.uid){ var ev = evento(c, id, ch.type, antes, d); if(ev) avisar(ev); }
      });
      /* Coleção vazia vinda só do cache não conta como carregada na primeira vez: evita mandar dados velhos por cima da casa */
      if(!Sync.loaded[c]){
        if(!snap.metadata.fromCache || snap.size > 0){ Sync.loaded[c] = true; if(snap.metadata.fromCache && snap.size > 0) Sync.cacheOk = true; checarPronto(); }
        else { Sync.vazioCache = Sync.vazioCache || {}; Sync.vazioCache[c] = true; checarPronto(); }
      }
      Sync.started[c] = true;
      if(mudou){ salvarLocal(); agendarRender(); }
    }, function(e){ Sync.err = String((e && e.code) || e); syncPill(); });
  }
  function ouvirMembros(){
    var F = window.FBSDK;
    return F.onSnapshot(cref("membros"), function(snap){
      var primeira = !Sync.started.membros;
      snap.docChanges().forEach(function(ch){
        var d = ch.doc.data() || {};
        if(ch.type === "removed"){ delete Sync.membros[ch.doc.id]; return; }
        var novo = !Sync.membros[ch.doc.id]; Sync.membros[ch.doc.id] = d.nome || "Alguém";
        if(!primeira && novo && ch.doc.id !== Sync.uid) toast((d.nome || "Alguém") + " entrou na " + (Sync.casa ? Sync.casa.nome : "casa"), 3200);
      });
      Sync.started.membros = true;
      if(ui.sheet && ui.sheet.type === "casa") sheetCasa();
    }, function(){});
  }
  function checarPronto(){
    if(Sync.ready) return;
    for(var i = 0; i < COLS.length; i++){
      var c = COLS[i];
      if(!Sync.loaded[c] && Sync.casa.sincronizado && Sync.cacheOk && Sync.vazioCache && Sync.vazioCache[c]) Sync.loaded[c] = true;
      if(!Sync.loaded[c]) return;
    }
    Sync.ready = true;
    if(!Sync.casa.sincronizado){ Sync.casa.sincronizado = true; saveCasa(Sync.casa); }
    enviar(); syncPill(); render();
  }
  function conectar(){
    var F = window.FBSDK;
    Sync.unsub.forEach(function(u){ try{ u(); }catch(e){} });
    Sync.ready = false; Sync.loaded = {}; Sync.started = {}; Sync.shadow = {}; Sync.membros = {}; Sync.err = ""; Sync.cacheOk = false; Sync.vazioCache = {};
    COLS.forEach(function(c){ Sync.shadow[c] = {}; });
    Sync.unsub = COLS.map(ouvir).concat([ouvirMembros()]);
    F.setDoc(dref("membros", Sync.uid), {nome: Sync.casa.eu || "", visto: F.serverTimestamp()}, {merge: true}).catch(function(){});
    F.getDoc(F.doc(Sync.db, "casas", Sync.casa.id)).then(function(s){
      if(s.exists() && s.data().nome && s.data().nome !== Sync.casa.nome){ Sync.casa.nome = s.data().nome; saveCasa(Sync.casa); syncPill(); }
    }).catch(function(){});
    syncPill();
  }
  function syncBoot(){
    if(!syncDisponivel()) return;
    var c = loadCasa(); if(!c) return;
    Sync.casa = c; syncPill();
    fbReady(conectar, function(){ Sync.err = "sem conexão"; syncPill(); });
  }
  function criarCasa(nome, eu){
    if(navigator.onLine === false){ toast("Precisa de internet pra criar a casa"); return; }
    var c = {id: novoIdCasa(), nome: nome, eu: eu, desde: todayStr()}, btn = sheet.querySelector('[data-act="confirmar-casa"]');
    if(btn){ btn.disabled = true; btn.textContent = "Criando…"; }
    fbReady(function(){
      var F = window.FBSDK;
      F.setDoc(F.doc(Sync.db, "casas", c.id), {nome: nome, criada: F.serverTimestamp(), v: 1, criador: Sync.uid}).then(function(){
        Sync.casa = c; saveCasa(c); conectar(); render(); sheetConvite(true);
      }, function(){ if(btn){ btn.disabled = false; btn.textContent = "Criar e ligar"; } toast("Não deu pra criar agora. Confira a internet"); });
    }, function(){ if(btn){ btn.disabled = false; btn.textContent = "Criar e ligar"; } toast("Não deu pra conectar agora"); });
  }
  function entrarCasa(id, eu){
    if(navigator.onLine === false){ toast("Precisa de internet pra entrar"); return; }
    var btn = sheet.querySelector('[data-act="confirmar-entrar"]');
    if(btn){ btn.disabled = true; btn.textContent = "Entrando…"; }
    fbReady(function(){
      var F = window.FBSDK;
      F.getDoc(F.doc(Sync.db, "casas", id)).then(function(s){
        if(!s.exists()){ if(btn){ btn.disabled = false; btn.textContent = "Entrar"; } toast("Convite inválido"); return; }
        var c = {id: id, nome: s.data().nome || "Casa", eu: eu, desde: todayStr()};
        if(Sync.casa) sairCasa(true);
        Sync.casa = c; saveCasa(c); conectar(); closeSheet(); show("inicio"); toast("Você entrou na " + c.nome, 2600);
      }, function(){ if(btn){ btn.disabled = false; btn.textContent = "Entrar"; } toast("Não deu pra entrar agora"); });
    }, function(){ if(btn){ btn.disabled = false; btn.textContent = "Entrar"; } toast("Não deu pra conectar agora"); });
  }
  function sairCasa(quieto){
    Sync.unsub.forEach(function(u){ try{ u(); }catch(e){} });
    Sync.unsub = []; Sync.casa = null; Sync.ready = false; Sync.pending = 0; Sync.membros = {};
    saveCasa(null);
    if(!quieto){ syncPill(); render(); }
  }
  function syncPill(){
    var el = document.getElementById("top-note"); if(!el || !state) return;
    if(!Sync.casa){ el.textContent = state.dieta && state.dieta.ativa ? state.dieta.nome : ""; return; }
    var off = Sync.online === false, txt, cls = "live";
    if(off){ txt = "Sem sinal" + (Sync.pending ? " · " + Sync.pending + (Sync.pending === 1 ? " guardada" : " guardadas") : ""); cls += " off"; }
    else if(Sync.err && !Sync.ready){ txt = "Sem conexão"; cls += " off"; }
    else if(!Sync.ready){ txt = "Conectando…"; cls += " wait"; }
    else if(Sync.pending){ txt = "Enviando…"; cls += " wait"; }
    else txt = "Ao vivo";
    el.innerHTML = '<button class="' + cls + '" type="button" data-act="casa" aria-label="Casa compartilhada: ' + esc(txt) + '"><i></i>' + esc(txt) + '</button>';
  }
  window.addEventListener("online", function(){ Sync.online = true; syncPill(); });
  window.addEventListener("offline", function(){ Sync.online = false; syncPill(); });

  /* Telas da casa */
  function rtCardHtml(){
    if(!syncDisponivel() || Sync.casa) return "";
    return '<div class="rt-card"><b>🔄 Usar junto, em tempo real</b><p>O que um anota, o outro vê na hora, nos dois celulares. Funciona sem sinal e guarda tudo na nuvem.</p>' +
      '<div class="rt-actions"><button class="act" type="button" data-act="criar-casa">Criar a casa</button><button class="btn-sm" type="button" data-act="colar-import">Tenho um convite</button></div></div>';
  }
  function sheetCriarCasa(){
    ui.sheet = {type: "criar-casa"};
    openSheet('<h3 class="sh-title" id="sh-title">Criar a casa</h3><p class="sh-sub">Depois é só mandar o convite. Tudo o que já está neste celular vai junto.</p>' +
      '<div class="form"><div class="fl"><label for="c-nome">Nome da casa</label><input class="inp" id="c-nome" autocomplete="off" placeholder="Ex.: Casa da Ana"></div>' +
      '<div class="fl"><label for="c-eu">Seu nome</label><input class="inp" id="c-eu" autocomplete="off" placeholder="Ex.: Ana"><p class="note-sm">Aparece pros outros quando você anota alguma coisa.</p></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="confirmar-casa">Criar e ligar</button><button class="quiet" type="button" data-act="fechar">Agora não</button></div></div>', "c-nome");
  }
  function conviteTexto(){
    return "Entra na nossa casa no app Elida (" + Sync.casa.nome + "). O que um anota, o outro vê na hora.\n\n" +
      "Android: é só tocar no link.\niPhone: abra o app Elida pela tela de início, toque em Tenho um convite e cole esta mensagem inteira.\n\n" + linkCasa(Sync.casa.id);
  }
  function sheetConvite(primeira){
    if(!Sync.casa) return;
    ui.sheet = {type: "convite"};
    openSheet('<h3 class="sh-title" id="sh-title">' + esc(Sync.casa.nome) + '</h3><p class="sh-sub">' + (primeira ? 'Pronto, a casa está ligada. Agora chame quem faz as compras com você.' : 'Convide quem faz as compras com você.') + '</p>' +
      '<div class="form"><div class="tip" style="border-left-color:var(--good)"><b>Quem entrar pelo link vê e anota tudo junto com você.</b><span>Não encaminhe pra mais ninguém.</span></div>' +
      '<div class="linkbox">' + esc(linkCasa(Sync.casa.id)) + '</div>' +
      '<div class="sh-actions"><a class="bigbtn wa" href="https://wa.me/?text=' + encodeURIComponent(conviteTexto()) + '" target="_blank" rel="noopener">' + IC.wa + 'Mandar convite no WhatsApp</a>' +
      '<button class="bigbtn ghost" type="button" data-act="copiar-convite">Copiar convite</button><button class="quiet" type="button" data-act="fechar">Fechar</button></div></div>');
  }
  function sheetEntrar(id){
    ui.sheet = {type: "entrar", id: id};
    var standalone = window.navigator.standalone || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    var iosSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone;
    var ja = Sync.casa && Sync.casa.id === id;
    openSheet('<h3 class="sh-title" id="sh-title">' + (ja ? 'Você já está nessa casa' : 'Entrar na casa') + '</h3><p class="sh-sub" id="entrar-nome">' + (ja ? esc(Sync.casa.nome) : 'Convite pra usar o Elida junto, em tempo real.') + '</p>' +
      (ja ? '<div class="form"><div class="sh-actions"><button class="bigbtn" type="button" data-act="fechar">Ok</button></div></div>' :
      '<div class="form">' +
      (iosSafari ? '<div class="warnbox">Você abriu no Safari. Se usa o Elida pelo ícone da tela de início, entre por lá: abra o app, toque em <b>Tenho um convite</b> e cole a mensagem. O iPhone guarda os dois separados.</div>' : '') +
      '<div class="fl"><label for="e-eu">Seu nome</label><input class="inp" id="e-eu" autocomplete="off" placeholder="Ex.: João"><p class="note-sm">O que já está neste celular vai junto pra casa. Se o mesmo item estiver nos dois, vale o da casa.</p></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="confirmar-entrar">Entrar</button><button class="quiet" type="button" data-act="fechar">Agora não</button></div></div>'), ja ? null : "e-eu");
    if(!ja && navigator.onLine !== false) fbReady(function(){
      window.FBSDK.getDoc(window.FBSDK.doc(Sync.db, "casas", id)).then(function(s){
        var el = document.getElementById("entrar-nome");
        if(el && ui.sheet && ui.sheet.type === "entrar"){ el.textContent = s.exists() ? ("Convite pra " + (s.data().nome || "casa") + ". O que um anota, o outro vê na hora.") : "Esse convite não vale mais."; }
      }).catch(function(){});
    }, function(){});
  }
  function sheetCasa(){
    if(!Sync.casa) return;
    ui.sheet = {type: "casa"};
    var ms = Object.keys(Sync.membros).map(function(u){ return [u, Sync.membros[u]]; });
    var status = Sync.online === false ? "Sem sinal. O que você anotar fica guardado aqui e sobe sozinho quando a internet voltar." :
      (!Sync.ready ? (Sync.err ? "Sem conexão com a casa agora. Tente abrir de novo com internet." : "Conectando com a casa…") : (Sync.pending ? "Enviando as últimas alterações…" : "Tudo em dia. O que um anota, o outro vê na hora."));
    openSheet('<h3 class="sh-title" id="sh-title">' + esc(Sync.casa.nome) + '</h3><p class="sh-sub">' + esc(status) + '</p>' +
      '<div class="form"><div class="fl"><label>Quem está na casa</label><ul class="membros">' +
      (ms.length ? ms.map(function(m){ return '<li>' + mkBadge(m[1] || "?", 'sm') + esc(m[1] || "Sem nome") + (m[0] === Sync.uid ? ' <small>(você)</small>' : '') + '</li>'; }).join("") : '<li><small>Carregando…</small></li>') + '</ul></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="convidar">Convidar alguém</button>' +
      '<button class="quiet" type="button" data-act="sair-casa" id="btn-sair">Sair da casa neste celular</button></div>' +
      '<p class="note-sm">Sair só desliga o tempo real neste celular. O que está aqui continua aqui, e a casa continua pros outros.</p></div>');
  }

  /* ---------- Toast e cópia ---------- */
  var toastT = null;
  function toast(msg, ms){
    var t = document.getElementById("toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove("on"); }, ms || 1900);
  }
  function copy(txt, el){
    var ok = function(){ toast("Copiado"); };
    var fallback = function(){ if(el){ el.focus(); el.select(); } toast("Segure no texto e copie"); };
    try{ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(ok, fallback); } else { fallback(); } }catch(e){ fallback(); }
  }

  /* ---------- Navegação ---------- */
  var VIEWS = ["inicio","precos","lista","rotulo","ofertas","perfis","rotulos"];
  /* ---------- Elida IA: perfis e rótulos dentro do app ----------
     Perfis ficam neste endereço (mesma origem do app), só com consentimento. A busca usa o
     contrato do elida-busca.js: dados fictícios na homologação, "indisponível" em produção. */
  var IA = window.ElidaRegras, BUS = window.ElidaBusca;
  var Perfis = IA.criarArmazem(window.localStorage, PFX + "elida-perfis-v1");
  var perfisEstado = Perfis.carregar();
  /* Marco 3: em homologação dá para escolher a fonte de teste (fictícia ou Open Food Facts real, como rascunho).
     Em produção nenhum provedor é criado: o OFF exige aprovação expressa e a busca responde "indisponível". */
  var OCR = window.ElidaOCR;
  var FONTE_TESTE_KEY = PFX + "elida-fonte-teste";
  var CONF_KEY = PFX + "elida-conferencias-v1";
  var OFF_CACHE_KEY = PFX + "elida-off-cache";
  function fonteTeste(){ if(!AMB.homologacao) return null; try{ return localStorage.getItem(FONTE_TESTE_KEY) === "off" ? "off" : "ficticio"; }catch(e){ return "ficticio"; } }
  function cacheOFF(){
    function ler(){ try{ return JSON.parse(localStorage.getItem(OFF_CACHE_KEY) || "{}") || {}; }catch(e){ return {}; } }
    return { ler: function(k){ return ler()[k] || null; }, gravar: function(k, v){ var m = ler(); m[k] = v; var ks = Object.keys(m);
      if(ks.length > 200) ks.sort(function(a, b){ return m[a].em - m[b].em; }).slice(0, ks.length - 200).forEach(function(x){ delete m[x]; });
      try{ localStorage.setItem(OFF_CACHE_KEY, JSON.stringify(m)); }catch(e){} } };
  }
  function criarProvedorIA(){
    if(!AMB.homologacao) return null;
    if(fonteTeste() === "off") return BUS.provedorOpenFoodFacts({ appName: "Elida-homologacao", appVersion: "c" + BUS.VERSAO_CONTRATO + "-" + IA.VERSAO_MOTOR, cache: cacheOFF() });
    return AMB.catalogoFicticio ? BUS.provedorFicticio() : null;
  }
  var Busca = BUS.criarBusca({ provedor: criarProvedorIA(), producao: AMB.producao });
  var buscaIA = { texto: "", resposta: null, rodando: false };
  var gatilhosIA = IA.criarGatilhos({
    REAVALIAR_RESULTADOS_LOCAIS: function(){ if(ui.view === "rotulos" || ui.view === "perfis") render(); },
    INVALIDAR_RESULTADOS_E_REAVALIAR: function(){ if(ui.view === "rotulos" || ui.view === "perfis") render(); },
    EXCLUIR_DADOS_DO_PERFIL: function(){ render(); },
    BUSCAR_PRODUTO_E_APLICAR_PERFIL: function(ctx){ executarBusca(ctx.texto); },
    CONSULTAR_FONTE_E_APLICAR_PERFIL: function(ctx){ executarBusca(ctx.texto); }
  }, { fornecedorAprovado: !!Busca.fornecedor });
  function perfilAtivo(){ return perfisEstado.perfis.filter(function(p){ return p.id === perfisEstado.ativo; })[0] || null; }
  function salvarPerfis(){ return Perfis.salvar(perfisEstado); }
  function segDieta(atual){
    return '<nav class="seg" aria-label="Seções da dieta">' + [["rotulo","Avisos da lista"],["perfis","Perfis"],["rotulos","Rótulos"]].map(function(s){
      return '<button type="button" data-act="nav" data-view="' + s[0] + '"' + (s[0] === atual ? ' aria-current="page"' : '') + '>' + s[1] + '</button>'; }).join("") + '</nav>';
  }
  function nomesRestricoes(p){ return p.restricoes.map(function(r){ return IA.RESTRICOES[r.tipo].nome + " (" + IA.SITUACOES[r.situacao].toLowerCase() + ")"; }).join(", "); }
  function renderPerfisIA(){
    var v = document.getElementById("view-perfis"), ps = perfisEstado.perfis;
    var h = segDieta("perfis") + '<div class="head-row"><div><h2 class="title">Perfis</h2><p class="sub">Um perfil para cada pessoa com restrição. O perfil escolhido é aplicado em todas as buscas de rótulo.</p></div>' +
      '<button class="btn-sm" type="button" data-act="novo-perfil">' + IC.plus + 'Novo</button></div>';
    if(!ps.length) h += '<div class="card ia-vazio"><p><b>Nenhum perfil ainda.</b></p><p class="sub">Não precisa de diagnóstico: dá para marcar uma suspeita ou preferência.</p><button class="bigbtn" type="button" data-act="novo-perfil">Criar o primeiro perfil</button></div>';
    else {
      h += '<fieldset class="card ia-lista"><legend class="sr">Perfil usado nas buscas</legend>' + ps.map(function(p){
        return '<div class="ia-perfil"><label class="ia-op"><input type="radio" name="perfil-ativo" value="' + esc(p.id) + '"' + (p.id === perfisEstado.ativo ? ' checked' : '') + '><span><b>' + esc(p.apelido) + '</b>' +
          (p.faixaEtaria ? ' · ' + esc(IA.FAIXAS[p.faixaEtaria]) : '') + '<br><small>' + esc(nomesRestricoes(p)) + '</small></span></label>' +
          '<span class="ia-acoes"><button class="link" type="button" data-act="editar-perfil" data-id="' + esc(p.id) + '">Editar<span class="sr"> ' + esc(p.apelido) + '</span></button>' +
          '<button class="link" type="button" data-act="excluir-perfil" data-id="' + esc(p.id) + '">' + (ui.armed === "xp-" + p.id ? 'Toque de novo' : 'Excluir') + '<span class="sr"> ' + esc(p.apelido) + '</span></button></span></div>';
      }).join("") + '</fieldset>';
      h += '<p class="sub">' + (perfisEstado.guardar ? 'Guardados só neste aparelho e no seu backup. Nada vai para a internet.' : 'Só nesta sessão: os perfis somem ao fechar o app. Para guardar, edite um perfil e marque "Guardar neste aparelho".') + '</p>' +
        '<div class="links"><button class="link" type="button" data-act="apagar-perfis">' + (ui.armed === "apagar-perfis" ? 'Toque de novo para apagar todos' : 'Apagar todos os perfis') + '</button></div>';
    }
    v.innerHTML = h;
  }
  function sheetPerfil(p){
    ui.sheet = {type: "perfil", id: p ? p.id : null};
    var sit = {}; (p ? p.restricoes : []).forEach(function(r){ sit[r.tipo] = r.situacao; });
    openSheet('<h3 class="sh-title" id="sh-title">' + (p ? 'Editar perfil' : 'Novo perfil') + '</h3><form class="form" id="form-perfil" novalidate>' +
      '<div class="fl"><label for="f-pa">Como quer chamar este perfil?</label><input class="inp" id="f-pa" maxlength="60" autocomplete="off" value="' + esc(p ? p.apelido : "") + '" aria-describedby="h-pa e-pa"><p class="sub" id="h-pa">Um apelido basta. Sem nome completo nem documento.</p><p class="ia-erro" id="e-pa" hidden></p></div>' +
      '<div class="fl"><label for="f-pf">Faixa etária (opcional)</label><select class="inp" id="f-pf"><option value="">Prefiro não dizer</option>' + Object.keys(IA.FAIXAS).map(function(k){ return '<option value="' + k + '"' + (p && p.faixaEtaria === k ? ' selected' : '') + '>' + esc(IA.FAIXAS[k]) + '</option>'; }).join("") + '</select></div>' +
      '<fieldset class="fl" id="f-pr" aria-describedby="h-pr e-pr"><legend>O que acompanhar?</legend><p class="sub" id="h-pr">Pode marcar mais de uma.</p>' +
      Object.keys(IA.RESTRICOES).map(function(k){ return '<label class="ia-op"><input type="checkbox" data-restr value="' + k + '"' + (sit[k] ? ' checked' : '') + '> ' + esc(IA.RESTRICOES[k].nome) + '</label>' +
        '<div class="ia-sit" id="s-' + k + '"' + (sit[k] ? '' : ' hidden') + '><label for="sel-' + k + '">Situação</label><select class="inp" id="sel-' + k + '"><option value="">Escolha</option>' +
        Object.keys(IA.SITUACOES).map(function(s){ return '<option value="' + s + '"' + (sit[k] === s ? ' selected' : '') + '>' + esc(IA.SITUACOES[s]) + '</option>'; }).join("") + '</select></div>'; }).join("") +
      '<p class="ia-erro" id="e-pr" hidden></p></fieldset><div id="ia-infos" aria-live="polite"></div>' +
      '<label class="ia-op"><input type="checkbox" id="f-pg"' + (perfisEstado.guardar ? ' checked' : '') + '> Guardar os perfis neste aparelho</label><p class="sub">Sem marcar, os perfis somem ao fechar o app.</p>' +
      '<p class="ia-erro" id="e-pg" hidden></p><div class="sh-actions"><button class="bigbtn" type="submit">Salvar perfil</button><button class="quiet" type="button" data-act="fechar">Cancelar</button></div></form>', "f-pa");
    setTimeout(atualizarFormPerfil, 0);
  }
  function dadosFormPerfil(){
    var rs = [].slice.call(sheet.querySelectorAll("[data-restr]:checked")).map(function(i){ return i.value; }), sit = {};
    rs.forEach(function(k){ sit[k] = document.getElementById("sel-" + k).value; });
    return { id: ui.sheet && ui.sheet.id || undefined, apelido: document.getElementById("f-pa").value, faixaEtaria: document.getElementById("f-pf").value || null, restricoes: rs, situacoes: sit };
  }
  function atualizarFormPerfil(){
    if(!ui.sheet || ui.sheet.type !== "perfil") return;
    var d = dadosFormPerfil();
    Object.keys(IA.RESTRICOES).forEach(function(k){ var s = document.getElementById("s-" + k); if(s) s.hidden = d.restricoes.indexOf(k) < 0; });
    var box = document.getElementById("ia-infos"); if(box) box.innerHTML = IA.infosVisiveis(d).map(function(i){ return '<p class="tip">' + esc(IA.INFOS[i]) + '</p>'; }).join("");
  }
  function salvarPerfilIA(){
    var v = IA.validarFormulario(dadosFormPerfil());
    var mostra = function(id, campo, msg){ var e = document.getElementById(id); if(e){ e.hidden = !msg; e.textContent = msg || ""; } var c = campo && document.getElementById(campo); if(c) c.setAttribute("aria-invalid", msg ? "true" : "false"); };
    mostra("e-pa", "f-pa", v.erros.apelido); mostra("e-pr", "f-pr", v.erros.restricoes || v.erros.situacoes); mostra("e-pg", null, v.erros.geral);
    if(!v.ok){ var f = v.erros.apelido ? document.getElementById("f-pa") : sheet.querySelector("[data-restr]"); if(f) f.focus(); return; }
    var antes = perfisEstado.perfis.filter(function(p){ return p.id === v.perfil.id; })[0];
    perfisEstado.perfis = perfisEstado.perfis.filter(function(p){ return p.id !== v.perfil.id; }).concat([v.perfil]);
    if(!perfisEstado.ativo) perfisEstado.ativo = v.perfil.id;
    perfisEstado.guardar = document.getElementById("f-pg").checked;
    perfisEstado.consentidoEm = perfisEstado.guardar ? (perfisEstado.consentidoEm || todayStr()) : null;
    var guardou = salvarPerfis();
    closeSheet(); render();
    toast(perfisEstado.guardar ? (guardou ? "Perfil salvo neste aparelho" : "Sem espaço para guardar o perfil") : "Perfil salvo só nesta sessão");
    gatilhosIA.disparar(antes && JSON.stringify(antes.restricoes) !== JSON.stringify(v.perfil.restricoes) ? "RESTRICAO_ALTERADA" : "PERFIL_SALVO");
  }
  function chipEstado(estado, texto){ return '<span class="ia-chip ia-' + esc(estado) + '">' + esc(texto || IA.TEXTO_ESTADO[estado]) + '</span>'; }
  function fonteTexto(f){ return esc(f.provedor) + ' · ' + esc(f.identificacao) + ' · consultado em ' + esc(f.dataVerificacao.split("-").reverse().join("/")) + (f.ficticio ? ' · <b>fictício</b>' : '') +
    (f.rascunho ? ' · <a class="link" href="' + esc(urlExternaSegura(f.urlProduto) || "https://world.openfoodfacts.org") + '" target="_blank" rel="noopener noreferrer">Dados: Open Food Facts (ODbL)</a>' : ''); }
  function avaliarProduto(p){ var pa = perfilAtivo(); return pa ? IA.analisar(pa, BUS.rotuloParaRegras(p), { hoje: todayStr() }) : null; }
  function renderRotulosIA(){
    var v = document.getElementById("view-rotulos"), pa = perfilAtivo(), r = buscaIA.resposta;
    var h = segDieta("rotulos") + '<div class="head-row"><div><h2 class="title">Rótulos</h2><p class="sub">' +
      (pa ? 'Usando o perfil <b>' + esc(pa.apelido) + '</b>. <button class="link" type="button" data-act="nav" data-view="perfis">Trocar</button>' : 'Nenhum perfil escolhido: os produtos aparecem sem avaliação. <button class="link" type="button" data-act="nav" data-view="perfis">Escolher perfil</button>') + '</p></div></div>';
    if(AMB.homologacao){
      var ft = fonteTeste();
      h += '<fieldset class="ia-fontes"><legend>Fonte de teste (só homologação)</legend>' +
        '<label class="ia-op"><input type="radio" name="fonte-teste" value="ficticio"' + (ft !== "off" ? ' checked' : '') + '> Catálogo fictício</label>' +
        '<label class="ia-op"><input type="radio" name="fonte-teste" value="off"' + (ft === "off" ? ' checked' : '') + '> Open Food Facts (real, colaborativo)</label></fieldset>';
    }
    h += Busca.ficticio ? '<p class="warnbox" role="note">Homologação: a busca usa um catálogo fictício de teste. Não são produtos reais.</p>'
      : Busca.colaborativo ? '<p class="warnbox" role="note">Homologação com Open Food Facts real. Os dados são colaborativos e entram como rascunho: sem você conferir a embalagem, o app não conclui nada favorável. Só o código ou o termo digitado saem do aparelho; o perfil nunca.</p>'
      : !Busca.fornecedor ? '<p class="warnbox" role="note">A busca de rótulos ainda não está disponível: falta uma fonte de dados aprovada. Use "Ler rótulo por foto" ou "Conferir rótulo digitado".</p>' : '';
    h += '<form class="ia-busca" id="form-busca" role="search"><label for="f-busca">Nome do produto ou código de barras</label><div class="ia-linha"><input class="inp" id="f-busca" type="search" autocomplete="off" enterkeyhint="search" value="' + esc(buscaIA.texto) + '">' +
      '<button class="btn-sm" type="submit">' + (buscaIA.rodando ? 'Buscando…' : 'Buscar') + '</button></div></form>' +
      '<div class="links"><button class="link" type="button" data-act="rotulo-digitado">Conferir rótulo digitado</button><button class="link" type="button" data-act="rotulo-foto">Ler rótulo por foto</button></div>';
    h += '<div id="ia-resultados" tabindex="-1">';
    if(r){
      h += '<h3 class="ia-h">' + (r.status === "ok" ? r.produtos.length + (r.produtos.length === 1 ? ' produto' : ' produtos') + ' para "' + esc(r.consulta.valor) + '"' : 'Resultado da busca') + '</h3>';
      r.avisos.forEach(function(a){ h += '<p class="sub">' + esc(a) + '</p>'; });
      if(r.status === "nao_encontrado") h += '<p class="card ia-vazio">Nada encontrado. Confira a embalagem ou use "Conferir rótulo digitado".</p>';
      r.produtos.forEach(function(p){
        var a = p.sugestao ? null : avaliarProduto(p), sub = [p.marca, p.quantidade, p.ean].filter(Boolean).map(esc).join(' · ');
        h += '<article class="card ia-prod"><div class="ia-topo"><div><b>' + esc(p.nome) + '</b>' + (p.fonte.rascunho ? '<span class="ia-badge">' + (p.sugestao ? 'Sugestão' : 'Rascunho') + '</span>' : '') + '<br><small>' + sub + '</small></div>' + (a ? chipEstado(a.status, a.texto) : '') + '</div>' +
          (p.sugestao ? '<p class="sub">Confirme se é o mesmo produto, sabor e tamanho da embalagem antes de ver a avaliação.</p>' : '') +
          (a ? '<ul class="ia-det">' + a.detalhes.map(function(d){ return '<li>' + esc(d.nome) + ': ' + chipEstado(d.estado, d.texto) + '</li>'; }).join("") + '</ul>' : '') +
          '<p class="ia-fonte">Fonte: ' + fonteTexto(p.fonte) + '</p><div class="links">' +
          (p.sugestao ? '<button class="link" type="button" data-act="confirmar-sugestao" data-id="' + esc(p.id) + '">É este produto (mesmo sabor e tamanho)</button>'
            : '<button class="link" type="button" data-act="ver-produto" data-id="' + esc(p.id) + '">Ver rótulo e motivos</button>' +
              (p.fonte.rascunho ? '<button class="link" type="button" data-act="conferir-produto" data-id="' + esc(p.id) + '">Conferir com a embalagem</button>' : '') +
              '<button class="link" type="button" data-act="produto-lista" data-id="' + esc(p.id) + '">Pôr na lista</button>') + '</div></article>';
      });
    }
    var confs = lerConferencias();
    if(confs.length){
      h += '<h3 class="ia-h">Rótulos conferidos neste aparelho</h3>' + confs.slice(0, 5).map(function(c){
        return '<article class="card ia-prod"><b>' + esc(c.produto) + '</b><br><small>' + esc(c.fonte && c.fonte.identificacao || "") + ' · ' + esc(String(c.quando || "").slice(0, 10).split("-").reverse().join("/")) + ' · motor ' + esc(c.versaoMotor) + '</small>' +
          '<div class="links"><button class="link" type="button" data-act="reanalisar" data-id="' + esc(c.id) + '">Analisar com o perfil escolhido</button></div></article>';
      }).join("") + '<div class="links"><button class="link" type="button" data-act="apagar-conferencias">' + (ui.armed === "apagar-conferencias" ? 'Toque de novo para apagar' : 'Apagar rótulos conferidos') + '</button></div>';
    }
    h += '</div><p class="aviso-fixo" role="note">O app não diz que um alimento é seguro. Confira sempre a embalagem atual e a orientação profissional. Motor ' + esc(IA.VERSAO_MOTOR) + '.</p>';
    v.innerHTML = h;
  }
  function executarBusca(texto){
    buscaIA.texto = texto; buscaIA.rodando = true; render();
    BUS.consultar(Busca, texto).then(function(r){
      buscaIA.resposta = r; buscaIA.rodando = false; render();
      var alvo = document.getElementById("ia-resultados"); if(alvo) alvo.focus();
    });
  }
  function produtoDaBusca(id){ var r = buscaIA.resposta; return r && r.produtos.filter(function(p){ return p.id === id; })[0]; }
  function blocoAnalise(a){
    var f = a.fonte || {};
    return '<div class="dbox"><b>Resultado: ' + esc(a.texto) + '</b>' + a.detalhes.map(function(d){ return '<span><b>' + esc(d.nome) + ':</b> ' + esc(d.texto) + '. ' + esc(d.motivos.join(" ")) + (d.trechos.length ? ' Achado: ' + esc(d.trechos.join(", ")) + '.' : '') + '</span>'; }).join("") +
      (a.rascunho ? '<span class="ia-duv">Rascunho: confira a embalagem. Sem essa conferência o app não conclui nada favorável.</span>' : '') +
      '<span class="sub">' + esc(a.aviso) + '</span>' +
      '<span class="ia-ev">Fonte: ' + esc(f.identificacao || "não informada") + (f.dataVerificacao ? ' · ' + esc(f.dataVerificacao.split("-").reverse().join("/")) : '') + ' · motor ' + esc(a.versaoMotor) + ' · política ' + esc(a.versaoPolitica) + ' · evidência ' + esc(a.evidencia) + '</span></div>';
  }
  function sheetProduto(p){
    ui.sheet = {type: "produto-ia", id: p.id};
    var r = p.rotulo, a = avaliarProduto(p), dec = {contem: "contém glúten", nao_contem: "não contém glúten", nao_informado: "não informado", contraditorio: "contraditório"},
      lac = {contem_lactose: "contém lactose", sem_lactose: "sem lactose", nao_informado: "não informado", contraditorio: "contraditório"};
    openSheet('<h3 class="sh-title" id="sh-title">' + esc(p.nome) + '</h3><p class="sh-sub">Fonte: ' + fonteTexto(p.fonte) + '</p>' +
      (a ? blocoAnalise(a) : '<p class="tip">Escolha um perfil para ver a avaliação.</p>') +
      '<dl class="ia-dl"><dt>Ingredientes</dt><dd>' + esc([].concat(r.ingredientes || []).join(", ") || "não informado") + (r.ingredientesCompletos ? '' : ' <b>(lista incompleta)</b>') + '</dd>' +
      '<dt>Alérgicos: contém</dt><dd>' + esc(r.advertencias && r.advertencias.contem || "nada declarado") + '</dd><dt>Pode conter</dt><dd>' + esc(r.advertencias && r.advertencias.podeConter || "nada declarado") + '</dd>' +
      '<dt>Glúten</dt><dd>' + esc(dec[r.declaracaoGluten] || "não informado") + '</dd><dt>Lactose</dt><dd>' + esc(lac[r.declaracaoLactose] || "não informado") + '</dd></dl>' +
      '<div class="sh-actions">' + (p.fonte.rascunho ? '<button class="bigbtn" type="button" data-act="conferir-produto" data-id="' + esc(p.id) + '">Conferir com a embalagem</button>' : '') +
      '<button class="' + (p.fonte.rascunho ? 'quiet' : 'bigbtn') + '" type="button" data-act="produto-lista" data-id="' + esc(p.id) + '">Pôr na lista</button><button class="quiet" type="button" data-act="fechar">Fechar</button></div>');
  }
  function produtoNaLista(p){
    var n = DietaMotor.normalizar(p.nome), it = state.items.filter(function(x){ return DietaMotor.normalizar(x.nome) === n; })[0];
    if(!it){ it = {id: uid(), cat: "Outros", nome: p.nome, por: "unidade", hist: [], nota: p.ean ? "Código de barras " + p.ean : "", basico: false, lista: false, qtd: 1, ok: false, icon: ""}; state.items.push(it); }
    it.lista = true; it.ok = false; save(); closeSheet(); render(); toast("Na lista: " + p.nome);
  }
  /* Conferência de rótulo: digitado, lido na foto (rascunho) ou rascunho do Open Food Facts.
     Foto e OFF exigem marcar "conferi com a embalagem"; sem isso não há análise. */
  function sheetRotuloDigitado(pre){
    pre = pre || null;
    ui.sheet = {type: "rotulo-digitado", pre: pre};
    var r = pre ? pre.rotulo : {}, sel = function(v, atual){ return v === atual ? ' selected' : ''; },
      titulo = !pre ? "Conferir rótulo digitado" : pre.origem === "foto" ? "Conferir texto lido na foto" : "Conferir rascunho do Open Food Facts",
      sub = !pre ? 'Copie da embalagem. Sem marcar que copiou tudo, o resultado fica "informação insuficiente".'
        : 'Compare cada campo com a embalagem na sua mão e corrija o que estiver errado. Sem essa conferência não há análise.';
    var gl = r.declaracaoGluten || "nao_informado", lac = r.declaracaoLactose || "nao_informado";
    openSheet('<h3 class="sh-title" id="sh-title">' + titulo + '</h3><p class="sh-sub">' + sub + '</p>' +
      (pre && pre.foto ? '<figure class="rotulo-prova"><div id="imagem-conferida"></div><figcaption>' +
        (pre.linhas.length ? 'Linhas para conferir na embalagem' : 'Foto original para comparar com o texto lido') + '</figcaption></figure>' +
        '<details class="ocr-texto"><summary>Ver transcrição da foto</summary><p>' + esc(pre.texto) + '</p></details>' +
        (window.speechSynthesis ? '<button class="btn-sm" type="button" data-act="ouvir-rotulo">Ouvir texto lido</button>' : '') : '') +
      (pre && pre.avisos && pre.avisos.length ? pre.avisos.map(function(a){ return '<p class="ia-duv">' + esc(a) + '</p>'; }).join("") : '') +
      (pre && pre.duvidosas && pre.duvidosas.length ? '<p class="ia-duv">Há palavras com leitura incerta. Compare os campos abaixo com a embalagem.</p>' : '') +
      '<form class="form" id="form-rd" novalidate>' +
      '<fieldset class="rd-grupo"><legend>Produto e ingredientes</legend><div class="fl"><label for="rd-nome">Nome do produto</label><input class="inp" id="rd-nome" autocomplete="off" value="' + esc(pre && pre.nome || r.nome || "") + '"></div>' +
      '<div class="fl"><label for="rd-ing">Ingredientes (separados por vírgula)</label><textarea class="inp" rows="4" id="rd-ing">' + esc([].concat(r.ingredientes || []).join(", ")) + '</textarea></div>' +
      '</fieldset><fieldset class="rd-grupo"><legend>Avisos da embalagem</legend><div class="fl"><label for="rd-contem">Alérgicos: contém</label><textarea class="inp" id="rd-contem">' + esc(r.advertencias && r.advertencias.contem || "") + '</textarea></div>' +
      '<div class="fl"><label for="rd-pode">Pode conter</label><textarea class="inp" id="rd-pode">' + esc(r.advertencias && r.advertencias.podeConter || "") + '</textarea></div>' +
      '<div class="fl"><label for="rd-gl">Glúten</label><select class="inp" id="rd-gl"><option value="nao_informado"' + sel("nao_informado", gl) + '>Não achei na embalagem</option><option value="contem"' + sel("contem", gl) + '>Contém glúten</option><option value="nao_contem"' + sel("nao_contem", gl) + '>Não contém glúten</option><option value="contraditorio"' + sel("contraditorio", gl) + '>A embalagem se contradiz</option></select></div>' +
      '<div class="fl"><label for="rd-lac">Lactose</label><select class="inp" id="rd-lac"><option value="nao_informado"' + sel("nao_informado", lac) + '>Não achei na embalagem</option><option value="contem_lactose"' + sel("contem_lactose", lac) + '>Contém lactose</option><option value="sem_lactose"' + sel("sem_lactose", lac) + '>Sem lactose</option><option value="contraditorio"' + sel("contraditorio", lac) + '>A embalagem se contradiz</option></select></div>' +
      '</fieldset><fieldset class="rd-grupo"><legend>Conferência final</legend><label class="ia-op"><input type="checkbox" id="rd-form"> É fórmula infantil</label>' +
      (pre ? '<label class="ia-op"><input type="checkbox" id="rd-ok0"> Conferi este texto com a embalagem na minha mão</label>' : '') +
      '<label class="ia-op"><input type="checkbox" id="rd-ok1"> ' + (pre ? 'A lista de ingredientes está completa' : 'Copiei a lista inteira de ingredientes') + '</label>' +
      '<label class="ia-op"><input type="checkbox" id="rd-ok2"> ' + (pre ? 'O bloco ALÉRGICOS e a declaração de glúten estão completos' : 'Copiei todos os avisos de alérgicos') + '</label>' +
      '</fieldset><div id="rd-res" aria-live="polite" tabindex="-1"></div><div class="sh-actions"><button class="bigbtn" type="submit">Analisar com o perfil escolhido</button><button class="quiet" type="button" data-act="fechar">Fechar</button></div></form>', pre && pre.foto ? null : "rd-nome");
    if(pre && pre.foto){
      pre.foto.setAttribute("role","img"); pre.foto.setAttribute("aria-label","Foto da embalagem para conferência visual");
      document.getElementById("imagem-conferida").appendChild(pre.foto);
    }
  }
  function ouvirRotulo(){
    var sessao=ui.sheet, campo=sessao && sessao.pre;
    if(!campo || !campo.texto || !window.speechSynthesis) return;
    if(sessao.falando){speechSynthesis.cancel(); sessao.falando=false; return;}
    var voz=speechSynthesis.getVoices().find(function(v){return v.localService && /^pt(?:-|_)/i.test(v.lang);});
    if(!voz){ toast("Sem voz em português instalada. Abra a transcrição da foto.",3500); return; }
    var fala=new SpeechSynthesisUtterance(campo.texto); fala.voice=voz; fala.lang=voz.lang;
    var botao=sheet.querySelector('[data-act="ouvir-rotulo"]');
    fala.onend=fala.onerror=function(){sessao.falando=false; botao.textContent="Ouvir texto lido";};
    sessao.falando=true; botao.textContent="Parar leitura"; speechSynthesis.speak(fala);
  }
  function analisarDigitado(){
    var pa = perfilAtivo(), out = document.getElementById("rd-res"), g = function(id){ return document.getElementById(id); }, pre = ui.sheet && ui.sheet.pre;
    if(!pa){ out.innerHTML = '<p class="ia-erro">Crie ou escolha um perfil antes.</p>'; out.focus(); return; }
    var campos = { nome: g("rd-nome").value, ingredientes: g("rd-ing").value, contem: g("rd-contem").value, podeConter: g("rd-pode").value, declaracaoGluten: g("rd-gl").value, declaracaoLactose: g("rd-lac").value },
      marcas = { textoConferido: pre ? g("rd-ok0").checked : true, ingredientesCompletos: g("rd-ok1").checked, advertenciasCompletas: g("rd-ok2").checked }, rot;
    if(pre){
      var c = OCR.confirmar(pre.rotulo, campos, marcas, todayStr());
      if(!c.ok){ out.innerHTML = '<p class="ia-erro">' + esc(c.erros.join(" ")) + '</p>'; out.focus(); return; }
      rot = c.rotulo;
      if(pre.origem === "off") rot.fonte = { identificacao: "Rascunho do Open Food Facts (" + (pre.ean || "") + ") conferido por você na embalagem", dataVerificacao: todayStr() };
      if(pre.ean) rot.ean = pre.ean;
    } else {
      rot = { nome: campos.nome.trim(), ingredientes: campos.ingredientes.split(/[,;\n]/).map(function(x){ return x.trim(); }).filter(Boolean),
        advertencias: { contem: campos.contem, podeConter: campos.podeConter }, declaracaoGluten: campos.declaracaoGluten, declaracaoLactose: campos.declaracaoLactose,
        ingredientesCompletos: marcas.ingredientesCompletos, advertenciasCompletas: marcas.advertenciasCompletas, fonte: { identificacao: "Embalagem conferida por você", dataVerificacao: todayStr() } };
    }
    rot.categoria = g("rd-form").checked ? "formula_infantil" : "alimento";
    var a = IA.analisar(pa, rot, { hoje: todayStr() });
    if(a.status !== "INVALIDO") guardarConferencia(rot, a);
    out.innerHTML = a.status === "INVALIDO" ? '<p class="ia-erro">' + esc(a.erros.join(" ")) + '</p>' : blocoAnalise(a);
    out.focus();
  }
  /* Rótulos conferidos ficam só neste aparelho: texto do rótulo, fonte, data e versões. Nada do perfil. */
  function lerConferencias(){ try{ var l = JSON.parse(localStorage.getItem(CONF_KEY) || "[]"); return Array.isArray(l) ? l : []; }catch(e){ return []; } }
  function guardarConferencia(rot, a){
    var l = lerConferencias().filter(function(c){ return c.evidencia !== a.evidencia; });
    l.unshift({ id: uid(), quando: a.carimbo, produto: rot.nome || "Produto sem nome", ean: rot.ean || null, rotulo: rot, fonte: a.fonte, evidencia: a.evidencia, versaoMotor: a.versaoMotor, versaoPolitica: a.versaoPolitica });
    try{ localStorage.setItem(CONF_KEY, JSON.stringify(l.slice(0, 30))); }catch(e){}
  }
  function reanalisar(id){
    var c = lerConferencias().filter(function(x){ return x.id === id; })[0], pa = perfilAtivo(); if(!c) return;
    var a = pa ? IA.analisar(pa, c.rotulo, { hoje: todayStr() }) : null;
    ui.sheet = {type: "conferencia", id: id};
    openSheet('<h3 class="sh-title" id="sh-title">' + esc(c.produto) + '</h3><p class="sh-sub">Conferido em ' + esc(String(c.quando).slice(0, 10).split("-").reverse().join("/")) + ' (motor ' + esc(c.versaoMotor) + ').' +
      (a && a.versaoMotor !== c.versaoMotor ? ' As regras mudaram desde então: esta é a análise com as regras atuais.' : '') + '</p>' +
      (a ? blocoAnalise(a) : '<p class="tip">Escolha um perfil para ver a avaliação.</p>') + '<div class="sh-actions"><button class="quiet" type="button" data-act="fechar">Fechar</button></div>');
  }
  /* Foto do rótulo: lida aqui mesmo, sem enviar a imagem. Ilegível = INFORMAÇÃO INSUFICIENTE. */
  function sheetFoto(){
    ui.sheet = {type: "foto"};
    openSheet('<h3 class="sh-title" id="sh-title">Ler rótulo por foto</h3><p class="sh-sub">Fotografe de perto, com luz e sem reflexo, a lista de ingredientes junto com o bloco ALÉRGICOS. A foto é lida neste aparelho e não é enviada a ninguém nem guardada. Depois você confere o texto antes da análise.</p>' +
      '<input type="file" id="ocr-foto" accept="image/*" hidden>' +
      '<div id="ocr-status" role="status" aria-live="polite"></div>' +
      '<div class="sh-actions"><button class="bigbtn" type="button" data-act="ocr-escolher">Tirar ou escolher foto</button><button class="quiet" type="button" data-act="fechar">Fechar</button></div>');
  }
  function lerFoto(file){
    var st = document.getElementById("ocr-status"); if(!st || !ui.sheet || ui.sheet.type !== "foto") return;
    if(ui.sheet.lendo) return;
    var sessao=ui.sheet, perfil=perfilAtivo();
    function destacarLinha(texto){
      if(/ingredientes|al[eé]rgicos|cont[eéê]m|pode conter/i.test(texto)) return true;
      return !!perfil && perfil.restricoes.some(function(r){
        var grupo=IA.RESTRICOES[r.tipo].grupo;
        return grupo ? IA.encontrar(texto,grupo).length > 0 : r.tipo === "lactose" && /lactose/i.test(texto);
      });
    }
    ui.sheet.lendo = true;
    st.innerHTML = '<p class="sub">Preparando o leitor de rótulos… Na primeira vez ele baixa cerca de 5 MB; depois funciona sem internet.</p>';
    OCR.lerImagem(file, { base: "./vendor/ocr/", hoje: todayStr(), destacarLinha:destacarLinha, etapa: function(i, n){ if(ui.sheet !== sessao) return; var e = document.getElementById("ocr-status"); if(e) e.innerHTML = '<p class="sub">Lendo a foto (tentativa ' + i + ' de ' + n + ')…</p>'; } }).then(function(r){
      if(ui.sheet !== sessao) return;
      ui.sheet.lendo = false;
      if(r.status === OCR.STATUS.OK){ sheetRotuloDigitado({ origem: "foto", foto:r.foto, linhas:r.linhas || [], texto:r.transcricao || r.textoLido, rotulo: r.rotulo, avisos: r.avisos, duvidosas: r.palavrasDuvidosas }); return; }
      var e = document.getElementById("ocr-status"); if(!e) return;
      e.innerHTML = '<div>' + chipEstado("INFORMACAO_INSUFICIENTE") + '</div>' + r.motivos.map(function(m){ return '<p class="ia-erro">' + esc(m) + '</p>'; }).join("") +
        '<p class="sub">O app não analisa uma foto que não conseguiu ler direito. Tire outra ou digite o rótulo.</p><div class="links"><button class="link" type="button" data-act="rotulo-digitado">Digitar o rótulo</button><button type="button" class="link" data-act="nova-duvida" data-motivo="rotulo">Levar dúvida à consulta</button></div>';
      var repetir = sheet.querySelector('[data-act="ocr-escolher"]');
      if(repetir) repetir.textContent = "Tirar outra foto";
      e.setAttribute("tabindex", "-1"); e.focus();
    });
  }

  function render(){
    if(ui.view === "inicio") renderInicio();
    else if(ui.view === "precos") renderPrecos();
    else if(ui.view === "lista") renderLista();
    else if(ui.view === "rotulo") renderDieta();
    else if(ui.view === "ofertas") renderOfertas();
    else if(ui.view === "perfis") renderPerfisIA();
    else if(ui.view === "rotulos") renderRotulosIA();
    syncPill();
  }
  function show(v, fromHash){
    if(VIEWS.indexOf(v) < 0) v = "inicio";
    ui.view = v; ui.armed = null;
    VIEWS.forEach(function(x){
      document.getElementById("view-" + x).classList.toggle("on", x === v);
      var t = document.getElementById("tab-" + x), dieta = x === "rotulo" && (v === "perfis" || v === "rotulos");
      if(t){ if(x === v || dieta) t.setAttribute("aria-current","page"); else t.removeAttribute("aria-current"); }
    });
    render();
    if(!fromHash){ try{ history.replaceState(null, "", "#" + v); }catch(e){} }
    window.scrollTo(0,0);
  }
  function arm(key, btn, label){
    if(ui.armed === key) return true;
    ui.armed = key;
    if(btn){ btn.classList.add("armed"); btn.textContent = label; }
    setTimeout(function(){ if(ui.armed === key){ ui.armed = null; if(btn && btn.isConnected){ btn.classList.remove("armed"); btn.textContent = btn.dataset.orig || btn.textContent; } } }, 3500);
    return false;
  }

  /* ---------- Eventos ---------- */
  document.addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest("[data-act]") : null;
    if(!b) return;
    var act = b.dataset.act, id = b.dataset.id, it;
    try {
      switch(act){
      case "consulta": abrirConsulta(); break;
      case "nova-duvida": novaDuvida(b.dataset.motivo); break;
      case "ver-duvida": abrirDuvida(id); break;
      case "mensagem-consulta": mensagemConsulta(); break;
      case "excluir-duvida":
        if(ui.sheet && arm("excluir-duvida-"+ui.sheet.id,b,"Toque novamente para excluir")){
          try{localStorage.removeItem(CONSULTA_KEY+ui.sheet.id); abrirConsulta();}
          catch(erro){toast("Não foi possível excluir a anotação.");}
        } break;
      case "delegar": abrirCompraDelegada(); break;
      case "incluir-prato":
        var pedido=document.getElementById("pedido-compra"), pratoSalvo=jantarSalvo();
        if(pedido && pratoSalvo){ pedido.value=pratoSalvo.nome+"\n"+pedido.value; b.hidden=true; } break;
      case "enviar-pedido": enviarPedido(); break;
      case "comparar-custo": compararCusto(); break;
      case "jantar": abrirJantar(); break;
      case "editar-jantar": editarJantar(); break;
      case "comprar-jantar": comprarJantar(); break;
      case "nav": show(b.dataset.view); break;
      case "novo-perfil": sheetPerfil(null); break;
      case "editar-perfil": sheetPerfil(perfisEstado.perfis.filter(function(p){ return p.id === id; })[0] || null); break;
      case "excluir-perfil":
        if(ui.armed !== "xp-" + id){ ui.armed = "xp-" + id; render(); break; }
        ui.armed = null; perfisEstado = Object.assign(IA.excluirPerfil(perfisEstado, id), { guardar: perfisEstado.guardar, consentidoEm: perfisEstado.consentidoEm });
        salvarPerfis(); gatilhosIA.disparar("PERFIL_EXCLUIDO", { id: id }); toast("Perfil excluído"); break;
      case "apagar-perfis":
        if(ui.armed !== "apagar-perfis"){ ui.armed = "apagar-perfis"; render(); break; }
        ui.armed = null; perfisEstado = Perfis.excluirTudo(); render(); toast("Perfis apagados deste aparelho"); break;
      case "ver-produto": var pv = produtoDaBusca(id); if(pv) sheetProduto(pv); break;
      case "produto-lista": var pl = produtoDaBusca(id); if(pl) produtoNaLista(pl); break;
      case "rotulo-digitado": sheetRotuloDigitado(); break;
      case "rotulo-foto": sheetFoto(); break;
      case "ouvir-rotulo": ouvirRotulo(); break;
      case "ocr-escolher": var fi = document.getElementById("ocr-foto"); if(fi){ fi.value = ""; fi.click(); } break;
      case "confirmar-sugestao": var ps = produtoDaBusca(id); if(ps && ps.ean){ buscaIA.rodando = true; render(); Busca.porCodigo(ps.ean).then(function(r){ buscaIA.rodando = false; buscaIA.resposta = r; render(); var al = document.getElementById("ia-resultados"); if(al) al.focus(); }); } break;
      case "conferir-produto": var pc = produtoDaBusca(id); if(pc) sheetRotuloDigitado({ origem: "off", rotulo: pc.rotulo, nome: pc.nome, ean: pc.ean, avisos: ["Dados colaborativos do Open Food Facts: podem estar errados, incompletos ou ser de uma embalagem antiga."] }); break;
      case "reanalisar": reanalisar(id); break;
      case "apagar-conferencias":
        if(ui.armed !== "apagar-conferencias"){ ui.armed = "apagar-conferencias"; render(); break; }
        ui.armed = null; try{ localStorage.removeItem(CONF_KEY); }catch(err){} render(); toast("Rótulos conferidos apagados deste aparelho"); break;
      case "fechar": closeSheet(); break;
      case "fechar-dica": state.dica = false; save(); renderInicio(); break;
      case "fechar-ios": state.dicaIos = false; save(); renderInicio(); break;
      case "ver-carta": showWelcome(); break;
      case "colar-import": sheetColar(); break;
      case "ler-import":
        var rawImp = document.getElementById("f-import").value;
        var ci = parseCasa(rawImp);
        if(ci){ if(!syncDisponivel()){ toast("O tempo real ainda não está ligado neste app"); break; } sheetEntrar(ci); break; }
        var oi = parseImport(rawImp);
        if(oi){ sheetImport(oi); break; }
        var oo = parseOfertasCode(rawImp);
        if(oo){ sheetOfertasImport(oo); break; }
        toast("Código inválido. Copie a mensagem inteira"); break;
      case "confirmar-ofertas": confirmOfertas(); break;
      case "criar-casa": sheetCriarCasa(); break;
      case "confirmar-casa":
        var cn = document.getElementById("c-nome").value.trim(), ce = document.getElementById("c-eu").value.trim();
        if(!cn){ toast("Dê um nome pra casa"); document.getElementById("c-nome").focus(); break; }
        if(!ce){ toast("Digite seu nome"); document.getElementById("c-eu").focus(); break; }
        criarCasa(cn, ce); break;
      case "confirmar-entrar":
        var en = document.getElementById("e-eu").value.trim();
        if(!en){ toast("Digite seu nome"); document.getElementById("e-eu").focus(); break; }
        entrarCasa(ui.sheet.id, en); break;
      case "casa": sheetCasa(); break;
      case "convidar": sheetConvite(false); break;
      case "copiar-convite": copy(conviteTexto(), null); break;
      case "sair-casa":
        b.dataset.orig = "Sair da casa neste celular";
        if(!arm("sair", b, "Toque de novo para sair")) break;
        sairCasa(); closeSheet(); toast("Tempo real desligado neste celular"); break;
      case "oferta-lista": addOfertaToList(b.dataset.oid); break;
      case "aviso-lido":
        state.avisosLidos = (state.avisosLidos || []).concat([id]).slice(-30); save(); render(); break;
      case "confirmar-import": confirmImport(); break;
      case "fechar-carta":
        state.cartaVista = true; save();
        var wl = document.getElementById("welcome"); wl.hidden = true; wl.innerHTML = ""; document.body.style.overflow = "";
        show("inicio"); break;
      case "instalar":
        if(installEvt){ try{ installEvt.prompt(); installEvt.userChoice.then(function(){ installEvt = null; renderInicio(); }, function(){}); }catch(err){} }
        break;
      case "novo-gasto": sheetGasto(null); break;
      case "editar-gasto":
        var m = mesData(state.mes, false), g = null;
        m.gastos.forEach(function(x){ if(x.id === id) g = x; });
        if(g) sheetGasto(g);
        break;
      case "salvar-gasto": salvarGasto(); break;
      case "apagar-gasto":
        b.dataset.orig = "Apagar este gasto";
        if(!arm("gasto", b, "Toque de novo para apagar")) break;
        var mm = mesData(ui.sheet.mes, true);
        mm.gastos = mm.gastos.filter(function(x){ return x.id !== ui.sheet.id; });
        save(); closeSheet(); render(); toast("Gasto apagado"); break;
      case "pick":
        var g2 = b.dataset.g;
        b.parentNode.querySelectorAll(".chip").forEach(function(c){ c.classList.remove("on"); c.setAttribute("aria-checked","false"); });
        b.classList.add("on"); b.setAttribute("aria-checked","true");
        document.getElementById(g2).value = b.dataset.v;
        if(g2 === "n-cat") novoPreview();
        break;
      case "set-local": document.getElementById("f-local").value = b.dataset.v; break;
      case "set-mercado": document.getElementById("f-mercado").value = b.dataset.v; break;
      case "set-por": var np = document.getElementById("n-por"); np.value = b.dataset.v; np.focus(); break;
      case "mes-ant": state.mes = shiftMonth(state.mes, -1); save(); renderInicio(); break;
      case "mes-prox": state.mes = shiftMonth(state.mes, 1); save(); renderInicio(); break;
      case "ir-mes": state.mes = b.dataset.k; save(); renderInicio(); window.scrollTo(0,0); break;
      case "orcamento": sheetOrcamento(); break;
      case "salvar-orc":
        var o = parseMoney(document.getElementById("f-orc").value);
        if(o === null){ toast("Digite o valor"); break; }
        mesData(state.mes, true).orc = o; save(); closeSheet(); renderInicio(); toast("Orçamento salvo"); break;
      case "filtro": ui.filtro = b.dataset.v; renderPrecos(); break;
      case "item": it = findItem(id); if(it) sheetItem(it); break;
      case "salvar-preco": salvarPreco(); break;
      case "toggle-lista":
        it = findItem(ui.sheet.id); if(!it) break;
        it.lista = !it.lista; if(!it.lista){ it.ok = false; it.qtd = 1; delete it.oferta; }
        save(); closeSheet(); render(); toast(it.lista ? (dietFlag(it) ? "Na lista, mas tem termo da dieta: evitar" : "Foi pra lista") : "Saiu da lista"); break;
      case "apagar-item":
        b.dataset.orig = "Apagar item";
        if(!arm("item", b, "Toque de novo para apagar")) break;
        state.items = state.items.filter(function(x){ return x.id !== ui.sheet.id; });
        if(fotos[ui.sheet.id]){ delete fotos[ui.sheet.id]; saveFotos(); }
        save(); closeSheet(); render(); toast("Item apagado"); break;
      case "novo-item": sheetNovoItem(); break;
      case "set-icone":
        if(ui.sheet && ui.sheet.type === "novo"){ ui.sheet.icon = b.dataset.v; novoPreview(); }
        else if(ui.sheet && ui.sheet.type === "item"){ it = findItem(ui.sheet.id); if(it){ it.icon = b.dataset.v; if(fotos[it.id]){ delete fotos[it.id]; saveFotos(); var rb = sheet.querySelector('[data-act="remover-foto"]'); if(rb) rb.remove(); } save(); itemPreview(it); render(); } }
        break;
      case "remover-foto":
        if(ui.sheet && ui.sheet.type === "item"){ delete fotos[ui.sheet.id]; saveFotos(); it = findItem(ui.sheet.id); if(it) itemPreview(it); b.remove(); render(); toast("Foto removida"); }
        break;
      case "editar-dieta": sheetDieta(); break;
      case "salvar-dieta": salvarDieta(); break;
      case "usar-modelo": usarModelo(); break;
      case "nova-dieta": sheetDieta({ativa: true, nome: "", modelo: null, evitar: [], pode: [], cuidados: [], obs: "", revisao: ""}); break;
      case "dieta-anterior":
        b.dataset.orig = "Voltar à lista da versão anterior do app";
        if(!arm("dieta", b, "Toque de novo para voltar à lista anterior")) break;
        var an = state.dieta && state.dieta.anterior;
        if(an){ state.dieta = {ativa: !!an.ativa, nome: an.nome || "Dieta", modelo: null, evitar: an.evitar || [], pode: an.pode || [], cuidados: an.cuidados || [], obs: an.obs || "", revisao: an.revisao || "", anterior: an}; save(); }
        closeSheet(); render(); toast("Lista anterior de volta"); break;
      case "conferir":
        it = findItem(id);
        if(it){ var tinha = DietaMotor.avaliar(it, state.dieta).avisoAnterior; delete it.ev; it.conf = tinha ? null : DietaMotor.conferir(it, Sync.casa && Sync.casa.eu || "", todayStr()); if(!it.conf) delete it.conf; save(); sheetItem(it); render(); toast(tinha ? "Anotado. Agora o item segue a regra normal" : "Conferência anotada"); }
        break;
      case "desconferir":
        it = findItem(id);
        if(it){ delete it.conf; save(); sheetItem(it); render(); toast("Conferência desfeita"); }
        break;
      case "salvar-item": salvarItem(); break;
      case "ok": it = findItem(id); if(it){ it.ok = !it.ok; save(); renderLista(); } break;
      case "mais": it = findItem(id); if(it){ it.qtd = Math.round((it.qtd + (isKg(it) ? 0.5 : 1)) * 10) / 10; save(); renderLista(); } break;
      case "menos": it = findItem(id); if(it){ var step = isKg(it) ? 0.5 : 1; if(it.qtd > step){ it.qtd = Math.round((it.qtd - step) * 10) / 10; save(); renderLista(); } } break;
      case "basico":
        state.items.forEach(function(x){ if(x.basico){ x.lista = true; x.ok = false; x.qtd = isKg(x) ? 1 : 1; } });
        save(); renderLista(); toast("Básico adicionado"); break;
      case "finalizar": sheetFinalizar(); break;
      case "confirmar-compra": confirmarCompra(); break;
      case "limpar":
        if(ui.armed !== "limpar"){ ui.armed = "limpar"; renderLista(); setTimeout(function(){ if(ui.armed === "limpar"){ ui.armed = null; if(ui.view === "lista") renderLista(); } }, 3500); break; }
        state.items.forEach(function(x){ x.lista = false; x.ok = false; x.qtd = 1; delete x.oferta; });
        ui.armed = null; save(); renderLista(); toast("Lista limpa"); break;
      case "backup": sheetBackup(); break;
      case "hml-dados":
        if(!AMB.dadosDeTeste) break;
        if(ui.armed !== "hml-dados"){ ui.armed = "hml-dados"; toast("Toque de novo para trocar tudo pelos dados de teste"); break; }
        ui.armed = null; state = dadosDeTeste(); fotos = {}; saveFotos(); save(); show("inicio"); toast("Dados de teste carregados"); break;
      case "salvar-backup": salvarArquivoBackup(); break;
      case "copiar-backup": toast("Exportação sem criptografia desativada. Use o arquivo protegido por senha."); break;
      case "aplicar-restaurar": if(ui.sheet && ui.sheet.backup) aplicarRestauracao(ui.sheet.backup); break;
      case "desfazer-restaurar": desfazerRestauracao(); break;
      case "restaurar": sheetRestaurar(); break;
      case "confirmar-restaurar": var colado=(document.getElementById("f-restaurar") || {}).value || ""; previaRestaurar(colado.trim() || (ui.sheet && ui.sheet.arquivoBackupTexto) || ""); break;
      }
    } catch(err) {
      /* Não deixar um botão parecer sem resposta se algum estado local estiver inválido.
         Não registrar conteúdo de gastos, perfis ou rótulos no diagnóstico. */
      try{ console.error("Elida: ação não concluída", String(act || "indefinida")); }catch(e){}
      toast("Esta ação não pôde ser concluída. Confira os dados ou atualize o aplicativo.", 4200);
    }
  });
  document.addEventListener("input", function(e){
    if(e.target.id === "busca"){ ui.busca = e.target.value; renderPrecosLista(); }
    if(e.target.id === "n-nome"){ novoPreview(); }
    if(e.target.id === "n-nome"){
      var f = dietFlag(e.target.value), box = document.getElementById("n-flag");
      if(box){ if(f){ box.hidden = false; box.textContent = "Evitar: tem “" + f + "”, que está na lista da dieta. " + DietaMotor.AVISO_CURTO; } else { box.hidden = true; } }
    }
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && ui.sheet){ closeSheet(); }
    if(e.key === "Enter" && ui.sheet && ui.sheet.type !== "editar-jantar" && ui.sheet.type !== "custo" && ui.sheet.type !== "duvida-form" && e.target.tagName === "INPUT" && e.target.type !== "search"){
      e.preventDefault();
      var map = {gasto:"salvar-gasto", item:"salvar-preco", novo:"salvar-item", finalizar:"confirmar-compra", orc:"salvar-orc", dieta:"salvar-dieta", "criar-casa":"confirmar-casa", entrar:"confirmar-entrar"};
      var act = map[ui.sheet.type]; if(act){ var btn = sheet.querySelector('[data-act="' + act + '"]'); if(btn) btn.click(); }
    }
  });
  document.addEventListener("submit", function(e){
    var f = e.target;
    if(f.id === "form-duvida"){
      e.preventDefault();
      var item=f.elements.item.value.trim(), pergunta=f.elements.pergunta.value.trim(), motivo=f.elements.motivo.value;
      if(!item || !pergunta || !Object.hasOwn(motivosConsulta,motivo)){toast("Informe o produto e a pergunta.");return;}
      var registro={id:uid(),quando:Date.now(),item:item,pergunta:pergunta,motivo:motivo,resposta:""};
      if(gravarConsulta(registro)) abrirDuvida(registro.id);
    }
    else if(f.id === "form-combinado"){
      e.preventDefault();
      var anotacao=lerConsulta().find(function(r){return r.id===ui.sheet.id;});
      if(!anotacao){abrirConsulta();return;}
      anotacao.resposta=f.elements.resposta.value.trim();
      if(!anotacao.resposta){toast("Escreva o combinado.");return;}
      if(gravarConsulta(anotacao)) abrirConsulta();
    }
    else if(f.id === "form-custo"){ e.preventDefault(); calcularCustos(f); }
    else if(f.id === "form-jantar"){ e.preventDefault(); salvarJantar(f); }
    else if(f.id === "form-busca"){
      e.preventDefault(); var q = document.getElementById("f-busca").value;
      var g = gatilhosIA.disparar(/^[\d\s.-]{8,}$/.test(q.trim()) ? "CODIGO_LIDO" : "PESQUISA_SOLICITADA", { origem: "usuario", texto: q });
      /* Sem fonte aprovada a busca não sai do aparelho, mas a pessoa recebe a resposta "indisponível". */
      if(g.resultado !== "executado" && !Busca.fornecedor) executarBusca(q);
    }
    else if(f.id === "form-perfil"){ e.preventDefault(); salvarPerfilIA(); }
    else if(f.id === "form-rd"){ e.preventDefault(); analisarDigitado(); }
  });
  document.addEventListener("change", function(e){
    if(e.target.name === "motivo" && e.target.form && e.target.form.id==="form-duvida"){
      var pergunta=e.target.form.elements.pergunta;
      if(!pergunta.value.trim() || Object.values(motivosConsulta).some(function(m){return pergunta.value===m[1];}))
        pergunta.value=motivosConsulta[e.target.value][1];
      return;
    }
    if(e.target.name === "tenho-ingrediente"){ atualizarJantar(); return; }
    if(e.target.name === "fonte-teste" && AMB.homologacao){
      try{ localStorage.setItem(FONTE_TESTE_KEY, e.target.value === "off" ? "off" : "ficticio"); }catch(err){}
      Busca = BUS.criarBusca({ provedor: criarProvedorIA(), producao: AMB.producao }); buscaIA.resposta = null; render();
      toast(e.target.value === "off" ? "Fonte de teste: Open Food Facts (rascunho)" : "Fonte de teste: catálogo fictício"); return;
    }
    if(e.target.id === "ocr-foto" && e.target.files && e.target.files[0]){ lerFoto(e.target.files[0]); return; }
    if(e.target.name === "perfil-ativo"){ perfisEstado.ativo = e.target.value; salvarPerfis(); gatilhosIA.disparar("PERFIL_SALVO"); toast("Perfil em uso: " + (perfilAtivo() || {}).apelido); return; }
    if(e.target.matches && e.target.matches("[data-restr], #f-pf")){ atualizarFormPerfil(); return; }
    if(e.target.id === "f-arquivo" && e.target.files && e.target.files[0]){
      if(e.target.files[0].size > 30*1024*1024){toast("Arquivo acima do limite de 30 MB");return;}
      var rd = new FileReader();
      rd.onload = function(){ if(ui.sheet && ui.sheet.type==="restaurar"){ ui.sheet.arquivoBackupTexto=String(rd.result || ""); toast("Arquivo selecionado. Informe a senha e clique em Analisar backup."); } };
      rd.onerror = function(){ toast("Não deu para ler o arquivo"); }; rd.readAsText(e.target.files[0]); return;
    }
    if(e.target.id !== "foto-input" || !e.target.files || !e.target.files[0] || !ui.sheet) return;
    var file = e.target.files[0], tipo = ui.sheet.type, id = ui.sheet.id;
    fileToThumb(file, function(url){
      if(!ui.sheet) return;
      if(tipo === "novo"){ ui.sheet.foto = url; novoPreview(); toast("Foto adicionada"); }
      else if(tipo === "item"){
        fotos[id] = url;
        if(saveFotos()){ var it2 = findItem(id); if(it2) itemPreview(it2); render(); toast("Foto salva");
          if(!sheet.querySelector('[data-act="remover-foto"]')){ var pa = sheet.querySelector(".pic-actions"); if(pa){ var rb = document.createElement("button"); rb.className = "btn-sm"; rb.type = "button"; rb.dataset.act = "remover-foto"; rb.textContent = "Remover foto"; pa.appendChild(rb); } } }
      }
    });
    e.target.value = "";
  });
  window.addEventListener("beforeinstallprompt", function(e){ e.preventDefault(); installEvt = e; if(state && ui.view === "inicio") renderInicio(); });
  window.addEventListener("hashchange", function(){
    var hs = location.hash || "";
    if(hs.indexOf("#importar=") === 0){
      var oi = parseImport(hs);
      try{ history.replaceState(null, "", location.pathname + location.search + "#inicio"); }catch(e){}
      show("inicio", true);
      if(oi) setTimeout(function(){ sheetImport(oi); }, 200); else toast("Código inválido");
      return;
    }
    if(hs.indexOf("#casa=") === 0){
      var cid = parseCasa(hs);
      try{ history.replaceState(null, "", location.pathname + location.search + "#inicio"); }catch(e){}
      show("inicio", true);
      if(cid && syncDisponivel()) setTimeout(function(){ sheetEntrar(cid); }, 200); else toast(cid ? "O tempo real ainda não está ligado neste app" : "Convite inválido");
      return;
    }
    if(hs.indexOf("#ofertas=") === 0){
      var oo2 = parseOfertasCode(hs);
      try{ history.replaceState(null, "", location.pathname + location.search + "#ofertas"); }catch(e){}
      show("ofertas", true);
      if(oo2) setTimeout(function(){ sheetOfertasImport(oo2); }, 200); else toast("Código inválido");
      return;
    }
    if(hs.indexOf("#para=") === 0){
      var c = decodeCarta(hs.slice(6));
      try{ history.replaceState(null, "", location.pathname + location.search + "#inicio"); }catch(e){}
      if(c){ state.carta = c; state.cartaVista = false; save(); showWelcome(); }
      show("inicio", true);
      return;
    }
    if(hs === "#ler-foto"){ show("inicio"); sheetFoto(); return; }
    if(hs === "#jantar"){ show("inicio"); abrirJantar(); return; }
    show(hs.replace("#",""), true);
  });

  /* ---------- Início ---------- */
  function start(data){
    loadFotos();
    try{ if("serviceWorker" in navigator && window.isSecureContext && location.hostname.indexOf("claude") < 0){ navigator.serviceWorker.register("sw.js").catch(function(){}); } }catch(e){}
    state = valid(data) ? data : (load() || seedState());
    if(!state.mes) state.mes = monthKey(todayStr());
    state.dieta = DietaMotor.migrar(state.dieta);
    atualizarMarcas();
    if(HML){ var hb = document.getElementById("hml-bar"); if(hb) hb.hidden = false; document.documentElement.setAttribute("data-ambiente", "homologacao"); }
    if(!state.importados) state.importados = [];
    loadRemote(); limparOfertasVencidas();
    var hh = location.hash || "", pendingImport = null, pendingOfertas = null;
    if(hh.indexOf("#importar=") === 0){
      pendingImport = parseImport(hh);
      try{ history.replaceState(null, "", location.pathname + location.search + "#inicio"); }catch(e){}
      hh = "#inicio";
    }
    var pendingCasa = null;
    if(hh.indexOf("#casa=") === 0){
      pendingCasa = parseCasa(hh);
      try{ history.replaceState(null, "", location.pathname + location.search + "#inicio"); }catch(e){}
      hh = "#inicio";
    }
    if(hh.indexOf("#ofertas=") === 0){
      pendingOfertas = parseOfertasCode(hh);
      try{ history.replaceState(null, "", location.pathname + location.search + "#ofertas"); }catch(e){}
      hh = "#ofertas";
    }
    if(hh.indexOf("#para=") === 0){
      var carta = decodeCarta(hh.slice(6));
      if(carta){ state.carta = carta; state.cartaVista = false; }
      try{ history.replaceState(null, "", location.pathname + location.search + "#inicio"); }catch(e){}
    }
    var h = (location.hash || "").replace("#","");
    show(VIEWS.indexOf(h) >= 0 ? h : "inicio", true);
    save();
    if(state.carta && !state.cartaVista) showWelcome();
    else if(h === "ler-foto"){ show("inicio"); sheetFoto(); }
    else if(h === "jantar"){ show("inicio"); abrirJantar(); }
    else if(pendingImport) setTimeout(function(){ sheetImport(pendingImport); }, 350);
    else if(pendingOfertas) setTimeout(function(){ sheetOfertasImport(pendingOfertas); }, 350);
    else if(pendingCasa && syncDisponivel()) setTimeout(function(){ sheetEntrar(pendingCasa); }, 350);
    fetchRemote();
    syncBoot();
    document.addEventListener("visibilitychange", function(){ if(!document.hidden){ limparOfertasVencidas(); fetchRemote(); } });
  }
  try{ if(window.claude && window.claude.hot && window.claude.hot.snapshot){ window.claude.hot.snapshot(function(){ return JSON.parse(JSON.stringify(state)); }); } }catch(e){}
  if(window.claude && window.claude.hot && window.claude.hot.ready){ window.claude.hot.ready(start); }
  else { start(window.claude && window.claude.hot && window.claude.hot.data); }
})();
