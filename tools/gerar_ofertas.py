#!/usr/bin/env python3
"""Gera o código de ofertas de um encarte para o app Elida.

Uso: python3 tools/gerar_ofertas.py encarte.json
O JSON de entrada:
{
  "id": "identificador único do encarte, ex.: fort-camboriu-2026-11-16",
  "mercado": "Fort Atacadista",
  "titulo": "Fort Semanal, 3ª edição",
  "inicio": "2026-11-16",
  "fim": "2026-11-19",
  "url": "link do encarte (opcional)",
  "ofertas": [
    {"nome": "Feijão preto Kicaldo", "cat": "Mercearia", "por": "pacote 1 kg", "preco": 5.99, "de": 7.49, "id": "s1"},
    {"nome": "Tomate", "cat": "Hortifruti", "por": "kg", "preco": 7.99}
  ]
}
- "preco" é o preço da oferta (por kg quando "por" for "kg"); "de" é o preço riscado, se o encarte mostrar.
- "id" é opcional: o id do item do app que é o mesmo produto, no mesmo tamanho (os de fábrica vão de s0 a s29).
  Sem "id", o app tenta ligar sozinho pelo nome e pelo tamanho.
- Categorias válidas: Mercearia, Proteínas, Hortifruti, Bebidas, Bebê, Limpeza e casa, Outros.
Saída: o texto pronto pra mandar no WhatsApp (link + código).
"""
import base64, json, sys

def main(path):
    c = json.load(open(path, encoding="utf-8"))
    itens = []
    for o in c["ofertas"]:
        row = [o["nome"], o.get("cat", "Outros"), o.get("por", "unidade"), round(float(o["preco"]), 2), round(float(o.get("de") or 0), 2)]
        if o.get("id"):
            row.append(o["id"])
        itens.append(row)
    payload = {"v": 1, "tipo": "ofertas", "id": str(c.get("id") or ""), "m": c["mercado"], "t": c.get("titulo", ""),
               "ini": c.get("inicio", ""), "fim": c.get("fim", ""), "u": c.get("url", ""), "i": itens}
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    code = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    fim = "/".join(reversed(c["fim"].split("-")))[:5] if c.get("fim") else ""
    print("Ofertas do " + c["mercado"] + (" até " + fim if fim else "") + " para o Elida.")
    print("Android: toque no link. iPhone: abra o app Elida, toque em Ofertas da semana, depois em Colar código de ofertas, e cole esta mensagem inteira.")
    print()
    print("https://kaleb-nunes.github.io/mercado-da-casa/#ofertas=" + code)

if __name__ == "__main__":
    main(sys.argv[1])
