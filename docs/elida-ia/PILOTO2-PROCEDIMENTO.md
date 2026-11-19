# Segundo piloto: cobertura na cesta real, com embalagem na mão

Status: **preparado, não executado.** Só começa com a sua autorização e com os códigos que você escolher.

## Regras

- Entram só códigos de barras que você escolher, de 30 a 50. Nada é puxado do histórico de compras, dos perfis ou dos backups.
- O arquivo tem uma coluna `gtin` e, se quiser, `apelido` (nome curto do produto). O script recusa qualquer outra coluna e qualquer código com dígito verificador errado.
- Nenhum perfil, restrição ou dado de saúde sai do aparelho ou entra no arquivo.
- As fotos das embalagens ficam com vocês. A leitura por foto no app é local e nada é enviado.

## Passo a passo

1. **Escolher os produtos (10 min):** de 30 a 50 itens que vocês compram de verdade, misturando marcas grandes, regionais e de mercado (marca própria).
2. **Montar o CSV:** uma linha por código (por exemplo `gtin,apelido` e depois `7891000100103,achocolatado`).
3. **Rodar a consulta (cerca de 4 min para 50 códigos):**
   ```bash
   python3 -I tools/piloto-off/piloto2.py codigos.csv saida-piloto2 seu-email@exemplo.com
   ```
   Saem `metricas.json` (encontrados, com ingredientes, com alergênicos, erros e tempo) e `conferencia-embalagem.csv`.
4. **Conferir com a embalagem (cerca de 1 min por produto):** com o produto na mão, preencha as colunas em MAIÚSCULAS do `conferencia-embalagem.csv`:
   - se é o mesmo produto e a mesma variante;
   - se os ingredientes conferem;
   - o que a embalagem diz em CONTÉM, PODE CONTER e glúten.
5. **Testar a foto no app de homologação:** em Rótulos, use "Ler rótulo por foto" e anote na coluna `LEITURA_POR_FOTO_NO_APP` se a leitura passou ou deu "insuficiente". Isso mede o leitor no **seu** celular, que a bancada não mediu.
6. **Me mandar** o CSV preenchido e o `metricas.json`. Eu calculo:
   - cobertura real do OFF;
   - quantas vezes o OFF omitiu alergênico em relação à embalagem;
   - quantas fotos passaram e quanto tempo levaram.

## Critérios para decidir

| Medida | Avançar | Ajustar | Descartar o OFF |
|---|---|---|---|
| Ingredientes no OFF | ≥ 60% | 40–59% | < 40% |
| OFF omitiu "contém" ou "pode conter" que está na embalagem | 0 | 1–2 casos | ≥ 3 casos |
| Fotos que passam no celular | ≥ 70% | 50–69% | < 50% (então vale avaliar leitor nativo) |

Mesmo em "Avançar", o dado do OFF continua sendo rascunho. A conferência na embalagem segue obrigatória.
