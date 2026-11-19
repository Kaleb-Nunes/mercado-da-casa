# Piloto Open Food Facts (só leitura)

Ferramenta do piloto de 19/11/2026. Não faz parte do app e não é publicada.

```bash
python3 -I coletar.py  <saida>   # 100 GTINs, ≤13/min; grava <saida>/brutos/<gtin>.json
python3 -I coletar2.py <saida>   # tempo de resposta (20) e busca por nome (20), ≤8/min
python3 -I analisar.py <saida>   # métricas + estados do ElidaRegras; ELIDA_REPO opcional
```

Regras:
- Só GTIN ou nome do produto saem daqui. Perfil, saúde e dados da família nunca saem.
- Respeite 15 leituras/min e 10 buscas/min por IP.
- Dados do OFF: ODbL. Mantenha a atribuição.

Relatório: `docs/elida-ia/PILOTO-OFF.md`.
