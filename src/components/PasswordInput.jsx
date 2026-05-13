/**
 * Password field with optional visibility toggle (eye icon).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function EyeOpenIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
    </svg>
  )
}

function EyeSlashIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  )
}

export function PasswordInput({ id, value, onChange, className = '', inputClassName = '', ...inputProps }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  const mergedInputClass = [
    'block w-full rounded-lg border border-earth-300 py-2 pl-3 pr-10 text-earth-900',
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className={mergedInputClass}
        {...inputProps}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-earth-500 transition hover:bg-earth-200/60 hover:text-earth-800"
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
      >
        {visible ? (
          <EyeSlashIcon className="h-5 w-5" />
        ) : (
          <EyeOpenIcon className="h-5 w-5" />
        )}
      </button>
    </div>
  )
}
