import { http } from './http';

export type Competition = {
  id: string;
  title: string;
  theme: string | null;
  isCurrent: boolean;
  phase: string;
  config: any | null;
  submissionStart: string | null;
  submissionEnd: string | null;
  judgingStart: string | null;
  judgingEnd: string | null;
  publicStart: string | null;
  publicEnd: string | null;
};

export async function getCurrentCompetition() {
  return http<Competition | null>('/competitions/current');
}

