import React from 'react';

interface State { hasError: boolean; error?: any; }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: any): State { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error('UI ErrorBoundary caught error', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-gray-600">The interface encountered an unexpected error. Try refreshing or navigating elsewhere.</p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="text-left text-xs bg-gray-100 p-3 rounded overflow-auto max-h-64">{String(this.state.error?.stack || this.state.error)}</pre>
          )}
          <button onClick={() => this.setState({ hasError: false, error: undefined })} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
