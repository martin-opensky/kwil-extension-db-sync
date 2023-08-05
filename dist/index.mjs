var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { NodeKwil, Utils } from 'kwil';
import { ExtensionBuilder, } from 'kwil-extensions';
import * as fs from 'fs';
import Bundlr from '@bundlr-network/client';
import { nanoid } from 'nanoid';
import { Wallet } from 'ethers';
import dbSyncClient from './db-sync-client.mjs';
const signer = new Wallet(process.env.ADMIN_PRIVATE_KEY);
const initialize = (metadata) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('METADATA:', metadata);
    // metadata['original_dbid'] needs to be set if this server is started after original db was created
    if (!metadata['local_db_name']) {
        throw new Error('local_db_name needs to be set in db_sync metadata');
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
    const providerAddress = yield signer.getAddress();
    metadata['provider_address'] = providerAddress;
    const localProviderDbId = Utils.generateDBID(providerAddress, metadata['local_db_name']);
    metadata['local_dbid'] = localProviderDbId;
    // If originalDbId is not set, it means this is the first time this DB schema is started
    // So the local provider dbid is set as the original dbid
    if (!metadata['original_dbid']) {
        metadata['original_dbid'] = localProviderDbId;
    }
    const originalDbId = metadata['original_dbid'];
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
const save_action = ({ metadata, inputs }) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const localDbId = metadata['local_dbid'];
    const actionName = inputs[0].toString();
    // remove first element from inputs array - as it is the action name
    // the rest will be mapped to the action inputs
    inputs.shift();
    // get schema using localDbId
    const kwil = new NodeKwil({
        kwilProvider: process.env.KWIL_PROVIDER_URL,
    });
    const schema = yield kwil.getSchema(localDbId);
    if (!schema.data) {
        throw new Error('No schema data found');
    }
    const dbActions = (_a = schema.data) === null || _a === void 0 ? void 0 : _a.actions;
    if (!dbActions) {
        throw new Error('No actions found in schema');
    }
    // Find action in schema
    const actionSchema = dbActions.find((action) => action.name === actionName);
    if (!actionSchema) {
        throw new Error('Action not found in schema');
    }
    // Here we build the action parameters based on the schema defined
    const actionSchemaInputs = actionSchema.inputs;
    const actionData = [];
    for (let i = 0; i < actionSchemaInputs.length; i++) {
        actionData.push({
            name: actionSchemaInputs[i],
            value: inputs[i].toString(),
        });
    }
    const actionToSync = {
        actionName: actionName,
        data: actionData,
    };
    console.log('ACTION TO SYNC:', actionToSync);
    return yield saveActionToBundlr(metadata, actionToSync);
});
const saveActionToBundlr = (metadata, actionToSync) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Saving Action => ');
    console.log('BUNDLR_NODE_URL => ', process.env.BUNDLR_NODE_URL);
    console.log('BUNDLR_NODE_CURRENCY => ', process.env.BUNDLR_NODE_CURRENCY);
    const bundlr = new Bundlr(process.env.BUNDLR_NODE_URL, process.env.BUNDLR_NODE_CURRENCY, process.env.ADMIN_PRIVATE_KEY);
    const actionId = nanoid();
    const signature = yield signer.signMessage(actionId);
    const tags = [
        { name: 'Application', value: 'KwilDb' },
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Original-DBID', value: metadata['original_dbid'] },
        { name: 'Local-DBID', value: metadata['local_dbid'] },
        { name: 'Local-DB-Name', value: metadata['local_db_name'] },
        { name: 'Type', value: 'Action-Sync' },
        { name: 'Action-Id', value: actionId },
        { name: 'Provider-Address', value: metadata['provider_address'] },
        { name: 'Signature', value: signature },
    ];
    const response = yield bundlr.upload(JSON.stringify(actionToSync), {
        tags,
    });
    if (response && !response.id) {
        throw new Error('No response id found');
    }
    console.log(`Data Available at => https://arweave.net/${response.id}`);
    console.log(`Timestamp ${response.timestamp}`);
    return response.id;
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
startServer();
