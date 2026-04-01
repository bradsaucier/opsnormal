import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackRender: (props: ErrorBoundaryFallbackProps) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
  retryKey: number;
}

function haveResetKeysChanged(previous: unknown[] = [], next: unknown[] = []): boolean {
  return (
    previous.length !== next.length ||
    previous.some((value, index) => !Object.is(value, next[index]))
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    retryKey: 0
  };

  static getDerivedStateFromError(error: Error): Pick<ErrorBoundaryState, 'error'> {
    return {
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps): void {
    if (this.state.error && haveResetKeysChanged(previousProps.resetKeys, this.props.resetKeys)) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState((previousState) => ({
      error: null,
      retryKey: previousState.retryKey + 1
    }));
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallbackRender({
        error: this.state.error,
        resetErrorBoundary: this.resetErrorBoundary
      });
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
