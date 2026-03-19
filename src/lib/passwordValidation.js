/**
 * Validação de senha conforme requisitos do sistema:
 * - Mínimo 8 caracteres
 * - Pelo menos uma letra minúscula
 * - Pelo menos uma letra maiúscula
 * - Pelo menos um número
 * - Pelo menos um símbolo
 */

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireLowercase: true,
  requireUppercase: true,
  requireDigit: true,
  requireSymbol: true,
}

const REQUIREMENTS_MESSAGE = 'A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos.'

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: REQUIREMENTS_MESSAGE }
  }

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return { valid: false, message: 'A senha deve ter no mínimo 8 caracteres.' }
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, message: 'A senha deve incluir pelo menos uma letra minúscula.' }
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, message: 'A senha deve incluir pelo menos uma letra maiúscula.' }
  }

  if (PASSWORD_REQUIREMENTS.requireDigit && !/[0-9]/.test(password)) {
    return { valid: false, message: 'A senha deve incluir pelo menos um número.' }
  }

  if (PASSWORD_REQUIREMENTS.requireSymbol && !/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, message: 'A senha deve incluir pelo menos um símbolo (!@#$%^&* etc.).' }
  }

  return { valid: true, message: null }
}

export const PASSWORD_PLACEHOLDER = 'Mín. 8 caracteres, maiúsculas, minúsculas, números e símbolos'
