import { useState, type MouseEvent } from 'react'
import { Bold, Braces, Italic, Link2, List, ListChecks, ListOrdered, Minus, Palette, Quote, Strikethrough, Table2 } from 'lucide-react'
import type { MarkdownAction } from '@/utils/markdownEditing'

interface MarkdownToolbarProps {
  disabled?: boolean
  onAction: (action: MarkdownAction) => void
}

const CODE_LANGUAGES = [
  ['text', '纯文本'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['java', 'Java'],
  ['python', 'Python'],
  ['cpp', 'C / C++'],
  ['csharp', 'C#'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['sql', 'SQL'],
  ['bash', 'Shell'],
  ['json', 'JSON'],
  ['yaml', 'YAML'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['markdown', 'Markdown'],
] as const

const TEXT_COLORS = [
  ['#1f2937', '深灰'],
  ['#dc2626', '红色'],
  ['#ea580c', '橙色'],
  ['#ca8a04', '黄色'],
  ['#16a34a', '绿色'],
  ['#2563eb', '蓝色'],
  ['#7c3aed', '紫色'],
  ['#db2777', '粉色'],
] as const

function holdSelection(event: MouseEvent<HTMLButtonElement>): void {
  event.preventDefault()
}

export function MarkdownToolbar({ disabled, onAction }: MarkdownToolbarProps): JSX.Element {
  const [tableOpen, setTableOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableColumns, setTableColumns] = useState(3)

  const button = (label: string, action: MarkdownAction, icon: JSX.Element): JSX.Element => (
    <button type="button" disabled={disabled} title={label} aria-label={label} onMouseDown={holdSelection} onClick={() => onAction(action)}>{icon}</button>
  )

  return (
    <div className={`markdown-toolbar ${disabled ? 'disabled' : ''}`} role="toolbar" aria-label="Markdown 格式工具栏">
      <div className="markdown-tool-group format-heading">
        <select disabled={disabled} defaultValue="" aria-label="标题级别" title="标题级别" onChange={(event) => {
          const level = Number(event.target.value) as 1 | 2 | 3 | 4 | 5 | 6
          if (level) onAction({ type: 'heading', level })
          event.target.value = ''
        }}>
          <option value="" disabled>标题</option>
          <option value="1">一级标题</option>
          <option value="2">二级标题</option>
          <option value="3">三级标题</option>
          <option value="4">四级标题</option>
          <option value="5">五级标题</option>
          <option value="6">六级标题</option>
        </select>
      </div>

      <i />
      <div className="markdown-tool-group">
        {button('加粗 Ctrl+B', { type: 'bold' }, <Bold size={14} />)}
        {button('斜体 Ctrl+I', { type: 'italic' }, <Italic size={14} />)}
        {button('删除线', { type: 'strikethrough' }, <Strikethrough size={14} />)}
        {button('行内代码', { type: 'inline-code' }, <Braces size={14} />)}
        <div className="markdown-color-tool">
          <button type="button" disabled={disabled} className={colorOpen ? 'active' : ''} title="字体颜色" aria-label="字体颜色" onMouseDown={holdSelection} onClick={() => { setColorOpen((value) => !value); setTableOpen(false) }}><Palette size={14} /></button>
          {colorOpen && <div className="markdown-color-popover">
            <strong>字体颜色</strong>
            <div>{TEXT_COLORS.map(([color, label]) => <button key={color} type="button" title={label} aria-label={`设置字体颜色：${label}`} style={{ backgroundColor: color }} onMouseDown={holdSelection} onClick={() => { onAction({ type: 'color', color }); setColorOpen(false) }} />)}</div>
            <label><span>自定义</span><input type="color" defaultValue="#2563eb" aria-label="自定义字体颜色" onChange={(event) => { onAction({ type: 'color', color: event.currentTarget.value }); setColorOpen(false) }} /></label>
          </div>}
        </div>
      </div>

      <i />
      <div className="markdown-tool-group">
        {button('项目符号列表', { type: 'bullet-list' }, <List size={14} />)}
        {button('编号列表', { type: 'ordered-list' }, <ListOrdered size={14} />)}
        {button('任务列表', { type: 'task-list' }, <ListChecks size={14} />)}
        {button('引用', { type: 'quote' }, <Quote size={14} />)}
      </div>

      <i />
      <div className="markdown-tool-group markdown-insert-group">
        {button('插入链接', { type: 'link' }, <Link2 size={14} />)}
        {button('插入分隔线', { type: 'horizontal-rule' }, <Minus size={14} />)}
        <label className="markdown-code-select" title="插入代码块">
          <Braces size={13} />
          <select disabled={disabled} defaultValue="" aria-label="插入代码块" onChange={(event) => {
            if (event.target.value) onAction({ type: 'code-block', language: event.target.value })
            event.target.value = ''
          }}>
            <option value="" disabled>代码块</option>
            {CODE_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="markdown-table-tool">
          <button type="button" disabled={disabled} className={tableOpen ? 'active' : ''} title="插入表格" aria-label="插入表格" onMouseDown={holdSelection} onClick={() => { setTableOpen((value) => !value); setColorOpen(false) }}><Table2 size={14} /></button>
          {tableOpen && <div className="markdown-table-popover">
            <strong>插入表格</strong>
            <label><span>数据行</span><input type="number" min="1" max="20" value={tableRows} onChange={(event) => setTableRows(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
            <label><span>列数</span><input type="number" min="1" max="10" value={tableColumns} onChange={(event) => setTableColumns(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} /></label>
            <button type="button" className="markdown-table-confirm" onClick={() => { onAction({ type: 'table', rows: tableRows, columns: tableColumns }); setTableOpen(false) }}>插入 {tableRows} × {tableColumns} 表格</button>
          </div>}
        </div>
      </div>
      {disabled && <span className="markdown-toolbar-hint">预览模式下不可编辑</span>}
    </div>
  )
}
