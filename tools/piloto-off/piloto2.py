"""Segundo piloto de cobertura: só com códigos de barras escolhidos e autorizados pelo Kaleb.
Entrada: CSV com UMA coluna, "gtin" (opcional: "apelido", um nome curto do produto, sem dado pessoal).
- Recusa qualquer outra coluna, código inválido (dígito verificador) e mais de 50 linhas.
- Só leitura, no máximo 13 por minuto (limite oficial: 15/min/IP). 429/503: espera e tenta 1 vez.
- Saídas: brutos/<gtin>.json, metricas.json e conferencia-embalagem.csv (para preencher olhando a embalagem real).
Uso: python3 -I piloto2.py <entrada.csv> <saida_dir> [contato-email]"""
import csv, json, os, sys, time, urllib.request, urllib.error

ENTRADA, SAIDA = sys.argv[1], sys.argv[2]
UA = "Elida-piloto2/0.1 (%s)" % (sys.argv[3] if len(sys.argv) > 3 else "+https://github.com/Kaleb-Nunes/mercado-da-casa")
CAMPOS = "code,product_name,product_name_pt,brands,quantity,ingredients_text_pt,ingredients_text,allergens_tags,traces_tags,last_modified_t,states_tags,image_ingredients_url"


def gtin_valido(c):
    if not c.isdigit() or len(c) not in (8, 12, 13, 14): return False
    s = sum(int(c[len(c) - 2 - i]) * (3 if i % 2 == 0 else 1) for i in range(len(c) - 1))
    return (10 - s % 10) % 10 == int(c[-1])


linhas = list(csv.DictReader(open(ENTRADA, encoding="utf-8-sig")))
extras = set(linhas[0].keys() if linhas else []) - {"gtin", "apelido"}
if extras: sys.exit("Colunas não permitidas: %s. Use só gtin (e apelido)." % ", ".join(sorted(extras)))
if not 1 <= len(linhas) <= 50: sys.exit("Use de 1 a 50 códigos.")
ruins = [l["gtin"] for l in linhas if not gtin_valido(l["gtin"].strip())]
if ruins: sys.exit("Códigos inválidos: %s" % ", ".join(ruins))
os.makedirs(os.path.join(SAIDA, "brutos"), exist_ok=True)

registro = []
for l in linhas:
    g = l["gtin"].strip(); tent = []
    for n in range(2):
        ini = time.time()
        try:
            req = urllib.request.Request("https://world.openfoodfacts.org/api/v2/product/%s.json?fields=%s" % (g, CAMPOS), headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as r: d = json.loads(r.read().decode("utf-8")); tent.append({"http": r.status, "ms": round((time.time() - ini) * 1000)}); break
        except urllib.error.HTTPError as e:
            tent.append({"http": e.code, "ms": round((time.time() - ini) * 1000)}); d = {"status": 0}
            if e.code in (429, 503) and n == 0: time.sleep(60); continue
            break
        except Exception as e:
            tent.append({"http": None, "erro": str(e)[:80]}); d = None; break
    json.dump(d, open(os.path.join(SAIDA, "brutos", g + ".json"), "w"), ensure_ascii=False)
    registro.append({"gtin": g, "apelido": (l.get("apelido") or "").strip()[:40], "tentativas": tent, "dados": d})
    time.sleep(4.6)

def tem_ing(p): t = (p.get("ingredients_text_pt") or p.get("ingredients_text") or "").strip(); return len(t) >= 3 and "price" not in t.lower()
achados = [r for r in registro if r["dados"] and r["dados"].get("status") == 1]
ms = sorted(t["ms"] for r in registro for t in r["tentativas"] if t.get("ms") is not None)
met = {"amostra": len(registro), "encontrados": len(achados),
       "com_ingredientes": sum(1 for r in achados if tem_ing(r["dados"]["product"])),
       "com_alergenicos_ou_tracos_no_off": sum(1 for r in achados if r["dados"]["product"].get("allergens_tags") or r["dados"]["product"].get("traces_tags")),
       "com_foto_de_ingredientes": sum(1 for r in achados if r["dados"]["product"].get("image_ingredients_url")),
       "erros_http": sum(1 for r in registro if r["tentativas"] and r["tentativas"][-1].get("http") not in (200, 404)),
       "tempo_ms_mediana": ms[len(ms) // 2] if ms else None, "user_agent": UA}
json.dump(met, open(os.path.join(SAIDA, "metricas.json"), "w"), ensure_ascii=False, indent=1)
with open(os.path.join(SAIDA, "conferencia-embalagem.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["gtin", "apelido", "nome_no_off", "ingredientes_no_off", "alergenicos_no_off", "tracos_no_off",
                "MESMO_PRODUTO_E_VARIANTE (sim/nao)", "INGREDIENTES_CONFEREM (sim/nao/parcial)", "CONTEM_NA_EMBALAGEM", "PODE_CONTER_NA_EMBALAGEM",
                "GLUTEN_NA_EMBALAGEM (contem/nao_contem/nao_achei)", "LEITURA_POR_FOTO_NO_APP (passou/insuficiente)", "OBSERVACAO"])
    for r in registro:
        p = (r["dados"] or {}).get("product") or {}
        w.writerow([r["gtin"], r["apelido"], p.get("product_name_pt") or p.get("product_name") or "", (p.get("ingredients_text_pt") or p.get("ingredients_text") or "")[:300],
                    ",".join(p.get("allergens_tags") or []), ",".join(p.get("traces_tags") or []), "", "", "", "", "", "", ""])
print(json.dumps(met, ensure_ascii=False))
