
import { UserRole } from './types';

export const APPROVAL_CHAINS: Record<string, UserRole[]> = {
  [UserRole.OPERATOR]: [
    UserRole.RELIEVER,
    UserRole.TEAM_LEADER,
    UserRole.INCHARGE,
    UserRole.PROJECT_MANAGER
  ],
  [UserRole.TEAM_LEADER]: [
    UserRole.RELIEVER,
    UserRole.INCHARGE,
    UserRole.PROJECT_MANAGER
  ],
  [UserRole.INCHARGE]: [
    UserRole.RELIEVER,
    UserRole.PROJECT_MANAGER
  ]
};

export const MOCK_USERS: any[] = [
  { id: 'u1', name: 'John Operator', role: UserRole.OPERATOR },
  { id: 'u6', name: 'Lisa Tech', role: UserRole.OPERATOR },
  { id: 'u2', name: 'Sarah Leader', role: UserRole.TEAM_LEADER },
  { id: 'u3', name: 'Mike Incharge', role: UserRole.INCHARGE },
  { id: 'u4', name: 'David PM', role: UserRole.PROJECT_MANAGER },
  { id: 'u5', name: 'Alex Reliever', role: UserRole.RELIEVER }
];
