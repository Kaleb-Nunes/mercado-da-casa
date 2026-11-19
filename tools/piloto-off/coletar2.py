"""Piloto OFF, fase 2: depois do 503 contínuo da busca antiga (/cgi/search.pl).
- Reconstrói o registro dos 100 GTINs pelos arquivos já baixados (sem nova leitura).
- Mede tempo de resposta numa subamostra de 20 GTINs (2 por grupo), a no máximo 13/min.
- Busca por nome pela API nova (search.openfoodfacts.org), 20 consultas a no máximo 8/min.
Uso: python3 -I coletar2.py <saida_dir>"""
import json, os, re, sys, time, urllib.request, urllib.parse, urllib.error

SAIDA = sys.argv[1]
AQUI = os.path.dirname(os.path.abspath(__file__))
UA = "Elida-piloto/0.1 (+https://github.com/Kaleb-Nunes/mercado-da-casa)"


def pedir(url, tentativas_max=2):
    tent = []
    for n in range(tentativas_max):
        ini = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=25) as r:
                corpo = r.read(); tent.append({"http": r.status, "ms": round((time.time() - ini) * 1000)})
                return json.loads(corpo.decode("utf-8")), tent
        except urllib.error.HTTPError as e:
            tent.append({"http": e.code, "ms": round((time.time() - ini) * 1000)})
            if e.code == 404: return {"status": 0}, tent
            if e.code in (429, 503) and n + 1 < tentativas_max: time.sleep(30); continue
            return None, tent
        except Exception as e:
            tent.append({"http": None, "erro": str(e)[:80], "ms": round((time.time() - ini) * 1000)})
            if n + 1 < tentativas_max: time.sleep(10)
    return None, tent


amostra = json.load(open(os.path.join(AQUI, "amostra.json"), encoding="utf-8"))
grupos = {}
for it in amostra: grupos.setdefault(it["grupo_sorteio"], []).append(it)
sub = [x for g in grupos.values() for x in g[:2]]

registro = []
for it in amostra:
    d = json.load(open(os.path.join(SAIDA, "brutos", it["gtin"] + ".json"), encoding="utf-8"))
    st = (d or {}).get("status")
    registro.append({"gtin": it["gtin"], "status_off": st, "tentativas": [{"http": 200 if st == 1 else 404, "ms": None, "obs": "coleta 1 (tempo não registrado)"}]})
reg = {r["gtin"]: r for r in registro}
for it in sub:
    _, tent = pedir("https://world.openfoodfacts.org/api/v2/product/" + it["gtin"] + ".json?fields=code,product_name")
    reg[it["gtin"]]["tentativas"] = tent
    time.sleep(4.6)

busca = []
for it in sub:
    termos = " ".join([w for w in re.sub(r"[^\wÀ-ú ]", " ", it["descricao_fonte"]).split() if not re.search(r"\d|�", w)][:4])
    q = urllib.parse.urlencode({"q": termos, "page_size": 5, "fields": "code,product_name,brands"})
    d, tent = pedir("https://search.openfoodfacts.org/search?" + q)
    codigos = [h.get("code") for h in (d or {}).get("hits", [])]
    busca.append({"gtin": it["gtin"], "termos": termos, "tentativas": tent, "codigos_top5": codigos, "achou_no_top5": it["gtin"] in codigos, "total": (d or {}).get("count")})
    time.sleep(7.5)

json.dump({"user_agent": UA, "registro": registro, "busca_nome": busca,
           "observacoes": ["A busca antiga (/cgi/search.pl) respondeu 503 em todas as tentativas durante o piloto; a fase de busca foi refeita na API nova (search.openfoodfacts.org).",
                           "Tempo de resposta medido numa subamostra de 20 GTINs (2 por grupo)."],
           "concluido": time.strftime("%Y-%m-%dT%H:%M:%S")}, open(os.path.join(SAIDA, "coleta.json"), "w"), ensure_ascii=False, indent=1)
print("ok", len(sub), "tempos,", len(busca), "buscas")
