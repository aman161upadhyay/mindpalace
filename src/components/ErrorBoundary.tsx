import * as React from "react";
export default class ErrorBoundary extends React.Component<any, {hasError: boolean}> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { if (this.state.hasError) return <div>Something went wrong.</div>; return this.props.children; }
}
