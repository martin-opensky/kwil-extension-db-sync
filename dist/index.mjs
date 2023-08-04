var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Utils } from 'kwil';
import { ExtensionBuilder, } from 'kwil-extensions';
import * as fs from 'fs';
import { Wallet } from 'ethers';
import dbSyncClient from './db-sync-client.mjs';
const initialize = (metadata) => __awaiter(void 0, void 0, void 0, function* () {
    // metadata['original_dbid'] needs to be set if this server is started after original db was created
    if (!metadata['local_db_name']) {
        throw new Error('local_db_name needs to be set in db_sync metadata');
    }
    if (!process.env.KWILD_PRIVATE_KEY) {
        throw new Error('KWILD_PRIVATE_KEY not found in ENV file');
    }
    if (!process.env.BUNDLR_NODE_URL) {
        throw new Error('BUNDLR_NODE_URL not found in ENV file');
    }
    if (!process.env.BUNDLR_NODE_CURRENCY) {
        throw new Error('BUNDLR_NODE_CURRENCY not found in ENV file');
    }
    const signer = new Wallet(process.env.KWILD_PRIVATE_KEY);
    const providerAddress = yield signer.getAddress();
    const originalDbId = metadata['original_dbid'];
    const localProviderDbId = Utils.generateDBID(providerAddress, metadata['local_db_name']);
    // Connect to sync db gRPC container
    initiateSyncDbServer(originalDbId, localProviderDbId, providerAddress);
    return metadata;
});
const logger = (log, level) => {
    fs.appendFileSync('logs.txt', log);
};
const initiateSyncDbServer = (originalDbId, localProviderDbid, providerAddress) => {
    dbSyncClient.Sync({
        originalDbId,
        localProviderDbid,
        providerAddress,
    }, (err, response) => {
        if (err) {
            throw err;
        }
        console.log('INITIATING THE DB SYNC PROCESS:', response);
    });
};
const action = ({ metadata, inputs }) => __awaiter(void 0, void 0, void 0, function* () {
    return 'action';
});
function startServer() {
    const server = new ExtensionBuilder()
        .named('db_sync')
        .withInitializer(initialize)
        .withMethods({
        action,
    })
        .withLoggerFn(logger)
        .port('50053')
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
// initiateSyncDbServer('0x0000000000', '0x0000000000', '0x0000000000');
