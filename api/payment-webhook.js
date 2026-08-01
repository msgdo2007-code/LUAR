const { json } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  // A confirmação final é consultada diretamente na Pushin Pay pelo endpoint protegido.
  return json(res, 200, { received: true });
};
