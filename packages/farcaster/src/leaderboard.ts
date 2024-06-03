import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';

const pointsForCast = 10000;
const multiplierForLike = 1;
const multiplierForReplies = 2;
const multiplierForRecasts = 2;
const divider = 100;

export const calPointsForCast = (cast: CastWithInteractions) => {
  const likes = cast.reactions.likes_count;
  const replies = cast.replies.count;
  const recasts = cast.reactions.recasts_count;
  return (
    pointsForCast +
    (likes / divider) * pointsForCast * multiplierForLike +
    (replies / divider) * pointsForCast * multiplierForReplies +
    (recasts / divider) * pointsForCast * multiplierForRecasts
  );
};

export const isLikedByHosts = (cast: CastWithInteractions, hosts: number[]) => {
  for (const likedBy of cast.reactions.likes.map((r) => r.fid)) {
    if (hosts.includes(likedBy)) {
      return true;
    }
  }
  return false;
};
