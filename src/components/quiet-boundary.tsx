import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps the hub on screen if a background runtime (live socket, telegram) throws. */
export class QuietBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[hub-runtime]", error.message, info.componentStack);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
