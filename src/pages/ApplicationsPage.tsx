import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Pencil, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DeadlineBadge } from '@/components/DeadlineBadge'
import { EmptyState } from '@/components/EmptyState'
import { StatusTag } from '@/components/StatusTag'
import type { Application } from '@/types/application'
import { openExternalUrl } from '@/utils/external'
import { formatShortDate, isWithinDays } from '@/utils/date'

interface ApplicationsPageProps {
  applications: Application[]
  statuses: string[]
  searchRequest: number
  onAdd: () => void
  onOpen: (application: Application) => void
  onEdit: (application: Application) => void
  onDelete: (application: Application) => void
}

export function ApplicationsPage({ applications, statuses, searchRequest, onAdd, onOpen, onEdit, onDelete }: ApplicationsPageProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('全部状态')
  const [preference, setPreference] = useState('全部志愿')
  const [company, setCompany] = useState('全部公司')
  const [location, setLocation] = useState('全部地点')
  const [dateRange, setDateRange] = useState('全部日期')
  const companies = useMemo(() => [...new Set(applications.map((item) => item.companyName))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [applications])
  const locations = useMemo(() => [...new Set(applications.map((item) => item.location).filter((item): item is string => Boolean(item)))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [applications])
  const preferences = useMemo(() => [...new Set(applications.map((item) => item.preferenceOrder).filter((item): item is number => typeof item === 'number'))].sort((a, b) => a - b), [applications])
  const filtered = useMemo(() => applications.filter((item) => {
    const needle = query.trim().toLocaleLowerCase()
    const matchesQuery = !needle || `${item.companyName} ${item.positionName} ${item.preferenceOrder ? `第${item.preferenceOrder}志愿` : ''}`.toLocaleLowerCase().includes(needle)
    const matchesStatus = status === '全部状态' || (status === '面试中' ? ['一面', '二面', '三面', 'HR面'].includes(item.status) : item.status === status)
    const matchesPreference = preference === '全部志愿' || item.preferenceOrder === Number(preference)
    const matchesCompany = company === '全部公司' || item.companyName === company
    const matchesLocation = location === '全部地点' || item.location === location
    const matchesDate = dateRange === '全部日期' || (dateRange === '最近 7 天' ? isWithinDays(item.applicationDate, 7) : isWithinDays(item.applicationDate, 30))
    return matchesQuery && matchesStatus && matchesPreference && matchesCompany && matchesLocation && matchesDate
  }).sort((a, b) => b.applicationDate.localeCompare(a.applicationDate)), [applications, company, dateRange, location, preference, query, status])
  const hasFilters = query || status !== '全部状态' || preference !== '全部志愿' || company !== '全部公司' || location !== '全部地点' || dateRange !== '全部日期'

  useEffect(() => {
    if (searchRequest > 0) document.getElementById('global-application-search')?.focus()
  }, [searchRequest])

  const clearFilters = (): void => {
    setQuery('')
    setStatus('全部状态')
    setPreference('全部志愿')
    setCompany('全部公司')
    setLocation('全部地点')
    setDateRange('全部日期')
  }

  return (
    <div className="page applications-page">
      <header className="page-heading">
        <div><span className="eyebrow">Applications</span><h1>投递记录</h1><p>共 {applications.length} 条记录，持续推进每一个机会。</p></div>
      </header>
      <section className="panel table-panel">
        <div className="filter-bar">
          <label className="search-field"><Search size={16} /><input id="global-application-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司 / 岗位" /><kbd>Ctrl K</kbd></label>
          <div className="filter-selects">
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option>全部状态</option><option>面试中</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={preference} onChange={(event) => setPreference(event.target.value)}><option value="全部志愿">全部志愿</option>{preferences.map((item) => <option value={item} key={item}>第 {item} 志愿</option>)}</select>
            <select value={company} onChange={(event) => setCompany(event.target.value)}><option>全部公司</option>{companies.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={location} onChange={(event) => setLocation(event.target.value)}><option>全部地点</option>{locations.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={dateRange} onChange={(event) => setDateRange(event.target.value)}><option>全部日期</option><option>最近 7 天</option><option>最近 30 天</option></select>
            {hasFilters && <button className="clear-filters" onClick={clearFilters}><X size={14} />清除</button>}
          </div>
        </div>
        {filtered.length ? (
          <div className="table-scroll">
            <table className="applications-table">
              <colgroup>
                <col className="col-company" />
                <col className="col-position" />
                <col className="col-application-date" />
                <col className="col-deadline" />
                <col className="col-status" />
                <col className="col-location" />
                <col className="col-actions" />
              </colgroup>
              <thead><tr><th>公司</th><th>岗位</th><th>投递日期</th><th>截止日期</th><th>当前进度</th><th>地点</th><th aria-label="操作" /></tr></thead>
              <tbody>
                {filtered.map((application) => (
                  <tr key={application.id} onDoubleClick={() => onOpen(application)}>
                    <td><button className="company-cell" onClick={() => onOpen(application)}><span className="company-avatar">{application.companyName.slice(0, 1)}</span><span><strong>{application.companyName}</strong>{application.isDemo && <small>示例</small>}</span></button></td>
                    <td><div className="position-with-preference"><span className="position-cell">{application.positionName}</span>{application.preferenceOrder && <small className="preference-badge">第 {application.preferenceOrder} 志愿</small>}</div></td>
                    <td><span className="date-cell">{formatShortDate(application.applicationDate)}</span></td>
                    <td><DeadlineBadge deadline={application.deadline} /></td>
                    <td><StatusTag status={application.status} /></td>
                    <td><span className="location-cell">{application.location || '—'}</span></td>
                    <td className="row-actions-cell">
                      <div className="row-actions">
                        {application.link && <button aria-label="打开招聘链接" title="打开招聘链接" onClick={() => void openExternalUrl(application.link!)}><ExternalLink size={15} /></button>}
                        <button aria-label="编辑" title="编辑" onClick={() => onEdit(application)}><Pencil size={15} /></button>
                        <button aria-label="删除" title="删除" onClick={() => onDelete(application)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">显示 {filtered.length} / {applications.length} 条投递记录</div>
          </div>
        ) : <EmptyState title={applications.length ? '没有符合条件的记录' : '从第一份投递开始'} description={applications.length ? '调整搜索词或筛选条件后再试。' : '添加公司和岗位，开始管理你的秋招进度。'} action={applications.length ? <Button size="sm" onClick={clearFilters}>清除筛选</Button> : <Button variant="primary" size="sm" onClick={onAdd}>新增投递</Button>} />}
      </section>
    </div>
  )
}
