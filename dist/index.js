var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { NodeKwil } from 'kwil';
import { ExtensionBuilder, } from 'kwil-extensions';
import * as fs from 'fs';
import Bundlr from '@bundlr-network/client';
import { nanoid } from 'nanoid';
const initialize = (metadata) => __awaiter(void 0, void 0, void 0, function* () {
    // set node and currency
    if (!metadata['node']) {
        metadata['node'] = 'http://node2.bundlr.network';
    }
    if (!metadata['currency']) {
        metadata['currency'] = 'matic';
    }
    return metadata;
});
const logger = (log, level) => {
    fs.appendFileSync('logs.txt', log);
};
const exportDb = (dbid) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const kwil = new NodeKwil({
        kwilProvider: 'http://kwil:8080',
    });
    if (!dbid) {
        throw new Error('No dbid provided');
    }
    const schema = yield kwil.getSchema(dbid);
    if (!schema.data) {
        throw new Error('No schema data found');
    }
    const dbTables = (_a = schema.data) === null || _a === void 0 ? void 0 : _a.tables;
    if (!dbTables) {
        throw new Error('No tables found');
    }
    const tableData = [];
    for (const table of dbTables) {
        const tableName = table.name;
        const result = yield kwil.selectQuery(dbid, `SELECT * FROM ${tableName}`);
        if (result && result.status === 200 && ((_b = result.data) === null || _b === void 0 ? void 0 : _b.length)) {
            tableData.push({
                name: tableName,
                data: result.data,
            });
        }
    }
    if (!tableData.length) {
        throw new Error('No data to export');
    }
    const exportData = {
        dbid,
        schema: schema.data,
        tableData,
    };
    console.log('Exporting DB => ', exportData);
    return exportData;
});
const saveExport = (bundlrNode, bundlrCurrency, exportData, dbid) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Saving Export => ');
    const bundlr = new Bundlr(bundlrNode, bundlrCurrency, process.env.BUNDLR_WALLET_PK);
    const exportId = nanoid();
    const tags = [
        { name: 'Application', value: 'KwilDb' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'DB-Owner', value: exportData.schema.owner },
        { name: 'DB-Name', value: exportData.schema.name },
        { name: 'DBID', value: dbid },
        { name: 'Date', value: new Date().toISOString() },
        { name: 'Type', value: 'Export' },
        { name: 'Export-Id', value: exportId },
        // { name: 'Exported-By', value: signerAddress },
        // { name: 'Signature', value: 'signatureRequired?' },
    ];
    const response = yield bundlr.upload(JSON.stringify(exportData), {
        tags,
    });
    if (response && !response.id) {
        throw new Error('No response id found');
    }
    console.log(`Data Available at => https://arweave.net/${response.id}`);
    console.log(`DBID => ${dbid}`);
    return response.id;
});
const start = ({ metadata, inputs }) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const dbid = (_c = inputs[0]) === null || _c === void 0 ? void 0 : _c.toString();
    if (!dbid) {
        throw new Error('No dbid provided');
    }
    if (!process.env.BUNDLR_WALLET_PK) {
        throw new Error('No bundlr wallet pk found');
    }
    console.log('Exporting DB => ', dbid);
    const bundlrNode = metadata['node'];
    const bundlrCurrency = metadata['currency'];
    const exportData = yield exportDb(dbid);
    const txId = yield saveExport(bundlrNode, bundlrCurrency, exportData, dbid);
    return txId;
});
function startServer() {
    const server = new ExtensionBuilder()
        .named('db_export')
        .withInitializer(initialize)
        .withMethods({
        start,
    })
        .withLoggerFn(logger)
        .port('50052')
        .build();
    console.log('Starting server...');
    process.on('SIGINT', () => {
        server.stop();
    });
    process.on('SIGTERM', () => {
        server.stop();
    });
}
startServer();
