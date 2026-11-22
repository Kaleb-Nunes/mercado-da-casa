/* Elida IA · Marco 3: leitura de rótulo por foto, no próprio aparelho.
   - A imagem nunca sai do aparelho: o leitor (Tesseract, WASM) roda local e os arquivos vêm do próprio site.
   - O texto lido é sempre RASCUNHO. Só vira dado de análise depois que a pessoa confere com a embalagem.
   - Foto ilegível, sem a lista de ingredientes ou lida com pouca confiança: INFORMAÇÃO INSUFICIENTE.
   O analisador de texto (interpretar) é puro e testado em Node; lerImagem só existe no navegador. */
(function (raiz, fabrica) {
  var m = fabrica();
  if (typeof module === "object" && module.exports) module.exports = m; else raiz.ElidaOCR = m;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var VERSAO = "ocr-2026.11.19";
  var LIMITES = Object.freeze({ confiancaMinima: 60, confiancaPalavra: 70, textoMinimo: 12, tempoMaximoMs: 60000, ladoMaximo: 2000, ladoMinimo: 900 });
  var STATUS = Object.freeze({ OK: "ok", INSUFICIENTE: "INFORMACAO_INSUFICIENTE" });

  /* Tira acento caractere a caractere, sem mudar o tamanho do texto (os índices continuam valendo). */
  function chaveDe(t) {
    var out = "";
    for (var i = 0; i < t.length; i++) { var c = t.charAt(i); out += (c.normalize ? c.normalize("NFD").charAt(0) : c); }
    return out.toUpperCase();
  }
  /* Junta as linhas: hífen no fim da linha cola a palavra; aspas e barras soltas do OCR viram espaço. */
  function limpar(t) {
    return String(t == null ? "" : t).normalize("NFC").replace(/\r/g, "").replace(/-[ \t]*\n[ \t]*/g, "-")
      .replace(/[ \t]*\n[ \t]*/g, " ").replace(/[|“”»«_~¦]/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  var RX_INGR = /(?:^|[^A-Z])((?:[A-Z]?N?GRED[I1L]?[A-Z]{3,5}S?)|(?:I?NGR\.\s*:?)|(?:INGR\b))\s*[:.;,]?\s*/;
  var RX_INGR_FRACO = /REDIENTES?\s*[:.;,]?\s*/;
  var RX_FIM_ING = /\bALERG[A-Z]*\b|\b(?:NAO\s+)?CONT[EF]M\b|\bPODE\s*\W{0,3}\s*CONT|\bINFORMACAO\s+NUTRI|\bCONSERVAR\b|\bINDUSTRIA\s+BRASILEIRA\b|\bVALIDADE\b|\bLOTE\b/;
  var RX_CONTEM = /(NAO\s+)?CONT[EF]M\s*:?\s+([^.]{2,240})(?:\.|$)/g;
  var RX_PODE = /PODE\s*\W{0,3}\s*CONT[EI1][RIN]?\s*:?\s*([^.]{2,260})(?:\.|$)/g;
  var RX_GL_NAO = /NAO\s+CONT[EF]M\s+GL[UV]TEN|(?:SEM|ISENTO\s+DE)\s+GL[UV]TEN/;
  var RX_LAC_SEM = /NAO\s+CONT[EF]M\s+LACTOSE|(?:SEM|ZERO|ISENTO\s+DE)\s+LACTOSE/;
  var RX_LAC_SIM = /CONT[EF]M\s+LACTOSE/;

  /* Separa por vírgula/ponto e vírgula fora de parênteses e colchetes. */
  function separar(s) {
    var partes = [], atual = "", nivel = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === "(" || c === "[") nivel++;
      else if ((c === ")" || c === "]") && nivel > 0) nivel--;
      if ((c === "," || c === ";") && nivel === 0) { partes.push(atual); atual = ""; } else atual += c;
    }
    partes.push(atual);
    return partes.map(function (p) { return p.replace(/^[\s.:;-]+|[\s.:;*-]+$/g, ""); }).filter(function (p) { return /[A-Za-zÀ-ú]{2,}/.test(p); });
  }

  function declaracaoGluten(k) {
    var nao = RX_GL_NAO.test(k);
    var sim = false, rx = /CONT[EF]M\s+GL[UV]TEN/g, m;
    while ((m = rx.exec(k))) { var antes = k.slice(Math.max(0, m.index - 5), m.index); if (!/NAO\s*$/.test(antes)) sim = true; }
    return nao && sim ? "contraditorio" : sim ? "contem" : nao ? "nao_contem" : "nao_informado";
  }
  function declaracaoLactose(k) {
    var sem = RX_LAC_SEM.test(k), sim = false, rx = /CONT[EF]M\s+LACTOSE/g, m;
    while ((m = rx.exec(k))) { var antes = k.slice(Math.max(0, m.index - 5), m.index); if (!/NAO\s*$/.test(antes)) sim = true; }
    return sem && sim ? "contraditorio" : sim ? "contem_lactose" : sem ? "sem_lactose" : "nao_informado";
  }

  /* interpretar(texto, { confianca, palavras:[{texto, confianca}], hoje })
     Devolve o rascunho do rótulo e, se for o caso, INFORMAÇÃO INSUFICIENTE com os motivos. */
  function interpretar(textoBruto, meta) {
    meta = meta || {};
    var t = limpar(textoBruto), k = chaveDe(t), motivos = [], avisos = [];
    var conf = typeof meta.confianca === "number" ? meta.confianca : null;
    var mI = RX_INGR.exec(k) || RX_INGR_FRACO.exec(k);
    var iniIng = -1, fimIng = -1;
    if (mI) {
      iniIng = mI.index + mI[0].length;
      var resto = k.slice(iniIng), f = RX_FIM_ING.exec(resto);
      fimIng = f ? iniIng + f.index : k.length;
    }
    var trechoIng = iniIng >= 0 ? t.slice(iniIng, fimIng) : "";
    var ingredientes = separar(trechoIng);
    var depois = iniIng >= 0 ? k.slice(fimIng) : k, desloc = iniIng >= 0 ? fimIng : 0, original = t.slice(desloc);

    var contem = [], pode = [], m;
    RX_CONTEM.lastIndex = 0;
    while ((m = RX_CONTEM.exec(depois))) {
      if (m[1]) continue;
      if (/^(GL[UV]TEN|LACTOSE)\b/.test(m[2])) {
        var extra = m[2].replace(/^(GL[UV]TEN|LACTOSE)\W*/, "");
        if (!extra) continue;
      }
      contem.push(original.substr(m.index, m[0].length).trim());
    }
    RX_PODE.lastIndex = 0;
    while ((m = RX_PODE.exec(depois))) pode.push(original.substr(m.index, m[0].length).trim());
    contem = contem.filter(function (c) { return !/^\W*pode/i.test(c); });

    var temBloco = /ALERG[A-Z]*\s*:?/.test(depois) || contem.length > 0 || pode.length > 0;
    var dg = declaracaoGluten(k), dl = declaracaoLactose(k);

    if (conf != null && conf < LIMITES.confiancaMinima) motivos.push("A foto ficou pouco legível (confiança " + Math.round(conf) + "%). Tire outra, de perto, com luz e sem reflexo.");
    if (t.replace(/\W/g, "").length < LIMITES.textoMinimo) motivos.push("Quase nenhum texto foi lido na foto.");
    if (!mI) motivos.push("Não achei a palavra \"Ingredientes\" na foto. Fotografe a lista inteira.");
    else if (!ingredientes.length) motivos.push("Achei \"Ingredientes\", mas não consegui ler a lista.");
    if (!temBloco && dg === "nao_informado") avisos.push("Não achei o bloco ALÉRGICOS nem a declaração de glúten. Se estiverem em outra parte da embalagem, confira lá.");

    var duvidosas = (meta.palavras || []).filter(function (p) { return typeof p.confianca === "number" && p.confianca < LIMITES.confiancaPalavra && /[A-Za-zÀ-ú]{3,}/.test(p.texto || ""); })
      .map(function (p) { return p.texto; }).slice(0, 40);

    var rotulo = {
      nome: "", categoria: "alimento", ingredientes: ingredientes,
      advertencias: { contem: contem.join(" "), podeConter: pode.join(" ") },
      declaracaoGluten: dg, declaracaoLactose: dl,
      ingredientesCompletos: false, advertenciasCompletas: false, rascunho: true,
      fonte: { identificacao: "Foto do rótulo, leitura automática " + VERSAO + " (não conferida)", dataVerificacao: meta.hoje || new Date().toISOString().slice(0, 10) }
    };
    return {
      status: motivos.length ? STATUS.INSUFICIENTE : STATUS.OK, versao: VERSAO, motivos: motivos, avisos: avisos,
      confianca: conf, palavrasDuvidosas: duvidosas, textoLido: t,
      achados: { ingredientes: !!mI && ingredientes.length > 0, blocoAlergicos: temBloco, declaracaoGluten: dg !== "nao_informado" },
      rotulo: rotulo
    };
  }

  /* Depois que a pessoa conferiu e corrigiu: o rascunho vira rótulo conferido. */
  function confirmar(rascunho, campos, marcas, hoje) {
    var r = JSON.parse(JSON.stringify(rascunho || {}));
    campos = campos || {}; marcas = marcas || {};
    if (!marcas.textoConferido) return { ok: false, erros: ["Confira o texto lido com a embalagem antes de analisar."] };
    if (campos.ingredientes != null) r.ingredientes = String(campos.ingredientes).split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
    r.advertencias = { contem: campos.contem != null ? String(campos.contem) : (r.advertencias && r.advertencias.contem) || "", podeConter: campos.podeConter != null ? String(campos.podeConter) : (r.advertencias && r.advertencias.podeConter) || "" };
    if (campos.declaracaoGluten) r.declaracaoGluten = campos.declaracaoGluten;
    if (campos.declaracaoLactose) r.declaracaoLactose = campos.declaracaoLactose;
    if (campos.nome != null) r.nome = String(campos.nome).trim();
    r.ingredientesCompletos = !!marcas.ingredientesCompletos;
    r.advertenciasCompletas = !!marcas.advertenciasCompletas;
    r.rascunho = false;
    r.fonte = { identificacao: "Foto do rótulo conferida por você (" + VERSAO + ")", dataVerificacao: hoje || new Date().toISOString().slice(0, 10) };
    return { ok: true, rotulo: r };
  }

  /* ---------- Só no navegador ---------- */
  var motor = null, carregando = null;
  function absoluto(u) { return new URL(u, self.location.href).href; }
  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      if (self.Tesseract) return ok();
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = function () { ok(); }; s.onerror = function () { falha(new Error("o leitor não carregou")); };
      document.head.appendChild(s);
    });
  }
  function obterMotor(cfg) {
    if (motor) return Promise.resolve(motor);
    if (carregando) return carregando;
    var b = absoluto(cfg.base || "./vendor/ocr/");
    carregando = carregarScript(b + "tesseract.min.js").then(function () {
      return self.Tesseract.createWorker("por", 1, { workerPath: b + "worker.min.js", corePath: b, langPath: b, gzip: true, workerBlobURL: false, cacheMethod: "write", logger: cfg.progresso || function () {} });
    }).then(function (w) { motor = w; carregando = null; return w; }, function (e) { carregando = null; throw e; });
    return carregando;
  }
  function encerrar() { var w = motor; motor = null; return w ? w.terminate().catch(function () {}) : Promise.resolve(); }

  /* Escolhe o canal de cor que mais separa texto e fundo (Otsu), estica o contraste e deixa o texto escuro
     sobre fundo claro. Feito pixel a pixel para dar o mesmo resultado em Chrome e Safari. Fica só na memória. */
  function otsu(hist, total) {
    var soma = 0, i; for (i = 0; i < 256; i++) soma += i * hist[i];
    var sB = 0, wB = 0, melhor = 0, limiar = 127, media = soma / total, varT = 0;
    for (i = 0; i < 256; i++) varT += hist[i] * (i - media) * (i - media);
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue; var wF = total - wB; if (!wF) break;
      sB += i * hist[i]; var mB = sB / wB, mF = (soma - sB) / wF, entre = wB * wF * (mB - mF) * (mB - mF);
      if (entre > melhor) { melhor = entre; limiar = i; }
    }
    return { limiar: limiar, separacao: varT ? melhor / total / (varT / total) / total : 0 };
  }
  function ajustarPixels(dados, modo) {
    var px = dados.data, n = px.length / 4, canais = [[], [], [], []], hist = [0, 1, 2, 3].map(function () { return new Array(256).fill(0); }), passo = Math.max(1, Math.floor(n / 60000)), amostras = 0;
    for (var i = 0; i < n; i += passo) {
      var r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      hist[0][r]++; hist[1][g]++; hist[2][b]++; hist[3][l]++; amostras++;
    }
    var esc = 3, melhor = -1;
    for (var c = 0; c < 4; c++) { var o = otsu(hist[c], amostras); canais[c] = o; if (o.separacao > melhor) { melhor = o.separacao; esc = c; } }
    if (modo && modo.canal) esc = "RGBL".indexOf(modo.canal);
    var h = hist[esc], acum = 0, lo = 0, hi = 255, claros = 0;
    for (var k = 0; k < 256; k++) { acum += h[k]; if (acum <= amostras * 0.02) lo = k; if (acum <= amostras * 0.98) hi = k; if (k > canais[esc].limiar) claros += h[k]; }
    var inverter = modo && typeof modo.inverter === "boolean" ? modo.inverter : claros / amostras < 0.45, faixa = Math.max(1, hi - lo);
    for (var j = 0; j < n; j++) {
      var v = esc === 3 ? 0.299 * px[j * 4] + 0.587 * px[j * 4 + 1] + 0.114 * px[j * 4 + 2] : px[j * 4 + esc];
      v = Math.max(0, Math.min(255, (v - lo) * 255 / faixa)); if (inverter) v = 255 - v;
      px[j * 4] = px[j * 4 + 1] = px[j * 4 + 2] = v;
    }
    return { canal: ["R", "G", "B", "L"][esc], invertido: inverter };
  }
  function abrirImagem(arquivo) {
    return self.createImageBitmap ? self.createImageBitmap(arquivo, { imageOrientation: "from-image" }).catch(function () { return self.createImageBitmap(arquivo); })
      : Promise.reject(new Error("navegador sem suporte a imagem"));
  }
  function canvasDe(bmp, modo) {
    var w = bmp.width, h = bmp.height, maior = Math.max(w, h), esc = 1;
    if (maior > LIMITES.ladoMaximo) esc = LIMITES.ladoMaximo / maior;
    else if (maior < LIMITES.ladoMinimo) esc = Math.min(2.5, LIMITES.ladoMinimo / maior);
    var c = document.createElement("canvas"); c.width = Math.round(w * esc); c.height = Math.round(h * esc);
    var g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(bmp, 0, 0, c.width, c.height);
    var d = g.getImageData(0, 0, c.width, c.height), info = ajustarPixels(d, modo); g.putImageData(d, 0, 0);
    c._preparo = info;
    return c;
  }
  function prepararImagem(arquivo, modo) { return abrirImagem(arquivo).then(function (bmp) { var c = canvasDe(bmp, modo); if (bmp.close) bmp.close(); return c; }); }
  /* Até três leituras: luminância; se não passar, canal azul e canal vermelho (rótulos com fundo colorido).
     Para na primeira que passar; se nenhuma passar, fica a de maior confiança, como INFORMAÇÃO INSUFICIENTE. */
  var TENTATIVAS = [{ canal: "L", inverter: false }, { canal: "B", inverter: false }, { canal: "R", inverter: false }];
  function palavrasDe(data) {
    var out = [];
    (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { (l.words || []).forEach(function (w) { out.push({ texto: w.text, confianca: w.confidence }); }); }); }); });
    return out;
  }
  /* lerImagem(arquivo, { base, hoje, progresso }) -> Promise<resultado de interpretar + tempos> */
  function lerImagem(arquivo, cfg) {
    cfg = cfg || {};
    var t0 = Date.now(), tPronto = 0, leituras = [];
    var tarefa = Promise.all([obterMotor(cfg), abrirImagem(arquivo)]).then(function (r) {
      tPronto = Date.now();
      var w = r[0], bmp = r[1], i = 0;
      function proxima() {
        var modo = TENTATIVAS[i++], c = canvasDe(bmp, modo);
        if (cfg.etapa) cfg.etapa(i, TENTATIVAS.length);
        return w.recognize(c, {}, { text: true, blocks: true }).then(function (res) {
          var d = res.data, out = interpretar(d.text, { confianca: d.confidence, palavras: palavrasDe(d), hoje: cfg.hoje });
          if(cfg.destacarLinha){
            out.linhas = []; out.largura = c.width; out.altura = c.height;
            (d.blocks || []).forEach(function(bloco){ (bloco.paragraphs || []).forEach(function(paragrafo){
              (paragrafo.lines || []).forEach(function(linha){
                if(linha.bbox && cfg.destacarLinha(linha.text || "")) out.linhas.push({texto:linha.text.trim(), caixa:linha.bbox});
              });
            }); });
          }
          out.preparo = modo.canal; leituras.push(out);
          if (out.status === STATUS.OK || i >= TENTATIVAS.length) return null;
          return proxima();
        });
      }
      return proxima().then(function () {
        var ok = leituras.filter(function (l) { return l.status === STATUS.OK; })[0];
        var melhor = ok || leituras.slice().sort(function (a, b) { return (b.confianca || 0) - (a.confianca || 0); })[0];
        if(cfg.destacarLinha && melhor.status === STATUS.OK){
          var foto = document.createElement("canvas");
          foto.width = melhor.largura; foto.height = melhor.altura;
          var ctx = foto.getContext("2d"); ctx.drawImage(bmp,0,0,foto.width,foto.height);
          ctx.strokeStyle = "#e5a500"; ctx.lineWidth = Math.max(2, foto.width/400);
          (melhor.linhas || []).forEach(function(l){ var b=l.caixa; ctx.strokeRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0); });
          melhor.foto = foto;
        }
        return melhor;
      }).finally(function(){if(bmp.close) bmp.close();});
    }).then(function (out) {
      out.tentativas = leituras.length;
      out.tempos = { carregarMs: tPronto - t0, lerMs: Date.now() - tPronto, totalMs: Date.now() - t0 };
      return out;
    });
    var limite = new Promise(function (_, falha) { setTimeout(function () { falha(new Error("a leitura demorou demais")); }, cfg.tempoMaximoMs || LIMITES.tempoMaximoMs); });
    return Promise.race([tarefa, limite]).catch(function (e) {
      var out = interpretar("", { hoje: cfg.hoje });
      out.motivos = ["Não deu para ler a foto (" + String(e && e.message || e).slice(0, 80) + ")."];
      out.erro = true; out.tempos = { totalMs: Date.now() - t0 };
      return out;
    });
  }

  return Object.freeze({ VERSAO: VERSAO, LIMITES: LIMITES, STATUS: STATUS, limpar: limpar, interpretar: interpretar, confirmar: confirmar,
    lerImagem: lerImagem, encerrar: encerrar, _separar: separar, _prepararImagem: prepararImagem });
});
