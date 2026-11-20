import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && typeof parsed.error === 'string') {
        readable = `Sync error (${parsed.operationType || 'database'}): ${parsed.error}`;
      }
    } catch {
      // Standard non-JSON error
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RosoFood AI ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF8F9] px-4 py-12 text-[#241118]">
        <div className="w-full max-w-md rounded-2xl border border-[#EEDCE0] bg-white p-7 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-display text-lg font-bold text-[#241118]">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#644A52]">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#BE123C] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#9F1239] cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reload RosoFood AI
          </button>
        </div>
      </div>
    );
  }
}
