import { BarChart3, Columns3, LayoutDashboard, ListTodo, Settings } from 'lucide-react'
import clsx from 'clsx'
import type { PageKey } from '@/types/application'

const NAV_ITEMS: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: '概览', icon: LayoutDashboard },
  { key: 'applications', label: '投递记录', icon: ListTodo },
  { key: 'board', label: '流程看板', icon: Columns3 },
  { key: 'statistics', label: '数据统计', icon: BarChart3 },
]

export function Sidebar({ page, onNavigate }: { page: PageKey; onNavigate: (page: PageKey) => void }): JSX.Element {
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
        <div className="local-badge"><span /><div><strong>数据已本地保存</strong><small>自动保存</small></div></div>
      </div>
    </aside>
  )
}
