import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AccessGate } from "./components/AccessGate";
import "./styles.css";
import "katex/dist/katex.min.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>A little off course.</h1>
        <p>Something unexpected happened. Your saved learning is safe.</p>
        <button onClick={() => location.reload()}>Reload Intellora</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AccessGate>
        <App />
      </AccessGate>
    </ErrorBoundary>
  </React.StrictMode>,
);
