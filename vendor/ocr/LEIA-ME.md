# Leitor de rótulos local (OCR)

Tudo roda no aparelho, e nenhuma imagem sai dele. Os arquivos ficam neste site, nunca em CDN. Cada aparelho baixa uma vez só (cerca de 5 MB, uma das três variantes do núcleo) e depois funciona offline.

| Arquivo | Origem | Licença |
|---|---|---|
| `tesseract.min.js`, `worker.min.js` | tesseract.js 7.0.0 (npm) | Apache-2.0 (`LICENSE-tesseract.js.md`) |
| `tesseract-core-*-lstm.wasm.js` | tesseract.js-core 7.0.0 (npm) | Apache-2.0 (`LICENSE-tesseract.js-core`) |
| `por.traineddata.gz` | @tesseract.js-data/por 1.0.0, pasta `4.0.0_best_int` (modelo tessdata_best do Tesseract, português) | modelo Apache-2.0; empacotamento npm MIT |

Por que existem três núcleos: o navegador escolhe sozinho o que o aparelho suporta (relaxed SIMD, SIMD ou nenhum dos dois).

As linhas `sourceMappingURL` foram removidas dos `.min.js`, porque os `.map` não vêm junto. Fora isso, os arquivos não foram alterados.
