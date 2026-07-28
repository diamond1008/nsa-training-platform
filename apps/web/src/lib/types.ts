/** API contract types — mirrors docs/openapi.yaml. */

export interface ApiSuccess<T> {
  data: T;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export interface ProfileRef {
  id: string;
  code: string;
  full_name: string;
}

export interface UserInfo {
  id: string;
  email: string;
  roles: Role[];
  must_change_password: boolean;
  student_profile?: ProfileRef;
  teacher_profile?: ProfileRef;
}

export interface TokenBundle {
  access_token: string;
  token_type: string;
  access_expires_at: string;
  must_change_password: boolean;
  user: UserInfo;
}
