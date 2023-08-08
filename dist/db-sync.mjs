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
import Bundlr from '@bundlr-network/client';
import { nanoid } from 'nanoid';
import { Wallet } from 'ethers';
import dbSyncClient from './db-sync-client.mjs';
export default class DbSync {
    constructor() {
        this.originalDbId = '';
        this.localProviderDbId = '';
        this.providerAddress = '';
        this.metadata = {};
        this.kwil = new NodeKwil({
            kwilProvider: process.env.KWIL_PROVIDER_URL,
        });
        this.signer = new Wallet(process.env.ADMIN_PRIVATE_KEY);
    }
    initialize(metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            this.providerAddress = yield this.signer.getAddress();
            metadata['provider_address'] = this.providerAddress;
            this.localProviderDbId = Utils.generateDBID(this.providerAddress, metadata['local_db_name']);
            metadata['local_dbid'] = this.localProviderDbId;
            // If originalDbId is not set, it means this is the first time this DB schema is started
            // So the local provider dbid is set as the original dbid
            if (!metadata['original_dbid']) {
                metadata['original_dbid'] = this.localProviderDbId;
            }
            this.originalDbId = metadata['original_dbid'];
            this.metadata = metadata;
            // Connect to sync db gRPC container - as soon as extension in initialized
            this.initiateSyncDbServer();
            return metadata;
        });
    }
    initiateSyncDbServer() {
        return __awaiter(this, void 0, void 0, function* () {
            dbSyncClient.Sync({
                originalDbId: this.originalDbId,
                localProviderDbId: this.localProviderDbId,
                providerAddress: this.providerAddress,
            }, (err, response) => {
                if (err) {
                    throw err;
                }
                console.log('INITIATING THE DB SYNC PROCESS:', response);
            });
        });
    }
    saveAction(actionName, actionParams) {
        return __awaiter(this, void 0, void 0, function* () {
            const actionSchemaInputs = yield this.getActionInputs(actionName);
            const actionData = [];
            for (let i = 0; i < actionSchemaInputs.length; i++) {
                actionData.push({
                    name: actionSchemaInputs[i],
                    value: actionParams[i].toString(),
                });
            }
            const actionToSync = {
                actionName: actionName,
                data: actionData,
            };
            console.log('ACTION TO SYNC:', actionToSync);
            return yield this.saveToBundlr(actionToSync);
        });
    }
    getActionInputs(actionName) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // get schema using localDbId
            const schema = yield this.kwil.getSchema(this.metadata['local_dbid']);
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
            return actionSchema.inputs;
        });
    }
    saveToBundlr(actionToSync) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Saving Action => ');
            const actionId = nanoid();
            const signature = yield this.signer.signMessage(actionId);
            const tags = [
                { name: 'Application', value: 'KwilDb' },
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Original-DBID', value: this.metadata['original_dbid'] },
                { name: 'Local-DBID', value: this.metadata['local_dbid'] },
                { name: 'Local-DB-Name', value: this.metadata['local_db_name'] },
                { name: 'Type', value: 'Action-Sync' },
                { name: 'Action-Id', value: actionId },
                { name: 'Provider-Address', value: this.metadata['provider_address'] },
                { name: 'Signature', value: signature },
            ];
            console.log('BUNDLR_NODE_URL => ', process.env.BUNDLR_NODE_URL);
            console.log('BUNDLR_NODE_CURRENCY => ', process.env.BUNDLR_NODE_CURRENCY);
            const bundlr = new Bundlr(process.env.BUNDLR_NODE_URL, process.env.BUNDLR_NODE_CURRENCY, process.env.ADMIN_PRIVATE_KEY);
            const response = yield bundlr.upload(JSON.stringify(actionToSync), {
                tags,
            });
            if (response && !response.id) {
                throw new Error('No response id found');
            }
            console.log(`Data Available at => https://arweave.net/${response.id}`);
            console.log(`Timestamp ${response.timestamp}`);
            return `https://arweave.net/${response.id}`;
        });
    }
}
