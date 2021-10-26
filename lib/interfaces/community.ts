export interface Community {
  uid: string;
  name: string;
  guardians: {
    // Owner / from date
    [propName: string]: Date;
  };
  members: {
    // Owner / from date
    [propName: string]: Date;
  }
}
