export type UserRole =
  | "ADMINISTRATOR"
  | "ASSET_MANAGER"
  | "TECHNICIAN"
  | "SOFTWARE_LICENSE_MANAGER"
  | "PROCUREMENT_FINANCE"
  | "MANAGER_APPROVER"
  | "EMPLOYEE"
  | "AUDITOR";

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
  organization: {
    id: string;
    name: string;
  };
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}

export interface AuthIdentity {
  user: AuthenticatedUser;
  organization: {
    id: string;
    name: string;
  };
}
