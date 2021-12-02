export const WenError = {
  unknown: { code: 1000, key: 'Unknown error' },
  invalid_params: { code: 1001, key: 'Params validation failed.' },
  address_must_be_provided: { code: 1002, key: 'Address must be provided.' },
  signature_must_be_provided: { code: 1003, key: 'Signature must be provided.' },
  invalid_signature: { code: 1003, key: 'Invalid signature.' },
  missing_nonce: { code: 1004, key: 'Missing nonce.' },
  invalid_wallet_address: { code: 2002, key: 'Invalid wallet address.' },
  failed_to_decode_token: { code: 2003, key: 'Failed to decode the token.' },
  member_username_exists: { code: 2004, key: 'Username already exists.' },
  space_does_not_exists: { code: 2005, key: 'Space does not exists.' },
  you_are_not_guardian_of_space: { code: 2006, key: 'You are not a guardian of the space.' },
  you_are_not_part_of_space: { code: 2006, key: 'You are not part of the space.' },
  you_are_already_part_of_space: { code: 2007, key: 'You are already part of the space.' },
  you_are_not_allowed_to_join_space: { code: 2008, key: 'You are are not allowed to join space.' },
  you_are_not_part_of_the_space: { code: 2009, key: 'You are not part of the space.' },
  at_least_one_member_must_be_in_the_space: { code: 2020, key: 'At least one member must be in the space.' },
  at_least_one_guardian_must_be_in_the_space: { code: 2011, key: 'At least one guardian must be in the space.' },
  member_is_not_part_of_the_space: { code: 2012, key: 'Member is not part of the space.' },
  member_is_already_guardian_of_space: { code: 2013, key: 'Member is already guardian of space.' },
  member_is_not_guardian_of_space: { code: 2014, key: 'Member is not guardian of space.' },
  member_is_already_blocked: { code: 2015, key: 'Member is already blocked.' },
  member_is_not_blocked_in_the_space: { code: 2016, key: 'Member is not blocked in the space.' },
  you_are_not_owner_of_the_award: { code: 2017, key: 'You are not an owner of the space.' },
  award_does_not_exists: { code: 2018, key: 'Award does not exists.' },
  member_is_already_owner_of_space: { code: 2019, key: 'Member is already owner of space.' },
  member_is_already_participant_of_space: { code: 2020, key: 'Member is already participant of space.' },
  no_more_available_badges: { code: 2021, key: 'There is no more available badges.' },
  proposal_does_not_exists: { code: 2022, key: 'Proposal does not exist.' },
  you_are_not_owner_of_proposal: { code: 2023, key: 'You are not an owner of the proposal.' },
  proposal_is_already_approved: { code: 2024, key: 'Proposal is already approved.' },
  proposal_is_already_rejected: { code: 2025, key: 'Proposal is already rejected.' },
  award_is_no_longer_available: { code: 2026, key: 'Award is not available for participation.' },
  member_does_not_exists: { code: 2027, key: 'Member does not exists.' },
  you_can_only_vote_on_members_proposal: { code: 2028, key: 'You can only vote on members proposal.' },
  you_are_not_allowed_to_vote_on_this_proposal: { code: 2029, key: 'You are not allowed to vote on this proposal.' },
  proposal_is_not_approved: { code: 2030, key: 'Proposal is not approved.' },
  proposal_is_rejected: { code: 2031, key: 'Proposal is rejected.' },
  value_does_not_exists_in_proposal: { code: 2032, key: 'Value does not exists in proposal.' },
  proposal_must_be_in_future: { code: 2033, key: 'Proposal must be in future.' },
  proposal_start_date_must_be_before_end_date: { code: 2034, key: 'Proposal startDate must be before endDate.' },
  member_did_not_request_to_join: { code: 2036, key: 'Member did not request to join.' },
  vote_is_no_longer_active: { code: 2037, key: 'Vote is no longer active.' },
  nft_does_not_exists: { code: 2037, key: 'NFT does not exists.' },
  nft_is_no_longer_available: { code: 2037, key: 'NFT is no longer available.' },
  ntt_does_not_exists: { code: 2037, key: 'NTT does not exists.' },
  ntt_is_no_longer_available: { code: 2037, key: 'NTT is no longer available.' },
}

