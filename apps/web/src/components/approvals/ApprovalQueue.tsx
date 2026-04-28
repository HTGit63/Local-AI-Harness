import type { RunApprovalItem } from '../../types/run';

interface ApprovalQueueProps {
  approvals: RunApprovalItem[];
  onResolve: (id: string, approved: boolean) => void;
  compact?: boolean;
}

export function ApprovalQueue({ approvals, onResolve, compact = false }: ApprovalQueueProps) {
  if (approvals.length === 0) {
    return compact ? <div className="empty-note">No pending approvals</div> : null;
  }

  return (
    <>
      {approvals.map((approval) => (
        <div key={approval.id} className="approval-card">
          <div className="approval-card-head">
            <span className="approval-card-title">{approval.changeType}</span>
            <span className={`approval-severity ${approval.severity === 'danger' ? 'approval-severity-danger' : approval.severity === 'info' ? 'approval-severity-info' : ''}`}>
              {approval.severity}
            </span>
          </div>
          <div className="approval-target">{approval.target}</div>
          {(approval.diffPreview || approval.warningMessage) && (
            <div className="approval-preview">{approval.diffPreview || approval.warningMessage}</div>
          )}
          <div className="approval-actions">
            <button className="approval-btn approval-btn-approve" onClick={() => onResolve(approval.id, true)} type="button">Approve</button>
            <button className="approval-btn approval-btn-reject" onClick={() => onResolve(approval.id, false)} type="button">Reject</button>
          </div>
        </div>
      ))}
    </>
  );
}
