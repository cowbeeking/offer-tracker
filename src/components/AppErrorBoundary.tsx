import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  failed: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('应用界面发生异常', error, info)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div className="app-error-state">
        <span><AlertTriangle size={22} /></span>
        <h1>界面暂时无法显示</h1>
        <p>本地数据不会因此被清除。重新加载后仍可继续使用。</p>
        <Button variant="primary" icon={<RefreshCw size={14} />} onClick={() => window.location.reload()}>重新加载</Button>
      </div>
    )
  }
}
