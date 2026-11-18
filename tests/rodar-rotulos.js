#!/usr/bin/env node
/* Bateria de rótulos reais: mede o que o app faz quando a família digita o nome
   de um produto real cuja referência foi tirada do RÓTULO, não da lista do app.
   É um diagnóstico: não falha o CI. A referência está pendente de conferência
   na embalagem e de revisão por profissional de saúde.
   Uso: node tests/rodar-rotulos.js */
"use strict";
var path = require("path");
var D = require("../dieta.js");
var B = require("./rotulos-reais.json");
var dieta = D.dietaDoModelo("sem-leite");
var HOJE = "2026-11-18";

var linhas = [], cont = {};
B.itens.forEach(function (it) {
  var pelo_nome = D.avaliar(it.nome_no_rotulo, dieta, { hoje: HOJE });
  var pelo_rotulo = D.avaliar(it.trecho_do_rotulo + " " + it.advertencia_alergicos, dieta, { hoje: HOJE });
  var ref = it.referencia_rotulo, k = ref + " → " + pelo_nome.estado;
  cont[k] = (cont[k] || 0) + 1;
  linhas.push([it.id, ref, pelo_nome.estado + (pelo_nome.termo ? " (" + pelo_nome.termo + ")" : ""),
    pelo_rotulo.estado, it.nome_no_rotulo + " · " + it.marca, it.fonte_tipo].join(" | "));
});

console.log(B.titulo + " — " + B.status);
console.log("id | referência pelo rótulo | app pelo nome | o mesmo motor lendo o trecho do rótulo | produto | fonte");
linhas.forEach(function (l) { console.log(l); });
console.log("");
console.log("Resumo (referência → o que o app mostra só pelo nome):");
Object.keys(cont).sort().forEach(function (k) { console.log("  " + k + ": " + cont[k]); });
var comLeite = B.itens.filter(function (i) { return i.referencia_rotulo === "CONTEM_LEITE"; });
var pegos = comLeite.filter(function (i) { return D.avaliar(i.nome_no_rotulo, dieta, { hoje: HOJE }).estado === "evitar"; });
var silencio = B.itens.filter(function (i) { var e = D.avaliar(i.nome_no_rotulo, dieta, { hoje: HOJE }).estado; return e !== "evitar" && e !== "insuficiente"; });
console.log("Produtos com leite pelo rótulo: " + comLeite.length + " · o nome sozinho dispara \"evitar\" em " + pegos.length +
  " · os outros ficam em \"informação insuficiente\" · silêncio ou \"conferido\": " + silencio.length);
console.log("Itens a completar na loja ou em casa: " + B.a_preencher.length + " (ver protocolo em tests/rotulos-reais.json).");
