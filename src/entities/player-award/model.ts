export type AwardStatus = "DRAFT" | "OPEN" | "CLOSED";
export type AwardCandidate = {
  playerId: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  photoUrl: string | null;
  teamId: string;
  teamName: string;
};
export type AwardPoll = {
  id: string;
  title: string;
  status: AwardStatus;
  candidateCount: number;
  canVote: boolean;
  candidates: AwardCandidate[];
};
export type AwardResults = {
  pollId: string;
  status: AwardStatus;
  totalVoters: number;
  results: (AwardCandidate & { rank: number; totalPoints: number; firstPlaceVotes: number })[];
};
export type CreateAwardInput = { tournamentId: string; title: string; candidateCount: number; playerIds: string[] };
