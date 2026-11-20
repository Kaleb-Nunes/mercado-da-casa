"use strict";

// Backend privado para contas familiares. NÃO ativar o sync legado do index.html.
// O Admin SDK é o único responsável por criar casas, emitir e aceitar convites
// e conceder/revogar membros. Requer Firebase App Check e Authentication real.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { randomBytes, createHash } = require("node:crypto");
const validacao = require("./lib/validacao.cjs");

initializeApp();
const db = getFirestore();
const OPCOES = Object.freeze({
  region: "southamerica-east1",
  enforceAppCheck: true,
  maxInstances: 2,
  minInstances: 0,
  memory: "256MiB",
  timeoutSeconds: 30
});
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/* O proprietário deve fixar o UID Firebase da própria conta em ELIDA_SUPERADMIN_UID
   via configuração do deploy. Nunca aceitar e-mail ou UID enviados pelo cliente
   como prova de administração. Sem UID configurado, tudo falha fechado. */
const SUPERADMIN_UID = String(process.env.ELIDA_SUPERADMIN_UID || "").trim();
function proprietario(req) {
  return SUPERADMIN_UID.length >= 12 &&
    req.auth && req.auth.uid === SUPERADMIN_UID;
}
function exigirProprietario(req) {
  const u = usuario(req);
  if (!proprietario(req)) semPermissao();
  return u;
}
async function exigirAprovado(req) {
  const u=usuario(req);
  if(proprietario(req)) return u;
  const registro=await db.collection("acessos").doc(u.uid).get();
  if(!registro.exists || registro.data().status!=="aprovado"){
    throw new HttpsError("permission-denied","Sua conta ainda não foi autorizada");
  }
  return u;
}
function uidValido(uid){
  return typeof uid==="string" && /^[A-Za-z0-9_-]{6,128}$/.test(uid);
}


function usuario(req) {
  try {
    return validacao.usuarioVerificado(req.auth);
  } catch (err) {
    throw new HttpsError(err.code || "unauthenticated", err.message);
  }
}
function entrada(fn) {
  try { return fn(); }
  catch (err) { throw new HttpsError("invalid-argument", err.message); }
}
function casaRef(id) { return db.collection("casas").doc(id); }
function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
function semPermissao() {
  throw new HttpsError("permission-denied", "Você não tem permissão nesta casa");
}
function exigirDono(membro, uid) {
  if (!membro.exists ||
      membro.data().ativo !== true ||
      membro.data().papel !== "dono" ||
      membro.id !== uid) semPermissao();
}


/** Consulta do próprio status. Não expõe listagens nem dados de outros usuários. */
exports.meuAcesso = onCall(OPCOES, async (req) => {
  const u=usuario(req);
  if(proprietario(req)){
    const ref=db.collection("acessos").doc(u.uid);
    const anterior=await ref.get();
    if(!anterior.exists || anterior.data().status!=="aprovado" ||
       anterior.data().papel!=="superadmin"){
      await ref.set({uid:u.uid,email:u.email,status:"aprovado",papel:"superadmin",
        atualizadoEm:FieldValue.serverTimestamp()}, {merge:true});
    }
    return {status:"aprovado",papel:"superadmin"};
  }
  const registro=await db.collection("acessos").doc(u.uid).get();
  if(registro.exists) return {status:registro.data().status || "nao_solicitado",papel:"usuario"};
  const pedido=await db.collection("solicitacoesAcesso").doc(u.uid).get();
  return {status:pedido.exists ? (pedido.data().status || "pendente") : "nao_solicitado",papel:"usuario"};
});

/** Um pedido por UID; somente login verificado. Reenviar não contorna bloqueios. */
exports.solicitarAcesso = onCall(OPCOES, async (req) => {
  const u=usuario(req);
  if(proprietario(req)) return {status:"aprovado",papel:"superadmin"};
  const acessoRef=db.collection("acessos").doc(u.uid);
  const pedidoRef=db.collection("solicitacoesAcesso").doc(u.uid);
  return db.runTransaction(async (tx) => {
    const [acesso,pedido]=await Promise.all([tx.get(acessoRef),tx.get(pedidoRef)]);
    if(acesso.exists){
      const status=acesso.data().status;
      if(status==="aprovado") return {status:"aprovado"};
      if(status==="bloqueado" || status==="rejeitado")
        throw new HttpsError("permission-denied","Solicitação indisponível. Contate o administrador.");
    }
    if(pedido.exists) return {status:pedido.data().status || "pendente"};
    tx.create(pedidoRef,{uid:u.uid,email:u.email,status:"pendente",
      criadoEm:FieldValue.serverTimestamp(),atualizadoEm:FieldValue.serverTimestamp()});
    return {status:"pendente"};
  });
});

/** Listagem administrativa, autorizada por UID no servidor, nunca por um campo de UI. */
exports.listarSolicitacoes = onCall(OPCOES, async (req) => {
  exigirProprietario(req);
  const docs=await db.collection("solicitacoesAcesso").where("status","==","pendente")
    .limit(50).get();
  return {solicitacoes:docs.docs.map(d=>({
    uid:d.id,email:d.data().email||"",status:"pendente"
  }))};
});

/** Aprovação, rejeição ou bloqueio com autor autenticado e trilha mínima de auditoria. */
exports.decidirAcesso = onCall(OPCOES, async (req) => {
  const adm=exigirProprietario(req);
  const uid=req.data && req.data.uid;
  const decisao=req.data && req.data.decisao;
  if(!uidValido(uid) || uid===SUPERADMIN_UID ||
     !["aprovar","rejeitar","bloquear"].includes(decisao))
    throw new HttpsError("invalid-argument","Decisão ou usuário inválido");
  const alvo=await getAuth().getUser(uid);
  if(alvo.disabled || !alvo.emailVerified || !alvo.email)
    throw new HttpsError("failed-precondition","Conta não verificada ou indisponível");
  const email=validacao.emailNormalizado(alvo.email);
  const acessoRef=db.collection("acessos").doc(uid);
  const pedidoRef=db.collection("solicitacoesAcesso").doc(uid);
  const status=decisao==="aprovar"?"aprovado":decisao==="rejeitar"?"rejeitado":"bloqueado";
  await db.runTransaction(async tx=>{
    const [pedido,acesso]=await Promise.all([tx.get(pedidoRef),tx.get(acessoRef)]);
    if(!pedido.exists && !acesso.exists)
      throw new HttpsError("not-found","Nenhuma solicitação ou conta encontrada");
    if(pedido.exists && pedido.data().email!==email)
      throw new HttpsError("failed-precondition","E-mail da conta foi alterado");
    tx.set(acessoRef,{uid,email,status,papel:"usuario",
      aprovadoPor:adm.uid,atualizadoEm:FieldValue.serverTimestamp()},{merge:true});
    if(pedido.exists)tx.update(pedidoRef,{
      status,decididoPor:adm.uid,atualizadoEm:FieldValue.serverTimestamp()
    });
  });
  return {status,uid};
});

/** Para gerenciar quem já foi aprovado ou bloqueado, sem ler famílias. */
exports.listarAcessos = onCall(OPCOES, async(req)=>{
  exigirProprietario(req);
  const snap=await db.collection("acessos").limit(50).get();
  return {usuarios:snap.docs.filter(d=>d.id!==SUPERADMIN_UID).map(d=>({
    uid:d.id,email:d.data().email||"",status:d.data().status||"desconhecido"
  }))};
});


/**
 * Criação atomicamente autorizada: não basta possuir um ID aleatório.
 * Exige login não anônimo, verificação de e-mail e App Check.
 */
exports.criarCasa = onCall(OPCOES, async (req) => {
  const u = await exigirAprovado(req);
  const nome = entrada(() => validacao.textoCurto(req.data && req.data.nome, "Nome da casa", 60));
  const pessoa = entrada(() => validacao.textoCurto(req.data && req.data.pessoa, "Seu nome", 60));
  const id = randomBytes(20).toString("base64url");
  const ref = casaRef(id);
  const membro = ref.collection("membros").doc(u.uid);
  const quotaRef = db.collection("limitesUsuarios").doc(u.uid);

  await db.runTransaction(async (tx) => {
    const quotaAtual = await tx.get(quotaRef);
    let quota;
    try {
      quota = validacao.novoConsumo(quotaAtual.exists ? quotaAtual.data() : null,
        validacao.diaUTC(Date.now()), validacao.LIMITES.casasPorDia,
        validacao.LIMITES.casasPorUsuario);
    } catch (err) {
      throw new HttpsError(err.code === "resource-exhausted" ? err.code : "internal",
        "Limite de criação de famílias atingido");
    }
    tx.set(quotaRef, quota);
    tx.create(ref, {
      nome, criada: FieldValue.serverTimestamp(),
      v: 1, criador: u.uid
    });
    tx.create(membro, {
      ativo: true, papel: "dono", nome: pessoa, email: u.email,
      criada: FieldValue.serverTimestamp()
    });
  });
  return { casaId: id, nome };
});

/**
 * Convite único, vinculado a um e-mail, com duração de até 24h.
 * O segredo em texto puro é retornado somente ao titular, nunca persistido.
 */
exports.criarConvite = onCall(OPCOES, async (req) => {
  const u = await exigirAprovado(req);
  const casaId = req.data && req.data.casaId;
  if (!validacao.idCasaValido(casaId)) {
    throw new HttpsError("invalid-argument", "Casa inválida");
  }
  const destinatario = entrada(() => validacao.emailNormalizado(req.data.email));
  if (destinatario === u.email) {
    throw new HttpsError("invalid-argument", "Use o e-mail de outro familiar");
  }
  const ref = casaRef(casaId);
  const token = randomBytes(32).toString("base64url");
  const hash = hashToken(token);
  const conviteRef = ref.collection("convites").doc(hash);
  const quotaRef = db.collection("limitesConvites").doc(casaId);
  const expiraEm = Date.now() + UM_DIA_MS;

  await db.runTransaction(async (tx) => {
    const [membro, quotaAtual] = await Promise.all([
      tx.get(ref.collection("membros").doc(u.uid)), tx.get(quotaRef)
    ]);
    exigirDono(membro, u.uid);
    let quota;
    try {
      quota = validacao.novoConsumo(quotaAtual.exists ? quotaAtual.data() : null,
        validacao.diaUTC(Date.now()), validacao.LIMITES.convitesPorCasaDia);
    } catch (err) {
      throw new HttpsError(err.code === "resource-exhausted" ? err.code : "internal",
        "Limite diário de convites atingido");
    }
    tx.set(quotaRef, quota);
    tx.create(conviteRef, {
      email: destinatario,
      criadoPor: u.uid,
      criadoEm: FieldValue.serverTimestamp(),
      expiraEm: Timestamp.fromMillis(expiraEm),
      usado: false
    });
  });
  return { casaId, token, expiraEm };
});

/** O uso do token é transacional e está associado ao e-mail verificado. */
exports.aceitarConvite = onCall(OPCOES, async (req) => {
  const u = await exigirAprovado(req);
  const casaId = req.data && req.data.casaId;
  const token = req.data && req.data.token;
  const pessoa = entrada(() => validacao.textoCurto(req.data && req.data.pessoa, "Seu nome", 60));
  if (!validacao.idCasaValido(casaId) || !validacao.tokenConviteValido(token)) {
    throw new HttpsError("invalid-argument", "Convite inválido");
  }
  const ref = casaRef(casaId);
  const conviteRef = ref.collection("convites").doc(hashToken(token));
  const membroRef = ref.collection("membros").doc(u.uid);

  const nome = await db.runTransaction(async (tx) => {
    const [casa, convite, membro] = await Promise.all([
      tx.get(ref), tx.get(conviteRef), tx.get(membroRef)
    ]);
    const dados = convite.exists && convite.data();
    if (!casa.exists || !dados || dados.usado === true ||
        dados.email !== u.email || !dados.expiraEm ||
        dados.expiraEm.toMillis() <= Date.now()) {
      throw new HttpsError("permission-denied", "Convite inválido ou expirado");
    }
    if (membro.exists && membro.data().ativo === true) {
      throw new HttpsError("already-exists", "Você já participa desta casa");
    }
    tx.set(membroRef, {
      ativo: true, papel: "membro", nome: pessoa, email: u.email,
      criada: FieldValue.serverTimestamp()
    });
    tx.update(conviteRef, {
      usado: true, usadoPor: u.uid, usadoEm: FieldValue.serverTimestamp()
    });
    return casa.data().nome;
  });
  return { casaId, nome };
});

/** Apenas o titular pode desativar outra pessoa; não revoga o próprio titular. */
exports.revogarMembro = onCall(OPCOES, async (req) => {
  const u = await exigirAprovado(req);
  const casaId = req.data && req.data.casaId;
  const uid = req.data && req.data.uid;
  if (!validacao.idCasaValido(casaId) ||
      typeof uid !== "string" || !uid || uid.length > 128 || uid === u.uid) {
    throw new HttpsError("invalid-argument", "Membro inválido");
  }
  const ref = casaRef(casaId);
  await db.runTransaction(async (tx) => {
    const donoRef = ref.collection("membros").doc(u.uid);
    const outroRef = ref.collection("membros").doc(uid);
    const [dono, alvo] = await Promise.all([tx.get(donoRef), tx.get(outroRef)]);
    exigirDono(dono, u.uid);
    if (!alvo.exists || alvo.data().papel === "dono") semPermissao();
    tx.update(outroRef, {
      ativo: false, revogadoEm: FieldValue.serverTimestamp()
    });
  });
  return { revogado: true };
});
