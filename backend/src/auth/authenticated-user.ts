import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  user_metadata?: { full_name?: string };
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
