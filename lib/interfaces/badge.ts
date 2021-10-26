
export interface Badge {
  uid: string;
  name: string;
  owners: {
    // Owner / from date
    [propName: string]: Date;
  };
}
