
export enum UserRole {
  OPERATOR = 'EME Operator',
  TEAM_LEADER = 'Team Leader',
  INCHARGE = 'Incharge',
  PROJECT_MANAGER = 'Project Manager',
  RELIEVER = 'Reliever'
}

export enum RequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  COMPLETED = 'Completed'
}

export interface ApprovalStep {
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  approverId?: string;
  timestamp?: string;
  comments?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userProfilePic?: string;
  startDate: string;
  endDate: string;
  leaveDays: number;
  reason: string;
  relieverName: string;
  status: RequestStatus;
  currentStepIndex: number;
  approvalChain: ApprovalStep[];
  submittedAt: string;
  pdfUrl?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username?: string;
  password?: string;
  profilePic?: string;
}
