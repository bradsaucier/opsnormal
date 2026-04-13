import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryFallbackProps {
  error: Error;
  componentStack?: string;
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
  componentStack: string | null;
}

function haveResetKeysChanged(
  previous: unknown[] = [],
  next: unknown[] = [],
): boolean {
  return (
    previous.length !== next.length ||
    previous.some((value, index) => !Object.is(value, next[index]))
  );
}

// Architecture: ADR-0011 and ADR-0016 make this a sectional fault-containment boundary.
// Reset keys restore a failed feature surface without collapsing the full shell.
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
    componentStack: null,
  };

  static getDerivedStateFromError(
    error: Error,
  ): Pick<ErrorBoundaryState, 'error'> {
    return {
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      componentStack: errorInfo.componentStack ?? null,
    });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps): void {
    if (
      this.state.error &&
      haveResetKeysChanged(previousProps.resetKeys, this.props.resetKeys)
    ) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({
      error: null,
      componentStack: null,
    });
  };

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallbackRender({
        error: this.state.error,
        componentStack: this.state.componentStack ?? undefined,
        resetErrorBoundary: this.resetErrorBoundary,
      });
    }

    return this.props.children;
  }
}
