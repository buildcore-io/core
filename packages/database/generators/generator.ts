import { generatePgInterfaces } from './pg.interface.generator';

const main = async () => {
  await generatePgInterfaces();
};

main();
