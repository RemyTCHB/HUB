// /api/hub/<op>: the hub's own endpoints in one Vercel function (the plan allows 12 functions per deployment), each kept
// in api/_lib/hubops/<op>.js: delete, digest, login-as, passwords, upload. The addresses are the same as before.
const OPS = {
  delete: () => require('../_lib/hubops/delete'),
  digest: () => require('../_lib/hubops/digest'),
  'login-as': () => require('../_lib/hubops/login-as'),
  passwords: () => require('../_lib/hubops/passwords'),
  upload: () => require('../_lib/hubops/upload'),
};

module.exports = (req, res) => {
  const op = (req.query && req.query.op) || String(req.url || '').split('?')[0].split('/').filter(Boolean).pop();
  const handler = Object.prototype.hasOwnProperty.call(OPS, op) && OPS[op]();
  if (!handler) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); return res.end('{"error":"Not found."}'); }
  return handler(req, res);
};
