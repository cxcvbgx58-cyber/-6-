import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020203] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-black/60 backdrop-blur-3xl border border-rose-500/30 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.1),transparent)] pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="w-16 h-16 bg-rose-500/10 rounded-2xl border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-rose-500 w-8 h-8" />
              </div>
              
              <h1 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
                System Error Detected
              </h1>
              
              <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                The application encountered an unexpected error. Our systems have been notified.
              </p>

              <div className="bg-black/40 rounded-xl p-4 border border-white/5 mb-8 text-left">
                <p className="text-[10px] font-mono text-rose-400/70 uppercase tracking-widest mb-1">Error Details:</p>
                <p className="text-[11px] font-mono text-zinc-500 break-words">
                  {this.state.error?.message || 'Unknown runtime error'}
                </p>
              </div>

              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-95"
              >
                <RefreshCw size={14} />
                Restart Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
