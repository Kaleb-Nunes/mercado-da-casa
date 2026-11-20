"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  textoCurto, emailNormalizado, idCasaValido,
  tokenConviteValido, usuarioVerificado
} = require("../lib/validacao.cjs");

test("nome é normalizado e recusa HTML, controles e valores vazios", () => {
  assert.equal(textoCurto("  Minha casa  ", "Casa", 60), "Minha casa");
  for (const value of ["", "   ", "<img onerror=alert(1)>", "A\nB", "x".repeat(61), null]) {
    assert.throws(() => textoCurto(value, "Casa", 60), TypeError);
  }
});

test("e-mail de convite é normalizado e validado", () => {
  assert.equal(emailNormalizado("  ANA+TESTE@Exemplo.COM "), "ana+teste@exemplo.com");
  for (const value of ["", "semarroba", "a@@b.com", "a@b", "a b@c.com", "a".repeat(250) + "@b.com"]) {
    assert.throws(() => emailNormalizado(value), TypeError);
  }
});

test("identificador da casa valida base64url com pelo menos 20 caracteres", () => {
  assert.equal(idCasaValido("AbC_defGhijkLMNoPQrsTUVwxyz1"), true);
  assert.equal(idCasaValido("short"), false);
  assert.equal(idCasaValido("../casas/segredo"), false);
  assert.equal(idCasaValido("A".repeat(65)), false);
});

test("token exige 32 bytes base64url, sem rota ou query string", () => {
  assert.equal(tokenConviteValido("a".repeat(43)), true);
  for (const value of ["a".repeat(42), "a".repeat(44), "#convite=" + "a".repeat(43), "../../etc/passwd"]) {
    assert.equal(tokenConviteValido(value), false);
  }
});

test("somente auth com email verificado e não anônimo é aceito", () => {
  const autenticar = (provider, emailVerified, email) => ({
    uid: "uid-um", token: { email, email_verified: emailVerified, firebase: { sign_in_provider: provider } }
  });
  assert.deepEqual(usuarioVerificado(autenticar("google.com", true, " ANA@EXEMPLO.COM ")), {
    uid: "uid-um", email: "ana@exemplo.com"
  });
  assert.deepEqual(usuarioVerificado(autenticar("password", true, "ana@exemplo.com")), {
    uid: "uid-um", email: "ana@exemplo.com"
  });
  assert.throws(() => usuarioVerificado(null), { code: "unauthenticated" });
  assert.throws(() => usuarioVerificado(autenticar("anonymous", true, "a@b.com")), { code: "permission-denied" });
  assert.throws(() => usuarioVerificado(autenticar("facebook.com", true, "a@b.com")), { code: "permission-denied" });
  assert.throws(() => usuarioVerificado(autenticar("custom", true, "a@b.com")), { code: "permission-denied" });
  assert.throws(() => usuarioVerificado(autenticar("google.com", false, "a@b.com")), { code: "permission-denied" });
});


test("limites de famílias são transacionais, por dia e por usuário", () => {
  const {LIMITES, novoConsumo, diaUTC}=require("../lib/validacao.cjs");
  assert.equal(LIMITES.casasPorDia,1);
  assert.equal(LIMITES.casasPorUsuario,3);
  assert.equal(diaUTC("2026-11-20T12:30:00Z"),"2026-11-20");
  const primeiro=novoConsumo(null,"2026-11-20",1,3);
  assert.deepEqual(primeiro,{dia:"2026-11-20",contagemDia:1,total:1});
  assert.throws(()=>novoConsumo(primeiro,"2026-11-20",1,3),{code:"resource-exhausted"});
  const segundo=novoConsumo(primeiro,"2026-11-21",1,3);
  const terceiro=novoConsumo(segundo,"2026-11-22",1,3);
  assert.throws(()=>novoConsumo(terceiro,"2026-11-23",1,3),{code:"resource-exhausted"});
});
test("convites limitados por casa/dia sem consumir cotas em rejeições", () => {
  const {novoConsumo, LIMITES}=require("../lib/validacao.cjs");
  let c=null;
  for(let i=0;i<LIMITES.convitesPorCasaDia;i++) c=novoConsumo(c,"2026-11-20",LIMITES.convitesPorCasaDia);
  assert.equal(c.contagemDia,10);
  assert.throws(()=>novoConsumo(c,"2026-11-20",LIMITES.convitesPorCasaDia),{code:"resource-exhausted"});
  const novo=novoConsumo(c,"2026-11-21",LIMITES.convitesPorCasaDia);
  assert.equal(novo.contagemDia,1);
  assert.equal(novo.total,11);
});
