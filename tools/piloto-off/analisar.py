"""Piloto Open Food Facts: métricas a partir da coleta (sem nova requisição).
Uso: python3 -I analisar.py <saida_dir>"""
import csv, json, os, re, statistics, subprocess, sys, time, unicodedata

SAIDA = sys.argv[1]
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("ELIDA_REPO", os.path.join(AQUI, "..", ".."))
HOJE = "2026-11-19"
amostra = json.load(open(os.path.join(AQUI, "amostra.json"), encoding="utf-8"))
coleta = json.load(open(os.path.join(SAIDA, "coleta.json"), encoding="utf-8"))
reg = {r["gtin"]: r for r in coleta["registro"]}


def norm(s):
    return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()


PARE = set("de da do das dos com sem e em a o para tipo pacote pct caixa cx lata garrafa pet pote sache sachet unidade unidades un vidro tradicional original".split())


def tokens(s):
    return {w for w in re.findall(r"[a-z]{3,}", norm(s)) if w not in PARE}


MAPA = {"en:milk": "leite", "en:gluten": "glúten", "en:soybeans": "soja", "en:eggs": "ovo", "en:peanuts": "amendoim", "en:nuts": "castanhas",
        "en:wheat": "trigo", "en:fish": "peixe", "en:crustaceans": "crustáceos", "en:sesame-seeds": "gergelim", "en:oats": "aveia", "en:barley": "cevada", "en:rye": "centeio"}
RX_ALERG = re.compile(r"al[eé]rgicos?\s*:|cont[eé]m\s+(leite|trigo|soja|ovo|amendoim|derivados|crust|castanha|aveia|cevada|centeio|am[eê]ndoa|avel[aã])|pode\s+conter", re.I)
# v2: "contém/não contém glúten" é a declaração da Lei 10.674, não advertência de alergênicos (RDC 26/2015).
# v2: campo preenchido com lixo (ex.: preço) não conta como ingredientes; produto de ingrediente único conta.
def plausivel(t): return len(t) >= 3 and not re.search(r"\bprice\b|\bpre[çc]o\b|r\$|^[\d\s.,]+$", t, re.I)
RX_GLUTEN = re.compile(r"(n[aã]o\s+cont[eé]m|cont[eé]m)\s+gl[uú]ten", re.I)
RX_LAC = re.compile(r"(zero|sem|isento de)\s+lactose|cont[eé]m\s+lactose", re.I)

linhas, para_motor = [], []
for item in amostra:
    g = item["gtin"]
    bruto = json.load(open(os.path.join(SAIDA, "brutos", g + ".json"), encoding="utf-8"))
    r = reg.get(g, {})
    tent = r.get("tentativas", [])
    p = (bruto or {}).get("product") or {}
    achou = (bruto or {}).get("status") == 1 and bool(p)
    nome = p.get("product_name_pt") or p.get("product_name") or ""
    ing_pt = (p.get("ingredients_text_pt") or "").strip()
    ing_bruto = ing_pt or (p.get("ingredients_text") or "").strip()
    ing = ing_bruto if plausivel(ing_bruto) else ""
    estados = p.get("states_tags") or []
    mod = p.get("last_modified_t")
    data_mod = time.strftime("%Y-%m-%d", time.gmtime(mod)) if mod else ""
    anos = (time.mktime(time.strptime(HOJE, "%Y-%m-%d")) - mod) / 31557600 if mod else None
    t_fonte, t_off = tokens(item["descricao_fonte"]), tokens(nome + " " + (p.get("brands") or "") + " " + (p.get("generic_name_pt") or ""))
    comum = t_fonte & t_off
    ident = "nao_encontrado" if not achou else ("provavel" if len(comum) >= 2 or (t_fonte and len(comum) / len(t_fonte) >= 0.4) else ("sem_nome" if not nome else "verificar"))
    alerg_texto = bool(RX_ALERG.search(ing))
    tags_a, tags_t = p.get("allergens_tags") or [], p.get("traces_tags") or []
    decl_g = RX_GLUTEN.search(ing)
    contradicao = bool(decl_g and re.match(r"n[aã]o", decl_g.group(1), re.I) and re.search(r"\btrigo\b|\bcevada\b|\bcenteio\b|\bmalte\b", norm(ing)))
    incompleto = (not ing) or "en:ingredients-to-be-completed" in estados or "en:ingredients-to-be-checked" in estados
    ms = [x.get("ms") for x in tent if x.get("ms") is not None]
    linha = {
        "gtin": g, "descricao_fonte": item["descricao_fonte"], "grupo_sorteio": item["grupo_sorteio"],
        "encontrado": achou, "identificacao_auto": ident, "nome_off": nome, "marca_off": p.get("brands") or "", "quantidade_off": p.get("quantity") or "",
        "campo_ingredientes_preenchido": bool(ing_bruto), "ingredientes": bool(ing), "ingredientes_em_portugues": bool(ing and ing_pt), "advertencia_explicita_no_texto": alerg_texto,
        "tags_alergenicos": ",".join(tags_a), "tags_tracos": ",".join(tags_t), "declaracao_gluten_no_texto": decl_g.group(0) if decl_g else "",
        "foto_ingredientes": bool(p.get("image_ingredients_url")), "atualizado_em": data_mod, "mais_de_3_anos": bool(anos and anos > 3),
        "incompleto": bool(achou and incompleto), "contraditorio_gluten": contradicao,
        "http": ";".join(str(x.get("http")) for x in tent), "tentativas": len(tent), "ms": ms[-1] if ms else None,
    }
    linhas.append(linha)
    if achou and ing:
        dl = RX_LAC.search(ing)
        para_motor.append({"gtin": g, "rotulo": {
            "nome": nome, "categoria": "alimento", "ingredientes": ing,
            "advertencias": {"contem": " ".join(MAPA.get(x, "") for x in tags_a), "podeConter": " ".join(MAPA.get(x, "") for x in tags_t)},
            "declaracaoGluten": ("nao_contem" if re.match(r"n[aã]o", decl_g.group(1), re.I) else "contem") if decl_g else "nao_informado",
            "declaracaoLactose": ("contem_lactose" if dl and re.match(r"cont", dl.group(0), re.I) else "sem_lactose") if dl else "nao_informado",
            "ingredientesCompletos": not incompleto, "advertenciasCompletas": alerg_texto,
            "fonte": {"identificacao": "Open Food Facts (colaborativo) · " + g, "dataVerificacao": data_mod or "1970-01-01"}}})

# Motor determinístico do app (APLV e celíaca), só informativo
js = """const R=require(process.argv[1]); const xs=JSON.parse(require('fs').readFileSync(0,'utf8')); const out={};
for(const x of xs){ const r=R.analisar({id:'piloto_x',apelido:'Piloto',restricoes:[{tipo:'aplv',situacao:'confirmada'},{tipo:'celiaca',situacao:'confirmada'}]}, x.rotulo, {hoje:'%s'});
 out[x.gtin]={aplv:r.detalhes[0].estado, celiaca:r.detalhes[1].estado}; } console.log(JSON.stringify(out));""" % HOJE
motor = json.loads(subprocess.run(["node", "-e", js, os.path.join(REPO, "elida-regras.js")], input=json.dumps(para_motor), capture_output=True, text=True, check=True).stdout)
for l in linhas:
    m = motor.get(l["gtin"], {})
    l["estado_aplv"], l["estado_celiaca"] = m.get("aplv", ""), m.get("celiaca", "")

REV = json.load(open(os.path.join(AQUI, "revisao-manual.json"), encoding="utf-8"))["identificacao"]
for l in linhas:
    if l["gtin"] in REV: l["identificacao_final"], l["nota_revisao"] = REV[l["gtin"]]
    else: l["identificacao_final"], l["nota_revisao"] = ("correto_heuristica" if l["identificacao_auto"] == "provavel" else l["identificacao_auto"]), ""
N = len(linhas)
def c(f): return sum(1 for l in linhas if f(l))
enc = [l for l in linhas if l["encontrado"]]
ms = [l["ms"] for l in linhas if l["ms"]]
met = {
    "amostra": N,
    "encontrados_por_gtin": c(lambda l: l["encontrado"]),
    "identificacao_provavel_auto": c(lambda l: l["identificacao_auto"] == "provavel"),
    "identificacao_a_verificar": c(lambda l: l["identificacao_auto"] in ("verificar", "sem_nome")),
    "identificacao_final": {k: c(lambda l, k=k: l["identificacao_final"] == k) for k in sorted({l["identificacao_final"] for l in linhas})},
    "com_ingredientes_e_advertencia_no_texto": c(lambda l: l["ingredientes"] and l["advertencia_explicita_no_texto"]),
    "campo_ingredientes_preenchido": c(lambda l: l["campo_ingredientes_preenchido"]),
    "com_ingredientes": c(lambda l: l["ingredientes"]),
    "com_ingredientes_em_portugues": c(lambda l: l["ingredientes_em_portugues"]),
    "com_advertencia_explicita_no_texto": c(lambda l: l["advertencia_explicita_no_texto"]),
    "com_tags_de_alergenicos_ou_tracos": c(lambda l: l["tags_alergenicos"] or l["tags_tracos"]),
    "com_declaracao_de_gluten_no_texto": c(lambda l: l["declaracao_gluten_no_texto"]),
    "com_foto_de_ingredientes": c(lambda l: l["foto_ingredientes"]),
    "incompletos_entre_encontrados": c(lambda l: l["incompleto"]),
    "mais_de_3_anos_sem_atualizar": c(lambda l: l["encontrado"] and l["mais_de_3_anos"]),
    "contraditorio_gluten": c(lambda l: l["contraditorio_gluten"]),
    "erros_http_finais": c(lambda l: not l["http"].endswith("200") and not l["http"].endswith("404")),
    "requisicoes_com_retentativa": c(lambda l: l["tentativas"] > 1),
    "tempo_resposta_ms_mediana": statistics.median(ms) if ms else None,
    "tempo_resposta_ms_p90": sorted(ms)[int(len(ms) * 0.9) - 1] if ms else None,
    "estados_aplv": {}, "estados_celiaca": {},
}
for l in linhas:
    if l["estado_aplv"]: met["estados_aplv"][l["estado_aplv"]] = met["estados_aplv"].get(l["estado_aplv"], 0) + 1
    if l["estado_celiaca"]: met["estados_celiaca"][l["estado_celiaca"]] = met["estados_celiaca"].get(l["estado_celiaca"], 0) + 1
bn = coleta["busca_nome"]
met["busca_por_nome"] = {"testes": len(bn), "achou_no_top5": sum(1 for b in bn if b["achou_no_top5"]), "sem_resultado": sum(1 for b in bn if not b["codigos_top5"]),
                         "erros_http": sum(1 for b in bn if not str(b["tentativas"][-1].get("http")) == "200")}
por_grupo = {}
for l in linhas:
    gq = por_grupo.setdefault(l["grupo_sorteio"], {"n": 0, "encontrados": 0, "ingredientes": 0, "advertencia_texto": 0})
    gq["n"] += 1; gq["encontrados"] += l["encontrado"]; gq["ingredientes"] += l["ingredientes"]; gq["advertencia_texto"] += l["advertencia_explicita_no_texto"]
met["por_grupo"] = por_grupo
json.dump({"metricas": met, "user_agent": coleta["user_agent"], "concluido": coleta["concluido"]}, open(os.path.join(SAIDA, "metricas.json"), "w"), ensure_ascii=False, indent=1)
with open(os.path.join(SAIDA, "resultados-por-gtin.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(linhas[0].keys())); w.writeheader(); w.writerows(linhas)
print(json.dumps({k: v for k, v in met.items() if k != "por_grupo"}, ensure_ascii=False))
