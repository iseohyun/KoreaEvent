/**
 * 앱 전역 오류 경계 (AppErrorBoundary)
 * - 하위 컴포넌트 렌더링 중 예외가 나도 화면 전체가 하얗게 비지 않도록 오류 안내 화면을 대신 보여준다.
 * - 오류 메시지와 컴포넌트 스택을 콘솔에 남겨 원인 추적을 돕는다.
 */
import React from 'react';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] 렌더링 오류:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          maxWidth: 640,
          margin: '64px auto',
          padding: '24px 28px',
          borderRadius: 12,
          border: '1px solid #fca5a5',
          background: '#fef2f2',
          color: '#7f1d1d',
          fontFamily: 'inherit',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>
          화면을 그리는 중 오류가 발생했습니다.
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: '0.88rem', lineHeight: 1.6 }}>
          새로고침해도 계속되면 아래 오류 메시지를 알려주세요.
        </p>
        <pre
          style={{
            margin: '0 0 16px',
            padding: '10px 12px',
            background: '#ffffff',
            border: '1px solid #fecaca',
            borderRadius: 8,
            fontSize: '0.78rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {error.message}
        </pre>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #dc2626',
            background: '#dc2626',
            color: '#ffffff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          새로고침
        </button>
      </div>
    );
  }
}
