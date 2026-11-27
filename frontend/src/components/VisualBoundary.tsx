import { Component } from "react";
import type { ReactNode } from "react";

export default class VisualBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean; updated: boolean }
> {
  state = { failed: false, updated: false };
  static getDerivedStateFromError(error: Error) {
    return {
      failed: true,
      updated: /dynamically imported|module script|Importing a module/i.test(
        error.message,
      ),
    };
  }
  render() {
    if (this.state.updated)
      return (
        <div className="release-notice" role="alert">
          <h3>A new version is available</h3>
          <p>Save any text you are editing, then reload to continue.</p>
          <button
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Reload application
          </button>
        </div>
      );
    return this.state.failed
      ? this.props.fallback || (
          <p role="alert">This view is unavailable. Try reloading the page.</p>
        )
      : this.props.children;
  }
}
