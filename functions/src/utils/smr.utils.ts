
import { Ed25519 } from "@iota/crypto.js-next";
import { ED25519_SIGNATURE_TYPE, IKeyPair, ISignatureUnlock, ITransactionEssence, ITransactionPayload, IUTXOInput, OutputTypes, SIGNATURE_UNLOCK_TYPE, TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE } from "@iota/iota.js-next";
import { Converter } from "@iota/util.js-next";

export const createUnlock = (essence: ITransactionEssence, keyPair: IKeyPair): ISignatureUnlock => {
  const essenceHash = TransactionHelper.getTransactionEssenceHash(essence)
  return {
    type: SIGNATURE_UNLOCK_TYPE,
    signature: {
      type: ED25519_SIGNATURE_TYPE,
      publicKey: Converter.bytesToHex(keyPair.publicKey, true),
      signature: Converter.bytesToHex(Ed25519.sign(keyPair.privateKey, essenceHash), true)
    }
  };
}

export const createPayload = (
  networkId: string,
  inputs: IUTXOInput[],
  outputs: OutputTypes[],
  commitment: string,
  keyPair: IKeyPair
): ITransactionPayload => {
  const essence: ITransactionEssence = { type: TRANSACTION_ESSENCE_TYPE, networkId, inputs, outputs, inputsCommitment: commitment };
  return { type: TRANSACTION_PAYLOAD_TYPE, essence, unlocks: [createUnlock(essence, keyPair)] };
}

export const getTransactionPayloadHex = (payload: ITransactionPayload) =>
  Converter.bytesToHex(TransactionHelper.getTransactionPayloadHash(payload), true) + "0000";
