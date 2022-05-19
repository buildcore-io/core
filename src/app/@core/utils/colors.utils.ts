export const INITIAL_COLORS = [
  '#F39200',
  '#008AF2',
  '#7863CB',
  '#EA849D',
  '#7CD4AA'
];

export const getRandomColor = (): string => `#${((1<<24)*Math.random() | 0).toString(16)}`;