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
}

export interface SmartContractProposalSettings {
  // none yet.
}

export interface ProposalAnswer {
  uid: string;
  name: string;
  description: string;
}

export interface ProposalQuestion {
  uid: string;
  name: string;
  description: string;
  answers: ProposalAnswer[];
}

export interface Proposal {
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
