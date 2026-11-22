import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Neuron Mind ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const isPersian =
        typeof document !== 'undefined' && document.documentElement.lang === 'fa';
      return (
        <div className="min-h-screen bg-[#F3F6FB] dark:bg-[#060E20] text-[#0B1B3B] dark:text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#0D1B36] border border-blue-900/15 dark:border-blue-400/20 rounded-2xl p-6 space-y-4">
            <h1 className="font-display text-lg font-semibold text-[#0B1B3B] dark:text-slate-100">
              {isPersian ? 'خطایی در برنامه رخ داد' : 'Something went wrong'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[40px] px-4 py-2 text-sm font-medium text-white bg-[#102A5C] hover:bg-[#0B1D42] dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg"
            >
              {isPersian ? 'بارگذاری مجدد' : 'Reload application'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
