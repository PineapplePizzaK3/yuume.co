/** Lets Node import the app's extensionless ESM files. */
export function resolve(specifier, context, nextResolve) {
  const local = specifier.startsWith('./') || specifier.startsWith('../')
  if (local && !/\.[a-z0-9]+$/i.test(specifier)) {
    return nextResolve(`${specifier}.js`, context)
  }
  return nextResolve(specifier, context)
}
