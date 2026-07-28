export class ApprovalAlreadyExistsError extends Error {
  readonly approvalId: string;

  constructor(approvalId: string, message: string = 'Approval already exists') {
    super(message);
    this.name = 'ApprovalAlreadyExistsError';
    this.approvalId = approvalId;
  }
}

export class ApprovalApproverNotPermittedError extends Error {
  readonly approverId: string;

  constructor(approverId: string) {
    super('Selected approver is not permitted for this approval');
    this.name = 'ApprovalApproverNotPermittedError';
    this.approverId = approverId;
  }
}
