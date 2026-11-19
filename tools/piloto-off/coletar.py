"""Piloto Open Food Facts: coleta controlada (só leitura).
- Produto por GTIN: no máximo 13 por minuto (limite oficial: 15/min/IP).
- Busca por nome: 20 produtos, no máximo 8 por minuto (limite oficial: 10/min/IP).
- 429/503: espera e tenta de novo (até 3 vezes); cada falha é registrada.
- Nada de perfil, saúde ou dado da família vai na requisição: só o GTIN ou o nome do produto.
Uso: python3 -I coletar.py <saida_dir>"""
import json, os, sys, time, urllib.request, urllib.parse, urllib.error

SAIDA = sys.argv[1]
os.makedirs(os.path.join(SAIDA, "brutos"), exist_ok=True)
UA = "Elida-piloto/0.1 (+https://github.com/Kaleb-Nunes/mercado-da-casa)"
BASE = "https://world.openfoodfacts.org"
CAMPOS = ",".join(["code", "product_name", "product_name_pt", "generic_name_pt", "brands", "quantity", "lang", "countries_tags",
                   "ingredients_text", "ingredients_text_pt", "allergens_tags", "traces_tags", "allergens_from_user", "traces_from_user",
                   "states_tags", "last_modified_t", "created_t", "image_ingredients_url", "data_quality_warnings_tags"])
INTERVALO_PRODUTO, INTERVALO_BUSCA = 4.6, 7.5


def pedir(url):
    tentativas = []
    for n in range(3):
        ini = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=25) as r:
                corpo = r.read()
                tentativas.append({"http": r.status, "ms": round((time.time() - ini) * 1000)})
                return json.loads(corpo.decode("utf-8")), tentativas
        except urllib.error.HTTPError as e:
            tentativas.append({"http": e.code, "ms": round((time.time() - ini) * 1000)})
            if e.code == 404:
                try: return json.loads(e.read().decode("utf-8")), tentativas
                except Exception: return {"status": 0}, tentativas
            if e.code in (429, 503): time.sleep(30 * (n + 1)); continue
            return None, tentativas
        except Exception as e:
            tentativas.append({"http": None, "erro": str(e)[:80], "ms": round((time.time() - ini) * 1000)})
            time.sleep(10 * (n + 1))
    return None, tentativas


amostra = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "amostra.json"), encoding="utf-8"))
registro = []
for i, item in enumerate(amostra):
    url = BASE + "/api/v2/product/" + item["gtin"] + ".json?fields=" + CAMPOS
    dados, tent = pedir(url)
    json.dump(dados, open(os.path.join(SAIDA, "brutos", item["gtin"] + ".json"), "w"), ensure_ascii=False)
    registro.append({"gtin": item["gtin"], "tentativas": tent, "status_off": (dados or {}).get("status")})
    time.sleep(INTERVALO_PRODUTO)

# Busca por nome: 2 por grupo de sorteio (os 2 primeiros), com as 4 primeiras palavras da descrição
import re
grupos, busca = {}, []
for item in amostra:
    g = grupos.setdefault(item["grupo_sorteio"], [])
    if len(g) < 2: g.append(item)
for g in grupos.values():
    for item in g:
        termos = " ".join([w for w in re.sub(r"[^\wÀ-ú ]", " ", item["descricao_fonte"]).split() if not re.search(r"\d", w)][:4])
        q = urllib.parse.urlencode({"search_terms": termos, "search_simple": 1, "action": "process", "json": 1, "page_size": 5, "fields": "code,product_name,brands"})
        dados, tent = pedir(BASE + "/cgi/search.pl?" + q)
        codigos = [p.get("code") for p in (dados or {}).get("products", [])]
        busca.append({"gtin": item["gtin"], "termos": termos, "tentativas": tent, "codigos_top5": codigos, "achou_no_top5": item["gtin"] in codigos, "total": (dados or {}).get("count")})
        time.sleep(INTERVALO_BUSCA)

json.dump({"user_agent": UA, "registro": registro, "busca_nome": busca, "concluido": time.strftime("%Y-%m-%dT%H:%M:%S")}, open(os.path.join(SAIDA, "coleta.json"), "w"), ensure_ascii=False, indent=1)
print("ok", len(registro), "produtos,", len(busca), "buscas")
