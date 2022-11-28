export const WenError = {
  unknown: { code: 1000, key: 'Unknown error' },
  invalid_params: { code: 1001, key: 'Validation failed: ' },
  address_must_be_provided: { code: 1002, key: 'Address must be provided.' },
  signature_must_be_provided: { code: 1003, key: 'Signature must be provided.' },
  invalid_signature: { code: 1003, key: 'Invalid signature.' },
  missing_nonce: { code: 1004, key: 'Missing nonce.' },
  unapproved_site: { code: 1005, key: 'Site is not approved to interact.' },
  invalid_wallet_address: { code: 2002, key: 'Invalid wallet address.' },
  failed_to_decode_token: { code: 2003, key: 'Failed to decode the token.' },
  member_username_exists: { code: 2004, key: 'Username already exists.' },
  space_does_not_exists: { code: 2005, key: 'Space does not exists.' },
  you_are_not_guardian_of_space: { code: 2006, key: 'You are not a guardian of the space.' },
  you_are_not_part_of_space: { code: 2006, key: 'You are not part of the space.' },
  you_are_already_part_of_space: { code: 2007, key: 'You are already part of the space.' },
  you_are_not_allowed_to_join_space: { code: 2008, key: 'You are are not allowed to join space.' },
  you_are_not_part_of_the_space: { code: 2009, key: 'You are not part of the space.' },
  at_least_one_member_must_be_in_the_space: {
    code: 2020,
    key: 'At least one member must be in the space.',
  },
  at_least_one_guardian_must_be_in_the_space: {
    code: 2011,
    key: 'At least one guardian must be in the space.',
  },
  member_is_not_part_of_the_space: { code: 2012, key: 'Member is not part of the space.' },
  member_is_already_guardian_of_space: { code: 2013, key: 'Member is already guardian of space.' },
  member_is_not_guardian_of_space: { code: 2014, key: 'Member is not guardian of space.' },
  member_is_already_blocked: { code: 2015, key: 'Member is already blocked.' },
  member_is_not_blocked_in_the_space: { code: 2016, key: 'Member is not blocked in the space.' },
  you_are_not_owner_of_the_award: { code: 2017, key: 'You are not an owner of the space.' },
  award_does_not_exists: { code: 2018, key: 'Award does not exists.' },
  member_is_already_owner_of_space: { code: 2019, key: 'Member is already owner of space.' },
  member_is_already_participant_of_space: {
    code: 2020,
    key: 'Member is already participant of space.',
  },
  no_more_available_badges: { code: 2021, key: 'There is no more available badges.' },
  proposal_does_not_exists: { code: 2022, key: 'Proposal does not exist.' },
  you_are_not_owner_of_proposal: { code: 2023, key: 'You are not an owner of the proposal.' },
  proposal_is_already_approved: { code: 2024, key: 'Proposal is already approved.' },
  proposal_is_already_rejected: { code: 2025, key: 'Proposal is already rejected.' },
  award_is_no_longer_available: { code: 2026, key: 'Award is not available for participation.' },
  member_does_not_exists: { code: 2027, key: 'Member does not exists.' },
  you_can_only_vote_on_members_proposal: {
    code: 2028,
    key: 'You can only vote on members proposal.',
  },
  you_are_not_allowed_to_vote_on_this_proposal: {
    code: 2029,
    key: 'You are not allowed to vote on this proposal.',
  },
  proposal_is_not_approved: { code: 2030, key: 'Proposal is not approved.' },
  proposal_is_rejected: { code: 2031, key: 'Proposal is rejected.' },
  value_does_not_exists_in_proposal: { code: 2032, key: 'Value does not exists in proposal.' },
  proposal_must_be_in_future: { code: 2033, key: 'Proposal must be in future.' },
  proposal_start_date_must_be_before_end_date: {
    code: 2034,
    key: 'Proposal startDate must be before endDate.',
  },
  member_did_not_request_to_join: { code: 2036, key: 'Member did not request to join.' },
  vote_is_no_longer_active: { code: 2037, key: 'Vote is no longer active.' },
  nft_does_not_exists: { code: 2038, key: 'NFT does not exists.' },
  nft_is_no_longer_available: { code: 2039, key: 'NFT is no longer available.' },
  ntt_does_not_exists: { code: 2040, key: 'NTT does not exists.' },
  ntt_is_no_longer_available: { code: 2041, key: 'NTT is no longer available.' },
  award_is_already_approved: { code: 2042, key: 'Award is already approved.' },
  award_is_already_rejected: { code: 2043, key: 'Award is already rejected.' },
  award_is_not_approved: { code: 2044, key: 'Award is not approved.' },
  award_is_rejected: { code: 2045, key: 'Award is rejected.' },
  collection_does_not_exists: { code: 2046, key: 'Collection does not exists.' },
  royalty_payout_must_be_above_1_mi: { code: 2046, key: 'Royalty payout must be above 1 Mi.' },
  owner_does_not_have_verified_address: {
    code: 2047,
    key: 'Owner must have verified address to be paid.',
  },
  nft_not_available_for_sale: { code: 2048, key: 'NFT is not available for sale.' },
  space_already_have_validated_address: {
    code: 2049,
    key: 'Space already have validated address.',
  },
  member_already_have_validated_address: {
    code: 2050,
    key: 'Member already have validated address.',
  },
  nft_locked_for_sale: { code: 2051, key: 'NFT is currently locked.' },
  space_must_have_validated_address: {
    code: 2052,
    key: "Space must have validated IOTA or selected network's address (if collection that includes Royalty space).",
  },
  member_must_have_validated_address: { code: 2053, key: 'Member must have validated address.' },
  generated_spf_nft_must_be_sold_first: {
    code: 2055,
    key: 'To buy directly Generated NFT/SFT it must be sold first.',
  },
  no_more_nft_available_for_sale: { code: 2057, key: 'No more NFT available for sale.' },
  nft_placeholder_cant_be_purchased: { code: 2056, key: "Can't buy placeholder NFT." },
  collection_must_be_approved: { code: 2058, key: 'Collection must be approved.' },
  you_dont_have_required_badge: { code: 2059, key: "You don't have required badge." },
  you_dont_have_required_NFTs: { code: 2062, key: "You don't have required NFTs." },
  you_must_be_the_creator_of_this_collection: {
    code: 2060,
    key: 'You must be the creator of this collection.',
  },
  you_have_currently_another_order_in_progress: {
    code: 2061,
    key: 'You have currently another order in progress.',
  },
  you_can_only_own_one_nft_from_collection: {
    code: 2061,
    key: 'You can only own one NFT from the collection.',
  },
  collection_is_already_approved: { code: 2062, key: 'Collection is already approved.' },
  collection_is_already_rejected: { code: 2063, key: 'Collection is already rejected.' },
  collection_is_past_available_date: {
    code: 2064,
    key: 'Collection available from date is in the past already.',
  },
  nft_date_must_be_after_or_same_with_collection_available_from_date: {
    code: 2065,
    key: 'Collection available from date is after NFT available from date.',
  },
  you_must_be_the_owner_of_nft: { code: 2066, key: 'You must be the owner of NFT.' },
  nft_auction_already_in_progress: { code: 2067, key: 'NFT already have auction in progress.' },
  nft_placeholder_cant_be_updated: { code: 2068, key: "Can't update placeholder NFT." },
  you_cant_buy_your_nft: { code: 2069, key: 'You already own this NFT!' },
  you_are_not_allowed_member_to_purchase_this_nft: {
    code: 2070,
    key: 'You are not allowed member to purchase this NFT!',
  },
  this_is_limited_addition_collection: {
    code: 2071,
    key: 'Collection is limited edition. No NFT can be added after approval.',
  },
  royalty_fees_can_only_be_reduced: { code: 2072, key: 'Royalty fees can only be reduced.' },
  token_already_exists_for_space: { code: 2073, key: 'Only one token is allowed per space.' },
  token_symbol_must_be_globally_unique: {
    code: 2074,
    key: 'Token symbol must be globally unique.',
  },
  no_token_public_sale: { code: 2075, key: 'Token not on public sale.' },
  not_enough_funds: { code: 2076, key: 'Not enough funds to credit' },
  token_not_in_cool_down_period: { code: 2077, key: 'Token not in cool down period.' },
  no_tokens_available_for_airdrop: { code: 2078, key: 'No more tokens are available for airdrop.' },
  no_airdrop_to_claim: { code: 2079, key: 'No airdrop to claim.' },
  public_sale_already_set: { code: 2080, key: 'Public sale already set.' },
  no_available_tokens_for_sale: { code: 2081, key: 'No available tokens for sale.' },
  token_not_pre_minted: { code: 2082, key: 'Token not pre-minted.' },
  token_not_approved: { code: 2083, key: 'Token not approved.' },
  blocked_country: { code: 2084, key: 'You country is not supported for this transaction.' },
  token_in_invalid_status: { code: 2085, key: 'Token in invalid status.' },
  can_not_mint_in_pub_sale: {
    code: 2086,
    key: 'Token can not be minted in or before public sale.',
  },
  no_tokens_to_claim: { code: 2087, key: 'No tokens to claim.' },
  token_not_minted: { code: 2088, key: 'Token is not minted.' },
  invalid_collection_status: { code: 2089, key: 'Invalid collection status.' },
  nft_not_minted: { code: 2090, key: 'Nft not minted.' },
  invalid_nft_status: { code: 2091, key: 'Invalid nft status.' },
  nft_on_sale: { code: 2092, key: 'Nft is on sale.' },
  no_nfts_to_mint: { code: 2093, key: 'No nfts to mint in the collection.' },
  no_ipfs_media: { code: 2094, key: 'Nft does not have ipfs media' },
  hidden_nft: { code: 2095, key: 'Nft can not be hidden' },
  nft_already_sold: { code: 2096, key: 'Nft already sold' },
  member_already_knocking: { code: 2097, key: 'Member already asking to join space' },
  can_not_credit_transaction: { code: 2028, key: 'Can not credit this transaction' },
  transaction_already_confirmed: { code: 2029, key: 'Transaction already confirmed' },
  invalid_route: { code: 2030, key: 'Invalid route' },
  no_staked_soon: { code: 2031, key: 'Member has no staked SOONs' },
  token_does_not_exist: { code: 2032, key: 'Token does not exist' },
  token_based_space_access_can_not_be_edited: {
    code: 2033,
    key: 'Token based space access can not be edited',
  },
  not_enough_staked_tokens: { code: 2034, key: 'Member has not enough staked tokens' },
  signature_or_custom_token_must_be_provided: {
    code: 2035,
    key: 'Signature or custom Token must be provided.',
  },
  invalid_custom_token: { code: 2036, key: 'Invalid custom token.' },
};
