#!/usr/bin/env python3
"""Gera o código de importação de um cupom para o app Elida.

Uso: python3 tools/gerar_importacao.py cupom.json
O JSON de entrada:
{
  "id": "chave de acesso da NFC-e (44 dígitos) ou outro identificador único",
  "mercado": "Mercado Exemplo",
  "data": "2026-11-20",
  "total": 32.38,
  "itens": [
    {"nome": "Tomate", "cat": "Hortifruti", "por": "kg", "preco": 9.90, "qtd": 0.5, "id": "s14"},
    {"nome": "Ovos brancos", "cat": "Proteínas", "por": "bandeja 30 un.", "preco": 27.43, "qtd": 1}
  ]
}
- "preco" é o preço unitário (por kg quando "por" for "kg").
- "id" é opcional: o id do item já cadastrado no app (os itens de fábrica vão de s0 a s29).
- Categorias válidas: Mercearia, Proteínas, Hortifruti, Bebidas, Bebê, Limpeza e casa, Outros.
Saída: o texto pronto pra mandar no WhatsApp (link + código).
"""
import base64, json, sys

def main(path):
    c = json.load(open(path, encoding="utf-8"))
    payload = {"v": 1, "id": str(c.get("id") or ""), "m": c["mercado"], "d": c["data"], "t": round(float(c["total"]), 2),
               "i": [[it["nome"], it.get("cat", "Outros"), it.get("por", "unidade"), round(float(it["preco"]), 2), it.get("qtd", 1)] + ([it["id"]] if it.get("id") else [])
                     for it in c["itens"]]}
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    code = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    print("Compra do " + c["mercado"] + " de " + "/".join(reversed(c["data"].split("-"))) + " para o Elida.")
    print("Android: toque no link. iPhone: abra o app Elida, toque em Importar compra do cupom e cole esta mensagem inteira.")
    print()
    print("https://kaleb-nunes.github.io/mercado-da-casa/#importar=" + code)

if __name__ == "__main__":
    main(sys.argv[1])
