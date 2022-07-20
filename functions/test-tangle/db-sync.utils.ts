
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ALIAS_OUTPUT_TYPE,
  BASIC_OUTPUT_TYPE, FOUNDRY_OUTPUT_TYPE, IAliasOutput, IBasicOutput, IFoundryOutput, INftOutput, NFT_OUTPUT_TYPE, OutputTypes
} from "@iota/iota.js-next";
import dayjs from 'dayjs';
import * as adminPackage from 'firebase-admin';
import { Network } from '../interfaces/models';
import { COL, SUB_COL } from '../interfaces/models/base';
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
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

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
    const query = onlineDb.collection(getCollectionRef(this.network)).where('createdOn', '>=', dayjs().toDate())
    for (let i = 0; i < 864000; ++i) {
      if (!this.shouldRun) {
        return
      }
      const snap = await query.get()
      for (const doc of snap.docs) {
        await this.onMilestoneChange(this.network, doc.data())
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private onMilestoneChange = async (network: Network, milestone: any) => {
    const transSnap = await onlineDb.collection(`${getCollectionRef(this.network)}/${milestone.milestone}/${SUB_COL.TRANSACTIONS}`).get()
    const docs = [] as any[]
    for (const doc of transSnap.docs) {
      if (network === Network.ATOI) {
        docs.push(doc)
      }
      const data = doc.data()
      const outputs = (data?.payload?.essence?.outputs || []) as OutputTypes[]
      if (await addressInDb(outputs)) {
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
      const tranDocRef = admin.firestore().doc(`${getCollectionRef(this.network)}/${milestone.milestone}/${SUB_COL.TRANSACTIONS}/${doc.id}`)
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

const addressInDb = async (outputs: OutputTypes[]) => {
  const wallet = WalletService.newWallet(Network.RMS) as SmrWallet
  const valid = outputs
    .filter(o => [BASIC_OUTPUT_TYPE, ALIAS_OUTPUT_TYPE, FOUNDRY_OUTPUT_TYPE, NFT_OUTPUT_TYPE].includes(o.type))
    .map(o => <IBasicOutput | IAliasOutput | IFoundryOutput | INftOutput>o)
  for (const output of valid) {
    const address = await wallet.bechAddressFromOutput(output)
    const exists = (await admin.firestore().collection('_mnemonic').doc(address).get()).exists
    if (exists) {
      return true
    }
  }
  return false
}