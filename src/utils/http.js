export function httpError(res, code, message, extra) {
  if (process.env.NODE_ENV !== "test") {
    console.warn(`[http] ${code} ${message}`);
  }
  return res.status(code).json({ error: message, ...(extra || {}) });
}



export const asyncWrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
