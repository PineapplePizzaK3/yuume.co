import fs from "fs"
const checkoutPath = "d:/delivery/site/api/create-checkout-session.js"
let s = fs.readFileSync(checkoutPath, "utf8")
const old1 = `function getParcelowClientConfig() {
  const clientIdRaw = process.env.PARCELOW_CLIENT_ID
  const clientSecret = process.env.PARCELOW_CLIENT_SECRET
  const clientId = Number(clientIdRaw)
  if (!Number.isFinite(clientId) || clientId <= 0 || !clientSecret) return null
  return {
    clientId,
    clientSecret: String(clientSecret),
    baseUrl: normalizeParcelowBaseUrl(),
  }
}`
const new1 = `function getParcelowClientConfig() {
  const clientIdRaw = process.env.PARCELOW_CLIENT_ID
  const clientSecret = String(process.env.PARCELOW_CLIENT_SECRET || "").trim()
  const clientId = parseInt(String(clientIdRaw ?? "").trim(), 10)
  if (!Number.isFinite(clientId) || clientId <= 0 || !clientSecret) return null
  return {
    clientId,
    clientSecret,
    baseUrl: normalizeParcelowBaseUrl(),
  }
}`
if (!s.includes(old1)) { console.error("block1"); process.exit(1) }
s = s.replace(old1, new1)
fs.writeFileSync(checkoutPath, s)
console.log("ok")
