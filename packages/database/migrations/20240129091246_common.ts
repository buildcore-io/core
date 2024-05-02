import type { Knex } from 'knex';

export const createTable = async (
  knex: Knex,
  col: string,
  subCol: string | undefined,
  callback: (tableBuilder: Knex.CreateTableBuilder) => any,
) => {
  const table = col + (subCol ? `_${subCol}` : '').toLowerCase();
  await knex.schema.createTable(table, callback);

  await knex.raw(`
      CREATE OR REPLACE TRIGGER set_updated_on
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION set_updated_on_func();
    `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION ${table}_upsert_func() RETURNS TRIGGER AS $$
    DECLARE
      payload JSONB;
    BEGIN
      payload := jsonb_build_object(
        'table', TG_TABLE_NAME,
        'uid', NEW.uid
        ${subCol ? ',\'parentId\', NEW."parentId"' : ''} 
      );

      PERFORM pg_notify('onupsert', payload::text);

      RETURN NEW;
      END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE TRIGGER on_upsert_trigger 
    AFTER INSERT OR UPDATE ON ${table}
    FOR EACH ROW EXECUTE FUNCTION ${table}_upsert_func();
  `);
};

export const baseRecord = (knex: Knex, t: Knex.CreateTableBuilder) => {
  t.string('uid');
  t.string('project');
  t.timestamp('createdOn').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  t.timestamp('updatedOn').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  t.string('createdBy');
  t.primary(['uid']);
};

export const baseSubCollection = (knex: Knex, t: Knex.CreateTableBuilder) => {
  t.string('uid');
  t.string('parentId');
  t.string('project');
  t.timestamp('createdOn').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  t.timestamp('updatedOn').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
  t.string('createdBy');
  t.primary(['uid', 'parentId']);
};

export const mintingData = (t: Knex.CreateTableBuilder, base = 'mintingData_') => {
  t.string(base + 'address');
  t.string(base + 'network');

  t.timestamp(base + 'mintedOn');
  t.string(base + 'mintedBy');

  t.string(base + 'blockId');
  t.string(base + 'nftId');
  t.double(base + 'storageDeposit');

  t.string(base + 'aliasBlockId');
  t.string(base + 'aliasId');
  t.double(base + 'aliasStorageDeposit');

  t.string(base + 'mintingOrderId');

  t.double(base + 'nftsToMint');
  t.double(base + 'nftMediaToUpload');
  t.double(base + 'nftMediaToPrepare');

  t.string(base + 'unsoldMintingOptions');

  t.double(base + 'newPrice');
  t.double(base + 'nftsStorageDeposit');
};

export const networkEnum = ['smr', 'rms', 'iota', 'atoi'];

export const mediaStatusEnum = ['uploaded', 'pending_upload', 'error', 'prepare_ipfs'];

export const accessEnum = [
  'open',
  'members_only',
  'guardians_only',
  'members_with_badge',
  'members_with_nft_from_collection',
];

export const unsoldMintingOptionsEnum = [
  'burn_unsold',
  'set_new_price',
  'keep_price',
  'take_ownership',
];

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_on_func()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."updatedOn" = NOW();
    RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export async function down(): Promise<void> {}
