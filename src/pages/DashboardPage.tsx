import { ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, CircleOff, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/EmptyState'
import { StatusTag } from '@/components/StatusTag'
import { INTERVIEW_STATUSES } from '@/constants/statuses'
import { useApplicationMetrics } from '@/hooks/useApplicationMetrics'
import type { Application, PageKey } from '@/types/application'

interface DashboardPageProps {
  applications: Application[]
  statuses: string[]
  onNavigate: (page: PageKey) => void
  onOpen: (application: Application) => void
  onAdd: () => void
}

export function DashboardPage({ applications, statuses, onNavigate, onOpen, onAdd }: DashboardPageProps): JSX.Element {
  const metrics = useApplicationMetrics(applications)
  const progress = statuses
    .filter((status) => !['待投递', '已拒绝', '已结束'].includes(status))
    .map((status) => ({ status, count: applications.filter((item) => item.status === status).length }))
    .filter((item) => item.count > 0)
  const maxProgress = Math.max(...progress.map((item) => item.count), 1)

  return (
    <div className="page dashboard-page">
      <header className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">2026 Autumn Recruitment</span>
          <h1>秋招进度</h1>
          <p>把每一次投递变成清晰、可推进的下一步。</p>
        </div>
        <div className="heading-note"><Sparkles size={15} /><span>{metrics.interviews ? `有 ${metrics.interviews} 个岗位正在面试中` : '从记录第一份投递开始'}</span></div>
      </header>

      <section className="metric-grid">
        <article className="metric-card"><span className="metric-icon blue"><BriefcaseBusiness size={18} /></span><div><span>总投递</span><strong>{metrics.total}</strong><small>全部岗位记录</small></div></article>
        <article className="metric-card"><span className="metric-icon orange"><CalendarClock size={18} /></span><div><span>面试中</span><strong>{metrics.interviews}</strong><small>{INTERVIEW_STATUSES.join(' · ')}</small></div></article>
        <article className="metric-card"><span className="metric-icon green"><CheckCircle2 size={18} /></span><div><span>Offer</span><strong>{metrics.offers}</strong><small>Offer 率 {metrics.offerRate.toFixed(1)}%</small></div></article>
        <article className="metric-card"><span className="metric-icon slate"><CircleOff size={18} /></span><div><span>已结束</span><strong>{metrics.closed}</strong><small>拒绝或流程结束</small></div></article>
      </section>

      <div className="dashboard-columns">
        <section className="panel progress-panel">
          <div className="panel-heading"><div><span className="section-kicker">Pipeline</span><h2>当前进展</h2></div><Button variant="ghost" size="sm" onClick={() => onNavigate('board')}>查看看板 <ArrowRight size={14} /></Button></div>
          {progress.length ? (
            <div className="progress-list">
              {progress.map((item) => (
                <div className="progress-row" key={item.status}>
                  <StatusTag status={item.status} dot={false} />
                  <div className="progress-track"><span style={{ width: `${Math.max(8, (item.count / maxProgress) * 100)}%` }} /></div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          ) : <EmptyState title="还没有流程数据" description="新增一条投递后，进展会显示在这里。" action={<Button variant="primary" size="sm" onClick={onAdd}>新增投递</Button>} />}
        </section>

        <section className="panel deadline-panel">
          <div className="panel-heading"><div><span className="section-kicker">Deadlines</span><h2>即将截止</h2></div><span className="count-badge">{metrics.upcomingDeadlines.length}</span></div>
          {metrics.upcomingDeadlines.length ? (
            <div className="compact-list">
              {metrics.upcomingDeadlines.slice(0, 5).map(({ application, days }) => (
                <button key={application.id} onClick={() => onOpen(application)}>
                  <span className="company-avatar">{application.companyName.slice(0, 1)}</span>
                  <span className="compact-main"><strong>{application.companyName}</strong><small>{application.positionName}</small></span>
                  <span className={`days-pill ${days <= 1 ? 'urgent' : ''}`}>{days === 0 ? '今天' : `${days} 天`}</span>
                </button>
              ))}
            </div>
          ) : <EmptyState title="近期没有截止项" description="未来 3 天内的招聘截止会出现在这里。" />}
        </section>
      </div>

      <section className="panel todo-panel">
        <div className="panel-heading"><div><span className="section-kicker">Today</span><h2>今日待办</h2></div><button className="text-button" onClick={() => onNavigate('applications')}>全部投递 <ArrowRight size={14} /></button></div>
        {metrics.todayEvents.length ? (
          <div className="todo-list">
            {metrics.todayEvents.map(({ application, history }) => (
              <button key={history.id} onClick={() => onOpen(application)}>
                <span className="todo-time">{history.time || '今天'}</span>
                <span className="todo-line" />
                <span className="todo-main"><strong>{application.companyName} · {application.positionName}</strong><small>{history.status}{history.note ? ` · ${history.note}` : ''}</small></span>
                <StatusTag status={history.status} dot={false} />
              </button>
            ))}
          </div>
        ) : <div className="todo-empty"><CheckCircle2 size={18} /><span>今天没有安排，留一点时间准备下一场。</span></div>}
      </section>
    </div>
  )
}
