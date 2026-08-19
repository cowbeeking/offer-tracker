import type { Application } from '@/types/application'
import { toDateInput } from '@/utils/date'
import { createId } from '@/utils/id'

function makeDemo(
  companyName: string,
  positionName: string,
  applicationDate: string,
  deadline: string,
  status: string,
  location: string,
  source: string,
): Application {
  const id = createId()
  const createdAt = new Date(`${applicationDate}T09:00:00`).getTime()
  const path = ['已投递', '笔试', '一面', '二面', '三面', 'HR面', 'Offer']
  const statusIndex = path.indexOf(status)
  const histories = path.slice(0, Math.max(statusIndex + 1, 1)).map((item, index) => {
    const date = new Date(`${applicationDate}T00:00:00`)
    date.setDate(date.getDate() + index * 3)
    const historyId = createId()
    return {
      id: historyId,
      applicationId: id,
      status: item,
      date: toDateInput(date),
      time: index === statusIndex && item.includes('面') ? '14:00' : undefined,
      note: index > 0 ? `进入${item}阶段` : '完成网申投递',
      createdAt: createdAt + index * 3 * 86400000,
    }
  })
  return {
    id,
    companyName,
    positionName,
    applicationDate,
    deadline,
    status,
    location,
    source,
    jobType: positionName.includes('Java') ? '后端开发' : '技术研发',
    salary: '25k-40k · 15薪',
    notes: '关注官网与邮箱通知，及时准备下一阶段。',
    link: 'https://example.com/campus',
    histories,
    isDemo: true,
    createdAt,
    updatedAt: createdAt + Math.max(statusIndex, 0) * 3 * 86400000,
  }
}

export function createDemoApplications(): Application[] {
  return [
    makeDemo('字节跳动', '后端开发工程师', '2026-08-12', '2026-08-30', '二面', '北京', '招聘官网'),
    makeDemo('腾讯', 'Java开发工程师', '2026-08-10', '2026-08-25', '笔试', '深圳', '招聘官网'),
    makeDemo('阿里巴巴', '后端研发工程师', '2026-08-08', '2026-08-31', '已投递', '杭州', '内推'),
    makeDemo('美团', 'Java开发工程师', '2026-08-04', '2026-08-20', 'Offer', '北京', '实习转正'),
    makeDemo('百度', '服务端研发工程师', '2026-08-16', '2026-08-22', '一面', '北京', '牛客'),
    makeDemo('京东', '软件开发工程师', '2026-08-18', '2026-09-05', '已投递', '北京', '招聘官网'),
  ]
}
