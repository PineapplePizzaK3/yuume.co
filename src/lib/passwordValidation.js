/**
 * Validação de senha conforme requisitos do sistema:
 * - Mínimo 8 caracteres
 * - Pelo menos uma letra minúscula
 * - Pelo menos uma letra maiúscula
 * - Pelo menos um número
 * - Pelo menos um símbolo
 */

import i18n from '../i18n/i18n'

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireLowercase: true,
  requireUppercase: true,
  requireDigit: true,
  requireSymbol: true,
}

function pv(key) {
  return i18n.t(`auth.passwordValidation.${key}`)
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: pv('summary') }
  }

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return { valid: false, message: pv('minLength') }
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, message: pv('needLowercase') }
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, message: pv('needUppercase') }
  }

  if (PASSWORD_REQUIREMENTS.requireDigit && !/[0-9]/.test(password)) {
    return { valid: false, message: pv('needDigit') }
  }

  if (PASSWORD_REQUIREMENTS.requireSymbol && !/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, message: pv('needSymbol') }
  }

  return { valid: true, message: null }
}
