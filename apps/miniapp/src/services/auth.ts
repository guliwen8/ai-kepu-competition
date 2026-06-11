import { http } from './http';
import type { Tokens, Me } from '../store/auth';

export function loginSms(phone: string, code: string) {
  return http<Tokens>('/auth/login/sms', { method: 'POST', data: { phone, code } });
}

export function me() {
  return http<Me>('/auth/me');
}

