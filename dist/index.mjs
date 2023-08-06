var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { ExtensionBuilder, } from 'kwil-extensions';
import * as fs from 'fs';
import DbSync from './db-sync.mjs';
const dbSync = new DbSync();
const initialize = (metadata) => __awaiter(void 0, void 0, void 0, function* () {
    if (!metadata['local_db_name']) {
        throw new Error('local_db_name needs to be set in db_sync metadata');
    }
    return yield dbSync.initialize(metadata);
});
const logger = (log, level) => {
    fs.appendFileSync('logs.txt', log);
};
const save_action = ({ metadata, inputs }) => __awaiter(void 0, void 0, void 0, function* () {
    const actionName = inputs[0].toString();
    // remove first element from inputs array - as it is the action name
    // the rest will be mapped to the action inputs
    inputs.shift();
    return yield dbSync.saveAction(actionName, inputs);
});
function startServer() {
    const port = process.env.EXTENSION_DB_SYNC_PORT || '50053';
    const server = new ExtensionBuilder()
        .named('db_sync')
        .withInitializer(initialize)
        .withMethods({
        save_action,
    })
        .withLoggerFn(logger)
        .port(port)
        .build();
    console.log('Starting server...');
    process.on('SIGINT', () => {
        server.stop();
    });
    process.on('SIGTERM', () => {
        server.stop();
    });
}
if (!process.env.ADMIN_PRIVATE_KEY) {
    throw new Error('ADMIN_PRIVATE_KEY not found in ENV file');
}
if (!process.env.KWIL_PROVIDER_URL) {
    throw new Error('KWIL_PROVIDER_URL not found in ENV file');
}
if (!process.env.BUNDLR_NODE_URL) {
    throw new Error('BUNDLR_NODE_URL not found in ENV file');
}
if (!process.env.BUNDLR_NODE_CURRENCY) {
    throw new Error('BUNDLR_NODE_CURRENCY not found in ENV file');
}
startServer();
