const crypto = require("crypto");
const { json, readBody, requireUser, requireSameOrigin, rateLimit, verifyPayload, canonicalEmail, getLuarAccount, upsertLuarAccount, upsertLuarAccountCompat, adminRequest } = require("./_lib");
const { sanitizeAccountState } = require("./_state-schema");
const { handleCategories } = require("../server/categories");

const cleanState = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const stateHasContent = (state) => ["transactions", "tasks", "habits", "goals", "subscriptions", "wishlist", "investments", "events", "moods", "notes", "focusSessions"].some((key) => Array.isArray(state?.[key]) && state[key].length);
const embeddedImage = (value) => /^data:image\/(?:png|jpe?g|webp);base64,/i.test(String(value || ""));
const snapshotState = (value) => {
  const state = cleanState(value);
  const profile = cleanState(state.profile);
  if (!embeddedImage(profile.avatar) && !embeddedImage(profile.customBanner)) return state;
  const safeProfile = { ...profile };
  if (embeddedImage(safeProfile.avatar)) delete safeProfile.avatar;
  if (embeddedImage(safeProfile.customBanner)) delete safeProfile.customBanner;
  return { ...state, profile: safeProfile };
};
const cleanBackups = (value) => {
  if (!Array.isArray(value)) return [];
  const kept = [];
  let totalBytes = 0;
  for (const candidate of value.slice(0, 10)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const backup = { savedAt: candidate.savedAt || null, state: snapshotState(candidate.state), manual: candidate.manual === true };
    const bytes = Buffer.byteLength(JSON.stringify(backup));
    if (bytes > 1_600_000 || totalBytes + bytes > 16_000_000) break;
    kept.push(backup);
    totalBytes += bytes;
  }
  return kept;
};
const backupSummaries = (value) => cleanBackups(value).filter((backup) => backup.manual).map((backup) => ({ savedAt: backup.savedAt, manual: true, size: Buffer.byteLength(JSON.stringify(backup.state)) }));
const STATE_SCHEMA_VERSION = 1;
const SYNC_V2_ENABLED = process.env.ACCOUNT_SYNC_V2_ENABLED === "true";
const OPERATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_LABELS = new Set(["Celular", "Computador", "Outro dispositivo"]);
const requestFingerprint = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const deterministicOperationId = (fingerprint) => `${fingerprint.slice(0, 8)}-${fingerprint.slice(8, 12)}-${fingerprint.slice(12, 16)}-${fingerprint.slice(16, 20)}-${fingerprint.slice(20, 32)}`;
const syncMetadata = (account) => ({
  revision: Math.max(0, Number(account?.state_revision) || 0),
  schemaVersion: Math.max(1, Number(account?.state_schema_version) || STATE_SCHEMA_VERSION),
  lastSyncedAt: account?.last_synced_at || account?.state_updated_at || null,
  lastSyncDevice: DEVICE_LABELS.has(account?.last_sync_device_label) ? account.last_sync_device_label : null,
});
const requestedRevision = (body, account) => {
  if (Number.isSafeInteger(body.baseRevision) && body.baseRevision >= 0) return body.baseRevision;
  const current = syncMetadata(account).revision;
  const suppliedTimestamp = body.baseUpdatedAt || null;
  const currentTimestamp = account?.state_updated_at || null;
  if (suppliedTimestamp === currentTimestamp || (!suppliedTimestamp && !currentTimestamp)) return current;
  return -1;
};
const saveStateAtomically = async ({ user, account, operationId, fingerprint, expectedRevision, state, backups, schemaVersion, deviceLabel }) => {
  let rows;
  try {
    rows = await adminRequest("rpc/save_luar_account_state_v2", { method: "POST", body: JSON.stringify({ p_email: canonicalEmail(user), p_user_id: user.id, p_operation_id: operationId, p_operation_fingerprint: fingerprint, p_expected_revision: expectedRevision, p_state: state, p_backups: backups, p_state_schema_version: schemaVersion, p_device_label: deviceLabel }) });
  } catch (error) {
    if (String(error.storageMessage || "").includes("SYNC_IDEMPOTENCY_MISMATCH")) throw new Error("SYNC_IDEMPOTENCY_MISMATCH");
    throw error;
  }
  const result = Array.isArray(rows) ? rows[0] : null;
  if (!result) throw new Error("SYNC_STORAGE_INVALID");
  return { ...account, state: cleanState(result.result_state), backups: cleanBackups(result.result_backups), state_revision: Number(result.result_revision) || 0, state_schema_version: schemaVersion, state_updated_at: result.result_state_updated_at || null, last_synced_at: result.result_last_synced_at || null, last_sync_device_label: result.result_device_label || null, syncStatus: result.result_status };
};

const ensureAccount = async (user) => {
  const email = canonicalEmail(user);
  const metadata = user.user_metadata || {};
  const legacyLicense = verifyPayload(metadata.luar_lifetime_license);
  const legacyLifetime = Boolean(legacyLicense && legacyLicense.type === "lifetime" && legacyLicense.uid === user.id && (!legacyLicense.email || String(legacyLicense.email).trim().toLowerCase() === email) && legacyLicense.plan === "LUAR_VITALICIO");
  let account = await getLuarAccount(email);
  const userIds = [...new Set([...(Array.isArray(account?.user_ids) ? account.user_ids : []), user.id])];
  if (!account || legacyLifetime || !account.user_ids?.includes(user.id)) {
    account = await upsertLuarAccountCompat({
      email,
      user_ids: userIds,
      plan: account?.plan === "lifetime" || legacyLifetime ? "lifetime" : "free",
      lifetime_paid_at: account?.lifetime_paid_at || (legacyLifetime ? legacyLicense.paidAt || new Date().toISOString() : null),
      lifetime_transaction_id: account?.lifetime_transaction_id || (legacyLifetime ? legacyLicense.transactionId || null : null),
      state: Object.keys(cleanState(account?.state)).length ? account.state : cleanState(metadata.luar_state),
      state_updated_at: account?.state_updated_at || metadata.luar_updated_at || null,
      backups: cleanBackups(account?.backups?.length ? account.backups : metadata.luar_backups),
      updated_at: new Date().toISOString(),
    }, legacyLifetime ? { lifetime_source: "legacy" } : {});
  }
  return account;
};

module.exports = async (req, res) => {
  try {
    if (!["GET", "PUT", "POST", "DELETE"].includes(req.method)) return json(res, 405, { error: "Método não permitido." });
    const requestUrl = new URL(req.url || "/", "https://luarhub.site");
    if (req.method === "GET" && requestUrl.searchParams.get("securityHealth") === "rls") {
      await rateLimit(req, "security-health", 15, 10 * 60 * 1000);
      const posture = await adminRequest("rpc/luar_security_posture", { method: "POST", body: "{}" });
      if (!posture || posture.ok !== true || !Array.isArray(posture.violations) || posture.violations.length) {
        return json(res, 503, { ok: false, rls: false, authorization: false });
      }
      const categoryTable = await adminRequest("luar_categories?select=id&limit=1");
      return json(res, 200, { ok: true, rls: true, authorization: true, categories: Array.isArray(categoryTable) });
    }
    requireSameOrigin(req, req.method !== "GET");
    await rateLimit(req, "account-state", req.method === "GET" ? 90 : 45, 10 * 60 * 1000);
    const user = await requireUser(req);
    await rateLimit(req, "account-state-user", req.method === "GET" ? 120 : 50, 10 * 60 * 1000, user.id);
    let account = await ensureAccount(user);

    if (requestUrl.searchParams.get("resource") === "categories") {
      return handleCategories(req, res, user, requestUrl);
    }
    if (req.method === "DELETE") return json(res, 405, { error: "Método não permitido." });

    if (req.method === "POST") {
      const body = await readBody(req, 4_096);
      if (body.action !== "restoreBackup") return json(res, 400, { error: "Ação inválida." });
      if (account?.plan !== "lifetime" || !account.user_ids?.includes(user.id)) return json(res, 403, { error: "Backup disponível somente no LUAR Vitalício." });
      const savedAt = String(body.savedAt || "");
      const existingBackups = cleanBackups(account.backups);
      const backup = existingBackups.find((item) => item.manual && item.savedAt === savedAt);
      if (!backup) return json(res, 404, { error: "Esta versão não foi encontrada." });
      const updatedAt = new Date().toISOString();
      const rollback = { savedAt: updatedAt, state: snapshotState(account.state), manual: true };
      const backups = cleanBackups([rollback, ...existingBackups]);
      let operationId = null;
      if (SYNC_V2_ENABLED) {
        const expectedRevision = requestedRevision(body, account);
        if (expectedRevision < 0 || expectedRevision !== syncMetadata(account).revision) return json(res, 409, { error: "Existe uma versão mais recente desta conta.", conflict: true, state: cleanState(account.state), updatedAt: account.state_updated_at || null, ...syncMetadata(account), backups: backupSummaries(account.backups) });
        const fingerprint = requestFingerprint({ action: "restoreBackup", savedAt, expectedRevision, state: snapshotState(backup.state) });
        operationId = OPERATION_ID.test(String(body.operationId || "")) ? String(body.operationId) : deterministicOperationId(fingerprint);
        const deviceLabel = DEVICE_LABELS.has(body.deviceLabel) ? body.deviceLabel : "Outro dispositivo";
        account = await saveStateAtomically({ user, account, operationId, fingerprint, expectedRevision, state: snapshotState(backup.state), backups, schemaVersion: STATE_SCHEMA_VERSION, deviceLabel });
      } else {
        account = await upsertLuarAccount({ email: canonicalEmail(user), user_ids: [...new Set([...(account.user_ids || []), user.id])], plan: "lifetime", state: snapshotState(backup.state), state_updated_at: updatedAt, backups, updated_at: updatedAt });
      }
      return json(res, 200, {
        savedAt: backup.savedAt,
        state: cleanState(account.state),
        updatedAt: account.state_updated_at || updatedAt,
        ...syncMetadata(account),
        operationId,
        duplicate: account.syncStatus === "duplicate",
        syncV2Enabled: SYNC_V2_ENABLED,
        backups: backupSummaries(account.backups),
      });
    }

    if (req.method === "PUT") {
      const body = await readBody(req, 2_000_000);
      const lifetime = account?.plan === "lifetime";
      const incoming = sanitizeAccountState(body.state, { lifetime, previousState: cleanState(account.state) });
      const serialized = JSON.stringify(incoming);
      if (Buffer.byteLength(serialized) > 1_500_000) return json(res, 413, { error: "O backup excedeu o tamanho permitido." });
      const updatedAt = new Date().toISOString();
      const previous = cleanState(account.state);
      if (stateHasContent(previous) && !stateHasContent(incoming) && body.allowEmpty !== true) return json(res, 409, { error: "O salvamento vazio foi bloqueado para proteger seus dados." });
      const currentRevision = syncMetadata(account).revision;
      const baseRevision = requestedRevision(body, account);
      const legacyConflict = !SYNC_V2_ENABLED && stateHasContent(previous) && account.state_updated_at && body.baseUpdatedAt !== account.state_updated_at;
      if ((SYNC_V2_ENABLED && (baseRevision < 0 || baseRevision !== currentRevision)) || legacyConflict) {
        return json(res, 409, {
          error: "Existe uma versão mais recente desta conta.",
          conflict: true,
          state: previous,
          updatedAt: account.state_updated_at || null,
          ...syncMetadata(account),
          backups: account?.plan === "lifetime" ? backupSummaries(account.backups) : [],
        });
      }
      const existingBackups = cleanBackups(account.backups);
      const changed = JSON.stringify(previous) !== serialized;
      const automaticRollback = changed && stateHasContent(previous) ? [{ savedAt: updatedAt, state: snapshotState(previous), manual: false }] : [];
      const manualSnapshot = body.createBackup === true ? [{ savedAt: updatedAt, state: snapshotState(incoming), manual: true }] : [];
      const backups = cleanBackups([...manualSnapshot, ...automaticRollback, ...existingBackups]);
      if (SYNC_V2_ENABLED) {
        const schemaVersion = Number.isSafeInteger(body.schemaVersion) && body.schemaVersion >= 1 && body.schemaVersion <= 1000 ? body.schemaVersion : STATE_SCHEMA_VERSION;
        const deviceLabel = DEVICE_LABELS.has(body.deviceLabel) ? body.deviceLabel : "Outro dispositivo";
        const fingerprint = requestFingerprint({ state: incoming, createBackup: body.createBackup === true, allowEmpty: body.allowEmpty === true, baseRevision, schemaVersion });
        const operationId = OPERATION_ID.test(String(body.operationId || "")) ? String(body.operationId) : deterministicOperationId(fingerprint);
        account = await saveStateAtomically({ user, account, operationId, fingerprint, expectedRevision: baseRevision, state: incoming, backups, schemaVersion, deviceLabel });
        if (account.syncStatus === "conflict") return json(res, 409, { error: "Existe uma versão mais recente desta conta.", conflict: true, state: cleanState(account.state), updatedAt: account.state_updated_at || null, ...syncMetadata(account), backups: lifetime ? backupSummaries(account.backups) : [] });
      } else {
        account = await upsertLuarAccount({ email: canonicalEmail(user), user_ids: [...new Set([...(account.user_ids || []), user.id])], plan: lifetime ? "lifetime" : "free", state: incoming, state_updated_at: updatedAt, backups, updated_at: updatedAt });
      }
    }

    const lifetime = account?.plan === "lifetime";
    return json(res, 200, { email: canonicalEmail(user), lifetime, paidAt: lifetime ? account.lifetime_paid_at : null, state: cleanState(account.state), updatedAt: account.state_updated_at || null, ...syncMetadata(account), duplicate: account.syncStatus === "duplicate", syncV2Enabled: SYNC_V2_ENABLED, backups: lifetime ? backupSummaries(account.backups) : [] });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas solicitações. Aguarde alguns minutos." });
    if (error.message === "BODY_TOO_LARGE") return json(res, 413, { error: "Backup muito grande." });
    if (error.message === "BODY_INVALID") return json(res, 400, { error: "Solicitação inválida." });
    if (error.message === "PLAN_LIMIT") return json(res, 403, { error: "Este estado ultrapassa os limites permitidos pelo seu plano." });
    if (error.message === "STATE_LIMIT") return json(res, 413, { error: "O estado contém registros demais." });
    if (error.message === "STATE_INVALID") return json(res, 400, { error: "O estado da conta contém dados inválidos." });
    if (error.message === "SYNC_IDEMPOTENCY_MISMATCH") return json(res, 409, { error: "O identificador desta operação já foi utilizado com outro conteúdo." });
    if (error.categoryCode === "CATEGORY_DUPLICATE") return json(res, 409, { error: "Já existe uma categoria com esse nome nesta área." });
    if (error.categoryCode === "CATEGORY_NOT_FOUND") return json(res, 404, { error: "Categoria não encontrada." });
    if (String(error.categoryCode || "").startsWith("CATEGORY_")) return json(res, 400, { error: "Os dados da categoria são inválidos." });
    const auth = String(error.message).startsWith("AUTH_") || error.message === "EMAIL_REQUIRED";
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão ou e-mail não confirmado." : "Não foi possível acessar os dados da conta." });
  }
};
