"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const knex_1 = __importDefault(require("knex"));
const knex = (0, knex_1.default)({
    client: 'pg',
    connection: {
        user: 'postgres', // e.g. 'my-user'
        password: 'postgres', // e.g. 'my-user-password'
        database: 'postgres', // e.g. 'my-database'
        host: 'localhost',
        port: 5432,
    },
    pool: { min: 1, max: 10 },
});
const main = async () => {
    const table = 'asd';
    if (!(await knex.schema.hasTable(table))) {
        await knex.schema.createTable(table, (t) => {
            t.text('uid').primary();
            t.integer('count').defaultTo(0);
        });
    }
    await knex(table).insert({ uid: 'asdasd', count: 2 });
    const res = await knex(table).select('*');
    console.log(res);
    await knex.schema.dropTable(table);
    await knex.destroy();
};
main();
//# sourceMappingURL=index.js.map