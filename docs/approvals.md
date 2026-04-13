# Approvals Workflow

## How It Works

1. The agent proposes a file change (write, delete, rename)
2. The `WorkspacePolicy` checks if the action requires approval
3. If yes, the `ApprovalQueueManager` enqueues the request with a diff preview
4. The UI (web or CLI) shows the pending approval with full context
5. The user can **Approve**, **Reject**, or provide an **Edit Instruction**
6. Only after approval does the write execute

## Approval Types

| Action | Severity | Behavior |
|---|---|---|
| Modify existing file | Warning | Shows diff, waits for approval |
| Create new file | Info | Shows warning, waits for approval |
| Delete file | Danger | Shows warning, requires explicit confirmation |
| Outside workspace | Danger | **Auto-denied**, never reaches queue |
| Shell command | Warning | Shows command, waits for approval |

## In the Web UI

Pending approvals appear in the **Approvals Queue** button in the header. Click to review diffs and approve/reject.

## In the CLI

Approvals appear inline during REPL mode. The agent pauses until you respond.
