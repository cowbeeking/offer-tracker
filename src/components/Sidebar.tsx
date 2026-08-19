import { BarChart3, Columns3, LayoutDashboard, ListTodo, Settings } from 'lucide-react'
import clsx from 'clsx'
import type { PageKey, PersistenceStatus } from '@/types/application'

const NAV_ITEMS: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: '概览', icon: LayoutDashboard },
  { key: 'applications', label: '投递记录', icon: ListTodo },
  { key: 'board', label: '流程看板', icon: Columns3 },
  { key: 'statistics', label: '数据统计', icon: BarChart3 },
]

interface SidebarProps {
  page: PageKey
  persistenceStatus: PersistenceStatus
  persistenceError?: string
  onNavigate: (page: PageKey) => void
  onRetrySave: () => void
}

export function Sidebar({ page, persistenceStatus, persistenceError, onNavigate, onRetrySave }: SidebarProps): JSX.Element {
  const saveCopy = persistenceStatus === 'saving'
    ? { title: '正在保存', detail: '请稍候…' }
    : persistenceStatus === 'error'
      ? { title: '保存失败', detail: persistenceError ?? '点击重试' }
      : { title: '数据已本地保存', detail: '所有更改已保存' }

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">秋</span>
        <div><strong>秋招 Tracker</strong><small>Local workspace</small></div>
      </div>
      <nav className="sidebar-nav" aria-label="主导航">
        <span className="nav-label">Workspace</span>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button key={item.key} className={clsx('nav-item', page === item.key && 'active')} onClick={() => onNavigate(item.key)}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="sidebar-bottom">
        <button className={clsx('nav-item', page === 'settings' && 'active')} onClick={() => onNavigate('settings')}>
          <Settings size={17} strokeWidth={1.8} /><span>设置</span>
        </button>
        <button
          className={`local-badge ${persistenceStatus}`}
          disabled={persistenceStatus !== 'error'}
          title={persistenceStatus === 'error' ? '重试保存' : undefined}
          onClick={onRetrySave}
        ><span /><div><strong>{saveCopy.title}</strong><small>{saveCopy.detail}</small></div></button>
      </div>
    </aside>
  )
}
