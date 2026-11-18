#!/bin/sh
# Homologação no computador: roda os testes e serve o app em http://localhost:8080
# Fora do endereço publicado o app entra em homologação: faixa no topo, dados com
# prefixo hml: (separados dos dados da família) e Firebase de produção bloqueado.
set -e
cd "$(dirname "$0")/.."
node tests/rodar-testes.js
echo "Abrindo em http://localhost:8080 (Ctrl+C para parar)"
python3 -m http.server 8080
