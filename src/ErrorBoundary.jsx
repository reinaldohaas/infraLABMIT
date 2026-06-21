import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("ErrorBoundary caught an error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#900', color: '#fff', height: '100vh', overflowY: 'auto', fontFamily: 'monospace', zIndex: 99999, position: 'relative' }}>
          <h2>App Crashou!</h2>
          <p>Tire um print dessa tela:</p>
          <hr style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
          <h3 style={{ color: '#ffb3b3' }}>{this.state.error?.toString()}</h3>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', background: '#000', padding: 10, borderRadius: 4 }}>
            {this.state.error?.stack}
          </pre>
          <hr style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
          <h4>Onde ocorreu:</h4>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', background: '#000', padding: 10, borderRadius: 4 }}>
            {this.state.info?.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: 10, marginTop: 20, cursor: 'pointer' }}>Recarregar App</button>
        </div>
      );
    }
    return this.props.children;
  }
}
