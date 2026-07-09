import { Component, type ErrorInfo, type ReactNode } from "react";

type AgentErrorBoundaryProps = {
  children: ReactNode;
};

type AgentErrorBoundaryState = {
  failed: boolean;
};

export class AgentErrorBoundary extends Component<AgentErrorBoundaryProps, AgentErrorBoundaryState> {
  state: AgentErrorBoundaryState = {
    failed: false,
  };

  static getDerivedStateFromError(): AgentErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[xiaochang-agent] panel render failed", error, errorInfo);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="agent-crash-fallback">
          <strong>小常暂时收起了</strong>
          <span>刚才的大脑返回格式不太稳定，地图和行程功能仍可继续使用。刷新页面后可重新打开小常。</span>
        </div>
      );
    }

    return this.props.children;
  }
}
