"use strict";

// Backend privado para contas familiares. NÃO ativar o sync legado do index.html.
// O Admin SDK é o único responsável por criar casas, emitir e aceitar convites
// e conceder/revogar membros. Requer Firebase App Check e Authentication real.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
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

/**
 * Criação atomicamente autorizada: não basta possuir um ID aleatório.
 * Exige login não anônimo, verificação de e-mail e App Check.
 */
exports.criarCasa = onCall(OPCOES, async (req) => {
  const u = usuario(req);
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
  const u = usuario(req);
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
  const u = usuario(req);
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
  const u = usuario(req);
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
