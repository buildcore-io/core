import dayjs from 'dayjs';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, query, where } from 'firebase/firestore';
import { Network } from "../interfaces/models";
import { COL, SUB_COL } from "../interfaces/models/base";
import admin from '../src/admin.config';
import { projectId } from "./set-up";

const app = initializeApp({ projectId })
const db = getFirestore(app)

export const copyMilestoneTransactionsFromDev = (network: Network) => {
  const ref = collection(db, getCollectionRef(network))
  const whr = where('createdOn', '>=', dayjs().toDate())
  const qry = query(ref, whr)
  return onSnapshot(qry, snap => snap.docs.map(doc => onMilestoneChange(network, doc.data())))
}

const onMilestoneChange = async (network: Network, milestone: any) => {
  const transSnap = await getDocs(collection(db, `${getCollectionRef(network)}/${milestone.milestone}/${SUB_COL.TRANSACTIONS}`))
  if (!transSnap.size) {
    return
  }
  const mDocRef = admin.firestore().doc(`${getCollectionRef(network)}/${milestone.milestone}`)
  if (!(await mDocRef.get()).exists) {
    await mDocRef.set(cleanTimestamps(milestone))
  }
  const promises = transSnap.docs.map(async doc => {
    const tranDocRef = admin.firestore().doc(`${getCollectionRef(network)}/${milestone.milestone}/${SUB_COL.TRANSACTIONS}/${doc.id}`)
    if (!(await tranDocRef.get()).exists) {
      await tranDocRef.set({ ...cleanTimestamps(doc.data()), processed: false })
    }
  })
  await Promise.all(promises)
}

const cleanTimestamps = (data: any) => Object.entries(data).reduce((acc, [key, value]) => {
  const seconds = (value as any).seconds
  return { ...acc, [key]: seconds ? dayjs(seconds).toDate() : value }
}, {})

const getCollectionRef = (network: Network) => COL.MILESTONE + `_${network}`

export const copyDocFromDev = async (docPath: string) => {
  const docRef = await getDoc(doc(db, docPath))
  await admin.firestore().doc(docPath).set(cleanTimestamps(docRef.data()))
}


export const copySubCollections = async (col: string, id: string, subCol: string) => {
  const snap = await getDocs(query(collection(db, `${col}/${id}/${subCol}`)))
  for (const doc of snap.docs) {
    await admin.firestore().doc(`${col}/${id}/${subCol}/${doc.id}`).set(cleanTimestamps(doc.data()))
  }
}
