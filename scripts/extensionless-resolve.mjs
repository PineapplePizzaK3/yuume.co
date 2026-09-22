import { existsSync } from 'node:fs'
import { dirname, extname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function hasKnownExt(specifier) {
  return /\.[cm]?[jt]sx?$/.test(specifier)
}

function tryWithJs(parentURL, specifier) {
  if (!parentURL || hasKnownExt(specifier)) return null
  if (!(specifier.startsWith('.') || specifier.startsWith('/'))) return null
  try {
    const parentPath = fileURLToPath(parentURL)
    const abs = resolvePath(dirname(parentPath), specifier)
    const withJs = `${abs}.js`
    if (existsSync(withJs)) return pathToFileURL(withJs).href
  } catch {
    return null
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  const rewritten = tryWithJs(context.parentURL, specifier)
  if (rewritten) {
    return {
      shortCircuit: true,
      url: rewritten,
    }
  }
  return nextResolve(specifier, context)
}
