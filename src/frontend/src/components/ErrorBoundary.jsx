import { Component } from 'react'

/**
 * Last line of defence: a rendering error must never leave a blank page in a
 * demo. Shows a readable fallback instead.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Dashboard crashed', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-zinc-200">
          <div className="max-w-md rounded-2xl border border-white/10 bg-zinc-900/60 p-8 text-center">
            <p className="mb-2 text-lg font-bold">Algo deu errado ao renderizar o dashboard</p>
            <p className="mb-6 text-sm text-zinc-400">
              A API continua disponível. Recarregue a página para tentar novamente.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Recarregar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
