import {
  COL,
  Member,
  Network,
  TRANSACTION_AUTO_EXPIRY_MS,
  Token,
  TokenMintRequest,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import { TransactionHelper } from '@iota/iota.js-next';
import dayjs from 'dayjs';
import { build5Db } from '../../firebase/firestore/build5Db';
import { Wallet } from '../../services/wallet/wallet';
import { AddressDetails, WalletService } from '../../services/wallet/wallet.service';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { createAliasOutput } from '../../utils/token-minting-utils/alias.utils';
import {
  createFoundryOutput,
  getVaultAndGuardianOutput,
  tokenToFoundryMetadata,
} from '../../utils/token-minting-utils/foundry.utils';
import { getOwnedTokenTotal } from '../../utils/token-minting-utils/member.utils';
import {
  assertIsGuardian,
  assertTokenStatus,
  getUnclaimedAirdropTotalValue,
} from '../../utils/token.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const mintTokenControl = (owner: string, params: TokenMintRequest) =>
  build5Db().runTransaction(async (transaction) => {
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${params.token}`);
    const token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.invalid_params);
    }

    if (token.coolDownEnd && dayjs().subtract(1, 'm').isBefore(dayjs(token.coolDownEnd.toDate()))) {
      throw invalidArgument(WenError.can_not_mint_in_pub_sale);
    }

    assertTokenStatus(token, [TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED]);

    await assertIsGuardian(token.space, owner);
    const member = await build5Db().doc(`${COL.MEMBER}/${owner}`).get<Member>();
    assertMemberHasValidAddress(member, params.network as Network);

    const wallet = await WalletService.newWallet(params.network as Network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const totalDistributed =
      (await getOwnedTokenTotal(token.uid)) + (await getUnclaimedAirdropTotalValue(token.uid));
    const storageDeposits = await getStorageDepositForMinting(
      token,
      totalDistributed,
      targetAddress,
      wallet,
    );

    const order: Transaction = {
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: token!.space,
      network: params.network as Network,
      payload: {
        type: TransactionPayloadType.MINT_TOKEN,
        amount: Object.values(storageDeposits).reduce((acc, act) => acc + act, 0),
        targetAddress: targetAddress.bech32,
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
        reconciled: false,
        void: false,
        token: params.token,
        ...storageDeposits,
        tokensInVault: totalDistributed,
      },
    };
    transaction.create(build5Db().doc(`${COL.TRANSACTION}/${order.uid}`), order);
    return order;
  });

const getStorageDepositForMinting = async (
  token: Token,
  totalDistributed: number,
  address: AddressDetails,
  wallet: Wallet,
) => {
  const aliasOutput = createAliasOutput(address, wallet.info);
  const metadata = await tokenToFoundryMetadata(token);
  const foundryOutput = createFoundryOutput(
    token.totalSupply,
    aliasOutput,
    JSON.stringify(metadata),
    wallet.info,
  );
  const tokenId = TransactionHelper.constructTokenId(
    aliasOutput.aliasId,
    foundryOutput.serialNumber,
    foundryOutput.tokenScheme.type,
  );
  const { vaultOutput, guardianOutput } = await getVaultAndGuardianOutput(
    tokenId,
    token.totalSupply,
    totalDistributed,
    address.bech32,
    address.bech32,
    wallet.info,
  );
  const aliasStorageDeposit = TransactionHelper.getStorageDeposit(
    aliasOutput,
    wallet.info.protocol.rentStructure,
  );
  const foundryStorageDeposit = TransactionHelper.getStorageDeposit(
    foundryOutput,
    wallet.info.protocol.rentStructure,
  );
  return {
    aliasStorageDeposit,
    foundryStorageDeposit,
    vaultStorageDeposit: Number(vaultOutput?.amount || 0),
    guardianStorageDeposit: Number(guardianOutput?.amount || 0),
  };
};
