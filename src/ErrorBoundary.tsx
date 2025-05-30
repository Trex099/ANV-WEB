import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackRender?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null }; // errorInfo is set in componentDidCatch
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender(this.state.error!, this.state.errorInfo!);
      }
      // Default fallback UI
      return (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '30px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            fontSize: '14px',
            overflow: 'auto'
          }}
        >
          <h2 style={{ color: '#ff8080', fontSize: '1.5em', marginBottom: '20px' }}>Oops! Something went wrong.</h2>
          <div style={{ background: '#222', padding: '20px', borderRadius: '8px', width: '80%', maxWidth: '800px', maxHeight: '70vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#ffc0c0', marginTop: 0 }}>Error:</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#f0f0f0', marginBottom: '20px' }}>
              <code>
                {this.state.error && this.state.error.toString()}
              </code>
            </pre>
            <h3 style={{ color: '#ffc0c0' }}>Details (Component Stack):</h3>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#d0d0d0' }}>
              <code>
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </code>
            </pre>
          </div>
           <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '25px',
              padding: '10px 20px',
              fontSize: '1em',
              color: 'white',
              backgroundColor: '#555',
              border: '1px solid #777',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 