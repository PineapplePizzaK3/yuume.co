import { Component } from 'react'
import i18n from '../i18n/i18n'

/**
 * Error Boundary para capturar erros de runtime e exibir mensagem em vez de tela em branco.
 */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-earth-50 p-8">
          <h1 className="text-xl font-bold text-earth-900">{i18n.t('errorBoundary.title')}</h1>
          <p className="mt-2 max-w-lg text-center text-earth-600">{i18n.t('errorBoundary.body')}</p>
          <pre className="mt-4 max-h-48 overflow-auto rounded bg-earth-200 p-4 text-left text-sm text-earth-800">
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
          >
            {i18n.t('errorBoundary.reload')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
