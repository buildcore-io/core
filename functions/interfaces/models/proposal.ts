import { Base, BaseRecord } from './base';
export enum ProposalType {
  NATIVE = "NATIVE",
  DIGITAL_ASSET = "DIGITAL_ASSET",
  SMART_CONTRACT = "SMART_CONTRACT"
}

export interface NativeProposalSettings {
  beginMilestone: number;
  startMilestone: number;
  endMilestone: number;
}

export interface DigitalAssetProposalSettings {
  // none yet.
  add: any;
}

export interface SmartContractProposalSettings {
  // none yet.
  add: any;
}

export interface ProposalAnswer extends Base {
  name: string;
  description: string;
}

export interface ProposalQuestion extends Base {
  name: string;
  description: string;
  answers: ProposalAnswer[];
}

export interface Proposal extends BaseRecord {
  uid: string;
  name: string;
  description: string;
  type: ProposalType;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
  settings: NativeProposalSettings|DigitalAssetProposalSettings|SmartContractProposalSettings;
  questions: ProposalQuestion[];
}
