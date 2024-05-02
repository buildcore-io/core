import { COL, SUB_COL } from '@buildcore/interfaces';

export const getPathParts = (path: string) => {
  const [col, colId, subCol, subColId] = path.split('/');
  return { col: col as COL.MILESTONE, colId, subCol: subCol as SUB_COL.TRANSACTIONS, subColId };
};
