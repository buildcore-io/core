interface Error {
  key: string;
  code: number;
}

export const invalidArgument = (err: Error, eMessage = '') => {
  // eslint-disable-next-line no-throw-literal
  throw { eCode: err.code, eKey: err.key, eMessage, status: 400 };
};

export const unAuthenticated = (err: Error) => {
  // eslint-disable-next-line no-throw-literal
  throw { eCode: err.code, eKey: err.key, status: 401 };
};
