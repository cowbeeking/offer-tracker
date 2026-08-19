import { ArrowUpRight, Award, FilePenLine, Gauge, MessagesSquare } from 'lucide-react'
import { useApplicationMetrics } from '@/hooks/useApplicationMetrics'
import type { Application, WorkflowNode } from '@/types/application'

export function StatisticsPage({ applications, workflowNodes }: { applications: Application[]; workflowNodes: WorkflowNode[] }): JSX.Element {
  const metrics = useApplicationMetrics(applications, workflowNodes)
  const maxTrend = Math.max(...metrics.trend.map((item) => item.count), 1)
  const activeDays = metrics.trend.filter((item) => item.count > 0).length

  return (
    <div className="page statistics-page">
      <header className="page-heading"><span className="eyebrow">Insights</span><h1>数据统计</h1><p>用少量关键数字校准投递节奏，不制造多余焦虑。</p></header>
      <section className="stats-grid">
        <article className="stat-card"><span><FilePenLine size={17} /></span><small>累计投递</small><strong>{metrics.total}</strong><p>记录的全部岗位</p></article>
        <article className="stat-card"><span><Gauge size={17} /></span><small>进入笔试</small><strong>{metrics.reachedWritten}</strong><p>笔试率 {metrics.writtenRate.toFixed(1)}%</p></article>
        <article className="stat-card"><span><MessagesSquare size={17} /></span><small>进入面试</small><strong>{metrics.reachedInterview}</strong><p>面试率 {metrics.interviewRate.toFixed(1)}%</p></article>
        <article className="stat-card highlight"><span><Award size={17} /></span><small>当前 Offer</small><strong>{metrics.offers}</strong><p>Offer 率 {metrics.offerRate.toFixed(1)}%</p></article>
      </section>

      <div className="statistics-columns">
        <section className="panel trend-panel">
          <div className="panel-heading"><div><span className="section-kicker">Last 30 days</span><h2>投递趋势</h2></div><div className="trend-summary"><strong>{metrics.trend.reduce((sum, item) => sum + item.count, 0)}</strong><span>近 30 天投递</span></div></div>
          <div className="trend-chart" role="img" aria-label="最近 30 天每日投递数量柱状图">
            {metrics.trend.map((item, index) => (
              <div className="trend-day" key={item.date} title={`${item.date}：${item.count} 份`}>
                <span className="trend-bar" style={{ height: `${Math.max(item.count ? 10 : 2, (item.count / maxTrend) * 100)}%` }} />
                {(index === 0 || index === 9 || index === 19 || index === 29) && <small>{item.date.slice(5)}</small>}
              </div>
            ))}
          </div>
          <div className="chart-footnote"><span>活跃投递 {activeDays} 天</span><span>平均每天 {(metrics.trend.reduce((sum, item) => sum + item.count, 0) / 30).toFixed(1)} 份</span></div>
        </section>

        <section className="panel conversion-panel">
          <div className="panel-heading"><div><span className="section-kicker">Conversion</span><h2>流程转化</h2></div><ArrowUpRight size={17} /></div>
          <div className="conversion-list">
            {[
              { label: '投递', value: metrics.total, rate: 100 },
              { label: '笔试', value: metrics.reachedWritten, rate: metrics.writtenRate },
              { label: '面试', value: metrics.reachedInterview, rate: metrics.interviewRate },
              { label: 'Offer', value: metrics.offers, rate: metrics.offerRate },
            ].map((item) => (
              <div className="conversion-row" key={item.label}>
                <div><strong>{item.label}</strong><span>{item.value} 个岗位</span></div>
                <div className="conversion-track"><span style={{ width: `${Math.max(item.rate, item.value ? 4 : 0)}%` }} /></div>
                <em>{item.rate.toFixed(item.rate === 100 ? 0 : 1)}%</em>
              </div>
            ))}
          </div>
          <p className="conversion-note">转化率按流程历史计算，即使岗位当前已进入后续阶段也不会漏计。</p>
        </section>
      </div>
    </div>
  )
}
