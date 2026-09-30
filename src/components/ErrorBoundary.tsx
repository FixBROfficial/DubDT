import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950 text-white select-none">
          <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-800/80 flex items-center justify-center mb-4 text-red-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold mb-2">Ocorreu um erro inesperado na visualização</h2>
          <p className="text-xs text-zinc-400 max-w-md text-center mb-5 font-mono">
            {this.state.error?.message || 'Erro desconhecido'}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Recarregar interface</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
