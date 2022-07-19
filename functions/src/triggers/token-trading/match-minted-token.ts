import { IBasicOutput, INodeInfo, ITransactionEssence, ITransactionPayload, SingleNodeClient, TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE, UnlockTypes } from "@iota/iota.js-next";
import { HexHelper } from "@iota/util.js-next";
import bigInt from "big-integer";
import bigDecimal from "js-big-decimal";
import { last } from "lodash";
import { DEFAULT_NETWORK } from "../../../interfaces/config";
import { Member, Space, Transaction, TransactionCreditType, TransactionType } from "../../../interfaces/models";
import { COL } from "../../../interfaces/models/base";
import { NativeToken } from "../../../interfaces/models/milestone";
import { Token, TokenPurchase, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from "../../../interfaces/models/token";
import admin from "../../admin.config";
import { MnemonicService } from "../../services/wallet/mnemonic";
import { createUnlock } from "../../services/wallet/token/common.utils";
import { getNodeEnpoint, WalletService } from "../../services/wallet/wallet";
import { getAddress } from "../../utils/address.utils";
import { fetchAndWaitForBasicOutput, packBasicOutput, submitBlocks } from "../../utils/basic-output.utils";
import { waitForBlockToBecomeSolid } from "../../utils/block.utils";
import { guardedRerun } from "../../utils/common.utils";
import { serverTime, uOn } from '../../utils/dateTime.utils';
import { Logger } from "../../utils/logger.utils";
import { getRoyaltyFees } from "../../utils/token-trade.utils";
import { getRandomEthAddress } from "../../utils/wallet.utils";
import { getSaleQuery, StartAfter } from "./token-trade-order.trigger";

export const matchMintedToken = async (id: string, prev: TokenTradeOrder | undefined, next: TokenTradeOrder | undefined) => {
  if (prev === undefined || (!prev.shouldRetry && next?.shouldRetry)) {
    const logger = new Logger();
    logger.add('onTokenBuySellCreated', id)
    let startAfter: StartAfter | undefined = undefined
    await guardedRerun(async () => {
      startAfter = await fulfillSales(id, startAfter, logger)
      return startAfter !== undefined
    }, 10000000)
    return;
  }
}

const submitOutputs = async (
  client: SingleNodeClient,
  buyConsumedOutput: IBasicOutput,
  buyConsumedOutputId: string,
  sellConsumedOutput: IBasicOutput,
  sellConsumedOutputId: string,
  outputs: IBasicOutput[],
  buyOrderTran: Transaction,
  sellOrderTran: Transaction,
  token: Token
) => {
  const info = await client.info()
  const buyInput = TransactionHelper.inputFromOutputId(buyConsumedOutputId)
  const sellInput = TransactionHelper.inputFromOutputId(sellConsumedOutputId)
  const inputsCommitment = TransactionHelper.getInputsCommitment([buyConsumedOutput, sellConsumedOutput]);
  const essence: ITransactionEssence = {
    type: TRANSACTION_ESSENCE_TYPE,
    networkId: TransactionHelper.networkIdFromNetworkName(info.protocol.networkName),
    inputs: [buyInput, sellInput],
    outputs: outputs,
    inputsCommitment
  };
  const wallet = WalletService.newWallet(token.mintingData?.network!)
  const buyerMnemonic = await MnemonicService.get(buyOrderTran.payload.targetAddress)
  const sellerMnemonic = await MnemonicService.get(sellOrderTran.payload.targetAddress)
  const unlocks: UnlockTypes[] = [
    createUnlock(essence, (await wallet.getIotaAddressDetails(buyerMnemonic)).keyPair),
    createUnlock(essence, (await wallet.getIotaAddressDetails(sellerMnemonic)).keyPair)
  ];
  const payload: ITransactionPayload = { type: TRANSACTION_PAYLOAD_TYPE, essence: essence, unlocks }
  const blockId = (await submitBlocks(client, [payload]))[0]
  await waitForBlockToBecomeSolid(client, blockId)
  return blockId
}

const createBillPayment = (
  transaction: admin.firestore.Transaction,
  space: string,
  member: string,
  amount: number,
  nativeToken: NativeToken | undefined,
  sourceAddress: string,
  targetAddress: string,
  sourceTransaction: string,
  token: Token
) => {
  const data = <Transaction>{
    type: TransactionType.BILL_PAYMENT,
    uid: getRandomEthAddress(),
    space,
    member,
    createdOn: serverTime(),
    sourceNetwork: token.mintingData?.network!,
    targetNetwork: token.mintingData?.network!,
    payload: {
      amount,
      nativeToken: nativeToken || {},
      sourceAddress,
      targetAddress,
      previousOwnerEntity: 'member',
      previousOwner: member,
      sourceTransaction: [sourceTransaction],
      royalty: false,
      void: false,
      token: token.uid
    },
    ignoreWallet: true
  }
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
  return data.uid
}

const creditBuyer = (transaction: admin.firestore.Transaction, buy: TokenTradeOrder, buyer: Member, buyOrder: Transaction, token: Token, amount: number) => {
  const data = <Transaction>{
    type: TransactionType.CREDIT,
    uid: getRandomEthAddress(),
    space: token.space,
    member: buyer.uid,
    createdOn: serverTime(),
    sourceNetwork: buyOrder.sourceNetwork || DEFAULT_NETWORK,
    targetNetwork: buyOrder.targetNetwork || DEFAULT_NETWORK,
    payload: {
      type: TransactionCreditType.TOKEN_BUY,
      amount,
      sourceAddress: buyOrder.payload.targetAddress,
      targetAddress: getAddress(buyer.validatedAddress, token.mintingData?.network!),
      sourceTransaction: [buy.paymentTransactionId],
      token: token.uid,
      reconciled: true,
      void: false,
      invalidPayment: true
    },
    ignoreWallet: true
  };
  transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
  transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${buy.uid}`), uOn({ creditTransactionId: data.uid }))
  return data.uid
}

const getRoyaltyOutputs = async (
  transaction: admin.firestore.Transaction,
  token: Token,
  buy: TokenTradeOrder,
  seller: Member,
  buyer: Member,
  buyOrderTran: Transaction,
  sellPrice: number,
  info: INodeInfo
) => {
  const royaltyFees = getRoyaltyFees(sellPrice)

  const promises = Object.entries(royaltyFees).map(async ([spaceId, fee]) => {
    const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${spaceId}`).get()).data()
    const spaceAddress = getAddress(space.validatedAddress, token.mintingData?.network!)
    const sellerAddress = getAddress(seller.validatedAddress, token.mintingData?.network!)
    const output = packBasicOutput(spaceAddress, 0, undefined, info, sellerAddress)
    const data = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      space: spaceId,
      member: buyer.uid,
      createdOn: serverTime(),
      sourceNetwork: token.mintingData?.network!,
      targetNetwork: token.mintingData?.network!,
      payload: {
        amount: Number(output.amount) + fee,
        storageReturn: {
          amount: Number(output.amount),
          address: sellerAddress,
        },
        sourceAddress: buyOrderTran.payload.targetAddress,
        targetAddress: spaceAddress,
        previousOwnerEntity: 'member',
        previousOwner: buyer.uid,
        sourceTransaction: [buy.paymentTransactionId],
        royalty: false,
        void: false,
        token: token.uid
      },
      ignoreWallet: true
    }
    transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
    output.amount = (Number(output.amount) + fee).toString()
    return output
  })

  return (await Promise.all(promises)).filter(o => o !== undefined).map(o => <IBasicOutput>o)
}

const createOutputsAndPurchase = async (transaction: admin.firestore.Transaction, buy: TokenTradeOrder, sell: TokenTradeOrder, token: Token) => {
  const client = new SingleNodeClient(getNodeEnpoint(token.mintingData?.network!))
  const info = await client.info()

  const seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sell.owner}`).get()).data()
  const buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buy.owner}`).get()).data()

  const buyOrderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${buy.orderTransactionId}`).get()).data()
  const sellOrderTran = <Transaction>(await admin.firestore().doc(`${COL.TRANSACTION}/${sell.orderTransactionId}`).get()).data()

  const buyConsumedOutputId = await fetchAndWaitForBasicOutput(client, buyOrderTran.payload.targetAddress)
  const buyConsumedOutput = (await client.output(buyConsumedOutputId)).output as IBasicOutput

  const sellConsumedOutputId = await fetchAndWaitForBasicOutput(client, sellOrderTran.payload.targetAddress, true)
  const sellConsumedOutput = (await client.output(sellConsumedOutputId)).output as IBasicOutput

  const tokensLeftToSell = sell.count - sell.fulfilled
  const tokensToSell = Math.min(tokensLeftToSell, buy.count - buy.fulfilled);

  let sellPrice = Number(bigDecimal.floor(bigDecimal.multiply(sell.price, tokensToSell)))
  const outputs = [] as IBasicOutput[]
  let outputBalance = Number(buyConsumedOutput.amount) + Number(sellConsumedOutput.amount)

  const spaceOutputs = await getRoyaltyOutputs(transaction, token, buy, seller, buyer, buyOrderTran, sellPrice, info)
  outputs.push(...spaceOutputs)
  spaceOutputs.forEach(o => {
    outputBalance -= Number(o.amount)
    sellPrice -= Number(o.amount)
  })

  const sellerAddress = getAddress(seller.validatedAddress, token.mintingData?.network!)
  const buyerAddress = getAddress(buyer.validatedAddress, token.mintingData?.network!)
  const tokensSentToBuyer = { id: token.mintingData?.tokenId!, amount: HexHelper.fromBigInt256(bigInt(tokensToSell)) }
  const buyPayment = packBasicOutput(buyerAddress, 0, tokensSentToBuyer, info, sellerAddress)
  outputBalance -= Number(buyPayment.amount)
  sellPrice -= Number(buyPayment.amount)
  const buyerBillPaymentId = createBillPayment(
    transaction,
    token.space,
    sell.owner,
    Number(buyPayment.amount),
    tokensSentToBuyer,
    sellOrderTran.payload.targetAddress,
    getAddress(buyer.validatedAddress, token.mintingData?.network!),
    sellOrderTran.uid,
    token
  )
  outputs.push(buyPayment)

  const sellPayment = packBasicOutput(sellerAddress, sellPrice, undefined, info)
  outputBalance -= Number(sellPayment.amount)
  const billPaymentId = createBillPayment(
    transaction,
    token.space,
    buy.owner,
    sellPrice,
    undefined,
    buyOrderTran.payload.targetAddress,
    getAddress(seller.validatedAddress, token.mintingData?.network!),
    buyOrderTran.uid,
    token
  )
  outputs.push(sellPayment)

  const remainingTokens = tokensLeftToSell - tokensToSell
  if (remainingTokens) {
    const nativeToken = { id: token.mintingData?.tokenId!, amount: HexHelper.fromBigInt256(bigInt(remainingTokens)) }
    const sellRemainder = packBasicOutput(sellOrderTran.payload.targetAddress, 0, nativeToken, info)
    outputBalance -= Number(sellRemainder.amount)
    outputs.push(sellRemainder)
  } else {
    const sellerAddress = getAddress(seller.validatedAddress, token.mintingData?.network!)
    const sellRemainder = packBasicOutput(sellerAddress, Number(sellConsumedOutput.amount), undefined, info)
    outputBalance -= Number(sellRemainder.amount)
    outputs.push(sellRemainder)
    const data = <Transaction>{
      type: TransactionType.CREDIT,
      uid: getRandomEthAddress(),
      space: token.space,
      member: seller.uid,
      createdOn: serverTime(),
      sourceNetwork: token.mintingData?.network!,
      targetNetwork: token.mintingData?.network!,
      payload: {
        type: TransactionCreditType.TOKEN_BUY,
        amount: Number(sellConsumedOutput.amount),
        sourceAddress: sellOrderTran.payload.targetAddress,
        targetAddress: getAddress(seller.validatedAddress, token.mintingData?.network!),
        sourceTransaction: [sell.paymentTransactionId],
        token: token.uid,
        reconciled: true,
        void: false,
      },
      ignoreWallet: true
    };
    transaction.create(admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`), data)
    transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`), uOn({ creditTransactionId: data.uid }))
  }

  if (outputBalance > 0) {
    const isBuyFulfilled = buy.fulfilled + tokensToSell === buy.count
    const targetAddress = isBuyFulfilled ? getAddress(buyer.validatedAddress, token.mintingData?.network!) : buyOrderTran.payload.targetAddress
    if (isBuyFulfilled) {
      const creditTransactionId = creditBuyer(transaction, buy, buyer, buyOrderTran, token, outputBalance)
      transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${buy.uid}`), { creditTransactionId })
    }
    const buyerRemainder = packBasicOutput(targetAddress, outputBalance, undefined, info)
    outputBalance -= Number(buyerRemainder.amount)
    outputs.push(buyerRemainder)
  }

  if (outputBalance !== 0) {
    return undefined
  }

  const blockId = await submitOutputs(
    client,
    buyConsumedOutput,
    buyConsumedOutputId,
    sellConsumedOutput,
    sellConsumedOutputId,
    outputs,
    buyOrderTran,
    sellOrderTran,
    token
  )

  return <TokenPurchase>({
    uid: getRandomEthAddress(),
    token: buy.token,
    sell: sell.uid,
    buy: buy.uid,
    count: tokensToSell,
    price: sell.price,
    createdOn: serverTime(),
    blockId,
    billPaymentId,
    buyerBillPaymentId
  })
}

const updateSale = (sale: TokenTradeOrder, purchase: TokenPurchase) => {
  const fulfilled = sale.fulfilled + purchase.count
  const balanceFunc = sale.type === TokenTradeOrderType.BUY ? bigDecimal.subtract : bigDecimal.add
  const purchaseAmount = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price))
  const balance = Number(balanceFunc(sale.balance, purchaseAmount))
  const status = sale.count === fulfilled ? TokenTradeOrderStatus.SETTLED : TokenTradeOrderStatus.ACTIVE
  return ({ ...sale, fulfilled, balance, status })
}

const fulfillSales = (docId: string, startAfter: StartAfter | undefined, logger: Logger) => admin.firestore().runTransaction(async (transaction) => {
  const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${docId}`)
  const doc = <TokenTradeOrder>(await transaction.get(docRef)).data()
  if (doc.status !== TokenTradeOrderStatus.ACTIVE) {
    return
  }
  const docs = (await getSaleQuery(doc, startAfter).get()).docs
  const sales = docs.length ? (await transaction.getAll(...docs.map(d => d.ref))).map(d => <TokenTradeOrder>d.data()) : []
  logger.add('Trying sales', sales.map(d => d.uid))
  const purchases = [] as TokenPurchase[]
  const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${doc.token}`).get()).data()

  let update = { ...doc }
  for (const b of sales) {
    const isSell = doc.type === TokenTradeOrderType.SELL
    const prevBuy = isSell ? b : update
    const prevSell = isSell ? update : b
    if ([prevBuy.status, prevSell.status].includes(TokenTradeOrderStatus.SETTLED)) {
      continue
    }
    const purchase = await createOutputsAndPurchase(transaction, prevBuy, prevSell, token)
    if (!purchase) {
      continue
    }
    const sell = updateSale(prevSell, purchase)
    const buy = updateSale(prevBuy, purchase)
    const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${b.uid}`)
    transaction.update(docRef, uOn(isSell ? buy : sell))

    transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase)
    purchases.push(purchase)
    update = isSell ? sell : buy
  }

  transaction.update(docRef, uOn({ ...update, shouldRetry: false }))

  const lastDoc = last(docs)

  if (update.fulfilled === doc.fulfilled && !lastDoc) {
    logger.print()
  }

  return update.status === TokenTradeOrderStatus.SETTLED ? undefined : lastDoc
})
