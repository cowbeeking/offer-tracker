import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmText?: string
  tone?: 'danger' | 'normal'
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  tone = 'danger',
  onConfirm,
  onClose,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Modal open={open} title={title} onClose={onClose} width="sm">
      <div className="confirm-body">
        <span className={`confirm-icon ${tone}`}><AlertTriangle size={20} /></span>
        <p>{description}</p>
      </div>
      <footer className="modal-footer">
        <Button onClick={onClose}>取消</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmText}
        </Button>
      </footer>
    </Modal>
  )
}
