
/* eslint-disable @typescript-eslint/no-explicit-any */
import { OutputTypes, TREASURY_OUTPUT_TYPE } from "@iota/iota.js-next";
import dayjs from 'dayjs';
import * as adminPackage from 'firebase-admin';
import { last } from "lodash";
import { Network } from '../interfaces/models';
import { COL, SUB_COL } from '../interfaces/models/base';
import { MilestoneTransaction } from "../interfaces/models/milestone";
import admin from '../src/admin.config';
import { SmrWallet } from "../src/services/wallet/SmrWalletService";
import { WalletService } from "../src/services/wallet/wallet";
import { projectId } from '../test/set-up';

process.env.FIRESTORE_EMULATOR_HOST = '';
const config = {
  credential: adminPackage.credential.cert('./test-service-account-key.json'),
  databaseURL: `https://${projectId}.firebaseio.com`
}
const app = adminPackage.initializeApp(config, 'second')
const onlineDb = app.firestore()
process.env.FIRESTORE_EMULATOR_HOST = process.env.LOCAL_TEST ? 'localhost:8080' : '';

export class MilestoneListener {
  private shouldRun = true;
  private runner: Promise<any>

  constructor(private readonly network: Network) {
    this.runner = this.run()
  }

  public cancel = async () => {
    this.shouldRun = false
    await this.runner
  }

  private run = async () => {
    const wallet = await WalletService.newWallet(Network.RMS) as SmrWallet
    let createdOn = dayjs().toDate()
    for (let i = 0; i < 864000; ++i) {
      if (!this.shouldRun) {
        return
      }
      const query =
        onlineDb.collection(getCollectionRef(this.network)).where('createdOn', '>=', createdOn)
      const snap = await query.get()
      const promises = snap.docs.map(async (doc) => {
        await this.onMilestoneChange(this.network, doc.data(), SUB_COL.TRANSACTIONS, wallet)
      })
      await Promise.all(promises)
      createdOn = last(snap.docs)?.data()?.createdOn || dayjs().toDate()
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private onMilestoneChange = async (network: Network, milestone: any, subColl: SUB_COL, wallet: SmrWallet) => {
    const transSnap = await onlineDb.collection(`${getCollectionRef(this.network)}/${milestone.milestone}/${subColl}`).get()
    const docs = [] as any[]
    for (const doc of transSnap.docs) {
      const data = doc.data()
      const addresses = await getAddesses(data, network, wallet)
      if (await addressInDb(addresses)) {
        docs.push(doc)
      }
    }
    if (!docs.length) {
      return
    }
    const mDocRef = admin.firestore().doc(`${getCollectionRef(this.network)}/${milestone.milestone}`)
    if (!(await mDocRef.get()).exists) {
      await mDocRef.set(cleanTimestamps(milestone))
    }
    for (const doc of docs) {
      const tranDocRef = admin.firestore().doc(`${getCollectionRef(this.network)}/${milestone.milestone}/${subColl}/${doc.id}`)
      if (!(await tranDocRef.get()).exists) {
        await tranDocRef.set({ ...cleanTimestamps(doc.data()), processed: false })
      }
    }
  }

}

const cleanTimestamps = (data: any) => Object.entries(data).reduce((acc, [key, value]) => {
  const seconds = (value as any).seconds
  return { ...acc, [key]: seconds ? dayjs(seconds).toDate() : value }
}, {})

const getCollectionRef = (network: Network) => COL.MILESTONE + `_${network}`

const getAddesses = async (doc: any, network: Network, wallet: SmrWallet) => {
  if (network === Network.ATOI) {
    return (doc as MilestoneTransaction).outputs.map(o => o.address)
  }

  const promises = (doc.payload.essence.outputs as OutputTypes[])
    .filter(o => o.type !== TREASURY_OUTPUT_TYPE)
    .map(o => wallet.bechAddressFromOutput(o as any))
  return await Promise.all(promises)
}

const addressInDb = async (addresses: string[]) => {
  for (const address of addresses) {
    const exists = (await admin.firestore().collection(COL.MNEMONIC).doc(address).get()).exists
    if (exists) {
      return true
    }
  }
  return false
}
