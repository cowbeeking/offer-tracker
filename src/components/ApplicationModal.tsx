import { ApplicationForm } from '@/components/ApplicationForm'
import { Modal } from '@/components/ui/Modal'
import type { Application, ApplicationDraft } from '@/types/application'

interface ApplicationModalProps {
  open: boolean
  application?: Application
  applications: Application[]
  statuses: string[]
  companies: string[]
  onSave: (draft: ApplicationDraft, additionalDrafts?: ApplicationDraft[]) => void
  onClose: () => void
}

export function ApplicationModal({ open, application, applications, statuses, companies, onSave, onClose }: ApplicationModalProps): JSX.Element {
  return (
    <Modal
      open={open}
      title={application ? '编辑投递' : '新增投递'}
      description={application ? '更新岗位信息或招聘进度。' : '记录一条新的岗位投递。'}
      onClose={onClose}
      width="lg"
    >
      <ApplicationForm
        key={application?.id ?? 'new'}
        application={application}
        applications={applications}
        statuses={statuses}
        companies={companies}
        onSubmit={onSave}
        onCancel={onClose}
      />
    </Modal>
  )
}
