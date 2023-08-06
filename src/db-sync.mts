import { NodeKwil, Utils } from 'kwil';
import Bundlr from '@bundlr-network/client';
import { nanoid } from 'nanoid';
import { Database, Table } from 'kwil/dist/core/database';
import { Wallet } from 'ethers';
import dbSyncClient from './db-sync-client.mjs';

type ActionData = {
  name: string;
  value: string;
};

type ActionToSync = {
  actionName: string;
  data: ActionData[];
};

export default class DbSync {
  kwil: NodeKwil;
  signer: Wallet;
  originalDbId: string = '';
  localProviderDbId: string = '';
  providerAddress: string = '';
  metadata: Record<string, string> = {};

  constructor() {
    this.kwil = new NodeKwil({
      kwilProvider: process.env.KWIL_PROVIDER_URL as string,
    });

    this.signer = new Wallet(process.env.ADMIN_PRIVATE_KEY as string);
  }

  async initialize(metadata: Record<string, string>) {
    this.providerAddress = await this.signer.getAddress();

    metadata['provider_address'] = this.providerAddress;

    this.localProviderDbId = Utils.generateDBID(
      this.providerAddress,
      metadata['local_db_name']
    );

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
  }

  async initiateSyncDbServer() {
    dbSyncClient.Sync(
      {
        originalDbId: this.originalDbId,
        localProviderDbId: this.localProviderDbId,
        providerAddress: this.providerAddress,
      },
      (err, response) => {
        if (err) {
          throw err;
        }
        console.log('INITIATING THE DB SYNC PROCESS:', response);
      }
    );
  }

  async saveAction(actionName: string, actionParams: any) {
    const actionSchemaInputs = await this.getActionInputs(actionName);

    const actionData: ActionData[] = [];
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

    return await this.saveToBundlr(actionToSync);
  }

  private async getActionInputs(actionName: string) {
    // get schema using localDbId
    const schema = await this.kwil.getSchema(this.metadata['local_dbid']);

    if (!schema.data) {
      throw new Error('No schema data found');
    }

    const dbActions = schema.data?.actions;

    if (!dbActions) {
      throw new Error('No actions found in schema');
    }

    // Find action in schema
    const actionSchema = dbActions.find((action) => action.name === actionName);

    if (!actionSchema) {
      throw new Error('Action not found in schema');
    }

    return actionSchema.inputs;
  }

  private async saveToBundlr(actionToSync: ActionToSync) {
    console.log('Saving Action => ');

    const actionId = nanoid();

    const signature = await this.signer.signMessage(actionId);

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

    const bundlr = new Bundlr(
      process.env.BUNDLR_NODE_URL as string,
      process.env.BUNDLR_NODE_CURRENCY as string,
      process.env.ADMIN_PRIVATE_KEY as string
    );

    const response = await bundlr.upload(JSON.stringify(actionToSync), {
      tags,
    });

    if (response && !response.id) {
      throw new Error('No response id found');
    }

    console.log(`Data Available at => https://arweave.net/${response.id}`);
    console.log(`Timestamp ${response.timestamp}`);

    return response.id;
  }
}
