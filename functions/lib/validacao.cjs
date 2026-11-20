"use strict";

const CASA_ID = /^[A-Za-z0-9_-]{20,64}$/;
const CONVITE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function textoCurto(valor, campo, maximo) {
  if (typeof valor !== "string") throw new TypeError(campo + " deve ser texto");
  const s = valor.trim();
  if (!s || s.length > maximo || /[<>\u0000-\u001F\u007F]/.test(s)) {
    throw new TypeError(campo + " inválido");
  }
  return s;
}

function emailNormalizado(valor) {
  if (typeof valor !== "string") throw new TypeError("E-mail inválido");
  const email = valor.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError("E-mail inválido");
  }
  return email;
}

function idCasaValido(id) {
  return typeof id === "string" && CASA_ID.test(id);
}

function tokenConviteValido(token) {
  return typeof token === "string" && CONVITE_TOKEN.test(token);
}

function usuarioVerificado(auth) {
  if (!auth || typeof auth.uid !== "string" || !auth.uid) {
    const error = new Error("É necessário fazer login");
    error.code = "unauthenticated";
    throw error;
  }
  const provedor = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (!["google.com", "password"].includes(provedor) || auth.token.email_verified !== true) {
    const error = new Error("Entre com Google ou e-mail verificado");
    error.code = "permission-denied";
    throw error;
  }
  return { uid: auth.uid, email: emailNormalizado(auth.token.email) };
}


/* Limites defensivos, aplicados transacionalmente por Firebase Functions.
   O estado de controle vive em documentos privados inacessíveis ao cliente. */
const LIMITES = Object.freeze({
  casasPorUsuario: 3,
  casasPorDia: 1,
  convitesPorCasaDia: 10
});
function novoConsumo(controle, dia, limite, totalMaximo){
  if(typeof dia!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(dia))throw new TypeError("Dia de quota inválido");
  if(!Number.isInteger(limite) || limite<=0)throw new TypeError("Limite de quota inválido");
  const c=controle && typeof controle==="object" ? controle : {};
  const contagem=c.dia===dia ? (Number.isSafeInteger(c.contagemDia) ? c.contagemDia : 0) : 0;
  const total=Number.isSafeInteger(c.total) ? c.total : 0;
  if(contagem>=limite || (Number.isInteger(totalMaximo) && total>=totalMaximo)){
    const erro=new Error("Limite de operações atingido. Tente novamente mais tarde.");
    erro.code="resource-exhausted";
    throw erro;
  }
  return {dia,contagemDia:contagem+1,total:total+1};
}
function diaUTC(data){return new Date(data).toISOString().slice(0,10);}

module.exports = {
  textoCurto, emailNormalizado, idCasaValido,
  tokenConviteValido, usuarioVerificado, LIMITES, novoConsumo, diaUTC
};
