import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Synapse UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-surface-primary text-text-primary">
          <div className="max-w-md w-full rounded-2xl border border-border-subtle bg-surface-card p-6 space-y-4">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-text-secondary">
              The app hit an unexpected error. Reload the page — your progress is stored locally in the browser.
            </p>
            <p className="text-xs text-text-muted font-mono break-all">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
