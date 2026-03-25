import { Component } from 'react'

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
          <h1 className="text-xl font-bold text-earth-900">Algo deu errado</h1>
          <p className="mt-2 max-w-lg text-center text-earth-600">
            Ocorreu um erro ao carregar a página. Verifique o console do navegador (F12) para mais detalhes.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded bg-earth-200 p-4 text-left text-sm text-earth-800">
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-earth-900 px-4 py-2 text-sm font-medium text-earth-50 hover:bg-earth-800"
          >
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
