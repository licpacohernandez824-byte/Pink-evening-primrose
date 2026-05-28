import React, { Component, ErrorInfo, ReactNode, useState } from "react";
import ProcessingAnimation from "./components/ProcessingAnimation";
import ShowcaseAnimation from "./components/ShowcaseAnimation";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "red", padding: "20px" }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return <>{(this as React.Component<Props>).props.children}</>;
  }
}

export default function App() {
  const [view, setView] = useState<'flower' | 'showcase'>('showcase');
  const isTD = new URLSearchParams(window.location.search).get('td') === '1';

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center">
        {!isTD && (
          <div className="absolute top-4 z-50 flex gap-4 bg-neutral-900/50 p-1.5 rounded-full backdrop-blur-md border border-white/10">
            <button 
               onClick={() => setView('flower')} 
               className={`px-4 py-1.5 rounded-full text-sm transition-colors ${view === 'flower' ? 'bg-white text-black font-medium' : 'text-neutral-400 hover:text-white'}`}>
               Digital Canvas
            </button>
            <button 
               onClick={() => setView('showcase')} 
               className={`px-4 py-1.5 rounded-full text-sm transition-colors ${view === 'showcase' ? 'bg-white text-black font-medium' : 'text-neutral-400 hover:text-white'}`}>
               Showcase Layout
            </button>
          </div>
        )}
        {view === 'flower' ? <ProcessingAnimation /> : <ShowcaseAnimation />}
      </div>
    </ErrorBoundary>
  );
}
