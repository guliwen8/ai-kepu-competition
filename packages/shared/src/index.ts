export const UserRole = {
  Admin: 'admin',
  Organizer: 'organizer',
  Judge: 'judge',
  Participant: 'participant',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
