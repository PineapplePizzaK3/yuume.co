/**
 * One-off / utility: raster com fundo preto → PNG RGBA (para hero da home).
 * Uso: node scripts/black-bg-to-alpha.mjs <entrada> <saida.png>
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [,, inPath, outPath] = process.argv
if (!inPath || !outPath) {
  console.error('Uso: node scripts/black-bg-to-alpha.mjs <entrada> <saida.png>')
  process.exit(1)
}

const absIn = path.resolve(inPath)
const absOut = path.resolve(outPath)
if (!fs.existsSync(absIn)) {
  console.error('Arquivo não encontrado:', absIn)
  process.exit(1)
}

// Pixels “preto de fundo” (com folga para JPEG / bordas escuras)
const MAX_RGB = 22
const SUM_RGB = 55

const { data, info } = await sharp(absIn).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const buf = Buffer.from(data)
for (let i = 0; i < buf.length; i += 4) {
  const r = buf[i]
  const g = buf[i + 1]
  const b = buf[i + 2]
  if (r <= MAX_RGB && g <= MAX_RGB && b <= MAX_RGB && r + g + b <= SUM_RGB) {
    buf[i + 3] = 0
  }
}

await sharp(buf, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png({ compressionLevel: 9 })
  .toFile(absOut)

console.log('OK →', absOut, `${info.width}x${info.height}`)
