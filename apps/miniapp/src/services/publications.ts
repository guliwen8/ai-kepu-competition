import { http } from './http';

export type PublicLeaderboardItem = {
  rank: number;
  submissionId: string;
  blindCode: string;
  title: string | null;
  category: string;
  score: {
    avgTotal: number;
    scoreCount: number;
    avgS1: number;
    avgS2: number;
    avgS3: number;
    avgS4: number;
    avgS5: number;
  };
};

export type PublicLeaderboardResponse = {
  competition: { id: string; title: string; phase: string };
  category: string | null;
  minScoreCount: number;
  total: number;
  page: number;
  pageSize: number;
  items: PublicLeaderboardItem[];
};

export function getPublicLeaderboard(args: {
  competitionId?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}) {
  const sp = new URLSearchParams();
  if (args.competitionId) sp.set('competitionId', args.competitionId);
  if (args.category) sp.set('category', args.category);
  if (args.page) sp.set('page', String(args.page));
  if (args.pageSize) sp.set('pageSize', String(args.pageSize));
  const qs = sp.toString();
  return http<PublicLeaderboardResponse>(`/public/leaderboard${qs ? `?${qs}` : ''}`);
}
