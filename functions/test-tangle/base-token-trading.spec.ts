import { MIN_IOTA_AMOUNT } from "../interfaces/config";
import { Member, Network, TokenBuySellOrder, TokenPurchase, Transaction, TransactionType } from "../interfaces/models";
import { COL } from "../interfaces/models/base";
import admin from "../src/admin.config";
import { createMember } from "../src/controls/member.control";
import { tradeBaseTokenOrder } from "../src/controls/token-sale/trade-base-token.controller";
import { AddressDetails, WalletService } from "../src/services/wallet/wallet";
import * as wallet from '../src/utils/wallet.utils';
import { createRoyaltySpaces, mockWalletReturnValue, wait } from "../test/controls/common";
import { projectId, testEnv } from "../test/set-up";
import { addValidatedAddress } from "./common";
import { MilestoneListener } from "./db-sync.utils";
import { requestFundsFromFaucet } from "./faucet";

let walletSpy: any;

describe('Base token trading', () => {
    let listenerATOI: MilestoneListener
    let listenerRMS: MilestoneListener
    let seller: Member
    const sellerValidateAddress = {} as { [key: string]: AddressDetails }
    let buyer: Member
    const buyerValidateAddress = {} as { [key: string]: AddressDetails }

    beforeEach(async () => {
        await createRoyaltySpaces()
        walletSpy = jest.spyOn(wallet, 'decodeAuth');
        listenerATOI = new MilestoneListener(Network.ATOI)
        listenerRMS = new MilestoneListener(Network.RMS)

        const sellerId = wallet.getRandomEthAddress();
        mockWalletReturnValue(walletSpy, sellerId, {})
        await testEnv.wrap(createMember)(sellerId);
        sellerValidateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, sellerId)
        sellerValidateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, sellerId)
        seller = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${sellerId}`).get()).data()

        const buyerId = wallet.getRandomEthAddress();
        mockWalletReturnValue(walletSpy, buyerId, {})
        await testEnv.wrap(createMember)(buyerId);
        buyerValidateAddress[Network.ATOI] = await addValidatedAddress(Network.ATOI, buyerId)
        buyerValidateAddress[Network.RMS] = await addValidatedAddress(Network.RMS, buyerId)
        buyer = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${buyerId}`).get()).data()
    })

    it('Should fulfill sell order', async () => {
        const sourceNetwork = Network.RMS
        const targetNetwork = Network.ATOI
        const sourceWallet = WalletService.newWallet(sourceNetwork)
        const targetWallet = WalletService.newWallet(targetNetwork)

        await requestFundsFromFaucet(sourceNetwork, sellerValidateAddress[sourceNetwork].bech32, 10 * MIN_IOTA_AMOUNT)
        mockWalletReturnValue(walletSpy, seller.uid, { sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
        const sellOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
        await sourceWallet.sendFromGenesis(sellerValidateAddress[sourceNetwork], sellOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT, '')

        await requestFundsFromFaucet(targetNetwork, buyerValidateAddress[targetNetwork].bech32, 10 * MIN_IOTA_AMOUNT)
        mockWalletReturnValue(walletSpy, buyer.uid, { sourceNetwork: targetNetwork, count: 10, price: MIN_IOTA_AMOUNT })
        const buyOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
        await targetWallet.sendFromGenesis(buyerValidateAddress[targetNetwork], buyOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT, '')

        const sellQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
        await wait(async () => {
            const snap = await sellQuery.get()
            return snap.size !== 0
        })
        const sell = <TokenBuySellOrder>(await sellQuery.get()).docs[0].data()

        const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid)
        await wait(async () => {
            const snap = await buyQuery.get()
            return snap.size !== 0
        })
        const buy = <TokenBuySellOrder>(await buyQuery.get()).docs[0].data()

        const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).where('buy', '==', buy.uid)
        await wait(async () => {
            const snap = await purchaseQuery.get()
            return snap.size !== 0
        })
        const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

        expect(purchase.count).toBe(10)
        expect(purchase.price).toBe(MIN_IOTA_AMOUNT)
        expect(purchase.sourceNetwork).toBe(sourceNetwork)
        expect(purchase.targetNetwork).toBe(targetNetwork)

        const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', sell.owner).where('type', '==', TransactionType.BILL_PAYMENT).get()
        const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
        expect(sellerBillPayments.filter(p => p.ignoreWallet).length).toBe(1)
        expect(sellerBillPayments.filter(p => !p.ignoreWallet).length).toBe(2)

        const buyerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buy.owner).where('type', '==', TransactionType.BILL_PAYMENT).get()
        const buyerBillPayments = buyerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
        expect(buyerBillPayments.length).toBe(1)
    })

    it('Should fulfill buy order with half price', async () => {
        const sourceNetwork = Network.RMS
        const targetNetwork = Network.ATOI
        const sourceWallet = WalletService.newWallet(sourceNetwork)
        const targetWallet = WalletService.newWallet(targetNetwork)

        await requestFundsFromFaucet(sourceNetwork, sellerValidateAddress[sourceNetwork].bech32, 10 * MIN_IOTA_AMOUNT)
        mockWalletReturnValue(walletSpy, seller.uid, { sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
        const sellOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
        await sourceWallet.sendFromGenesis(sellerValidateAddress[sourceNetwork], sellOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT, '')

        await requestFundsFromFaucet(targetNetwork, buyerValidateAddress[targetNetwork].bech32, 20 * MIN_IOTA_AMOUNT)
        mockWalletReturnValue(walletSpy, buyer.uid, { sourceNetwork: targetNetwork, count: 10, price: 2 * MIN_IOTA_AMOUNT })
        const buyOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
        await targetWallet.sendFromGenesis(buyerValidateAddress[targetNetwork], buyOrder.payload.targetAddress, 20 * MIN_IOTA_AMOUNT, '')

        const sellQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
        await wait(async () => {
            const snap = await sellQuery.get()
            return snap.size !== 0
        })
        const sell = <TokenBuySellOrder>(await sellQuery.get()).docs[0].data()

        const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid)
        await wait(async () => {
            const snap = await buyQuery.get()
            return snap.size !== 0
        })
        const buy = <TokenBuySellOrder>(await buyQuery.get()).docs[0].data()

        const purchaseQuery = admin.firestore().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid).where('buy', '==', buy.uid)
        await wait(async () => {
            const snap = await purchaseQuery.get()
            return snap.size !== 0
        })
        const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data()

        expect(purchase.count).toBe(10)
        expect(purchase.price).toBe(MIN_IOTA_AMOUNT)
        expect(purchase.sourceNetwork).toBe(sourceNetwork)
        expect(purchase.targetNetwork).toBe(targetNetwork)

        const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', sell.owner).where('type', '==', TransactionType.BILL_PAYMENT).get()
        const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
        expect(sellerBillPayments.filter(p => p.ignoreWallet).length).toBe(1)
        expect(sellerBillPayments.filter(p => !p.ignoreWallet).length).toBe(2)

        const buyerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buy.owner).where('type', '==', TransactionType.BILL_PAYMENT).get()
        const buyerBillPayments = buyerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
        expect(buyerBillPayments.length).toBe(1)

        const buyerCreditSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', buy.owner).where('type', '==', TransactionType.CREDIT).get()
        const buyerCredits = buyerCreditSnap.docs.map(d => d.data() as Transaction)
        expect(buyerCredits.length).toBe(1)
    })

    it('Should fulfill buy with two sells', async () => {
        const sourceNetwork = Network.RMS
        const targetNetwork = Network.ATOI
        const sourceWallet = WalletService.newWallet(sourceNetwork)
        const targetWallet = WalletService.newWallet(targetNetwork)

        await requestFundsFromFaucet(sourceNetwork, sellerValidateAddress[sourceNetwork].bech32, 20 * MIN_IOTA_AMOUNT)
        mockWalletReturnValue(walletSpy, seller.uid, { sourceNetwork, count: 10, price: MIN_IOTA_AMOUNT })
        const sellPromises = Array.from(Array(2)).map(async (_, index) => {
            const sellQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', seller.uid)
            await wait(async () => {
                const snap = await sellQuery.get()
                return snap.size !== index
            })
            const sellOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
            await sourceWallet.sendFromGenesis(sellerValidateAddress[sourceNetwork], sellOrder.payload.targetAddress, 10 * MIN_IOTA_AMOUNT, '')
        })
        await Promise.all(sellPromises)
        await requestFundsFromFaucet(targetNetwork, buyerValidateAddress[targetNetwork].bech32, 20 * MIN_IOTA_AMOUNT)
        mockWalletReturnValue(walletSpy, buyer.uid, { sourceNetwork: targetNetwork, count: 20, price: MIN_IOTA_AMOUNT })
        const buyOrder = await testEnv.wrap(tradeBaseTokenOrder)({})
        await targetWallet.sendFromGenesis(buyerValidateAddress[targetNetwork], buyOrder.payload.targetAddress, 20 * MIN_IOTA_AMOUNT, '')

        const buyQuery = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', buyer.uid)
        await wait(async () => {
            const buy = <TokenBuySellOrder | undefined>(await buyQuery.get()).docs[0]?.data()
            return buy !== undefined && buy.count === buy.fulfilled
        })

        const sellerBillPaymentsSnap = await admin.firestore().collection(COL.TRANSACTION).where('member', '==', seller.uid).where('type', '==', TransactionType.BILL_PAYMENT).get()
        const sellerBillPayments = sellerBillPaymentsSnap.docs.map(d => d.data() as Transaction)
        expect(sellerBillPayments.filter(p => p.ignoreWallet).length).toBe(2)
        expect(sellerBillPayments.filter(p => !p.ignoreWallet).length).toBe(4)

        const total = sellerBillPayments.reduce((acc, act) => act.ignoreWallet ? acc : acc + act.payload.amount, 0)
        expect(total).toBe(20 * MIN_IOTA_AMOUNT)
    })

    afterEach(async () => {
        await listenerATOI.cancel()
        await listenerRMS.cancel()
    })
})