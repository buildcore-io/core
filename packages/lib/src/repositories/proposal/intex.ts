export * from './ProposalMemberRepository';
export * from './ProposalOwnerRepository';
export * from './ProposalRepository';

export enum ProposalFilter {
  ALL = 'all',
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}
