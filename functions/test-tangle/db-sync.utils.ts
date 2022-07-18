/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';
import * as adminPackage from 'firebase-admin';
import { Network } from '../interfaces/models';
import { COL, SUB_COL } from '../interfaces/models/base';
import admin from '../src/admin.config';
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
        await this.onMilestoneChange(doc.data())
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private onMilestoneChange = async (milestone: any) => {
    const transSnap = await onlineDb.collection(`${getCollectionRef(this.network)}/${milestone.milestone}/${SUB_COL.TRANSACTIONS}`).get()
    if (!transSnap.size) {
      return
    }
    const mDocRef = admin.firestore().doc(`${getCollectionRef(this.network)}/${milestone.milestone}`)
    if (!(await mDocRef.get()).exists) {
      await mDocRef.set(cleanTimestamps(milestone))
    }
    for (const doc of transSnap.docs) {
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
