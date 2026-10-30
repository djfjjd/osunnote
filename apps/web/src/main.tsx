import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

interface ErrorBoundaryState { failed: boolean }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    // 사용자 본문이나 개인정보가 포함될 수 있어 오류 내용을 외부로 전송하지 않는다.
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="startup-error" role="alert">
          <span className="brand-mark">O</span>
          <h1>작업실을 열지 못했습니다</h1>
          <p>글은 이 기기에 그대로 보관되어 있습니다. 페이지를 새로고침해 다시 열어 주세요.</p>
          <button type="button" onClick={() => window.location.reload()}>새로고침</button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }),
  );
}
