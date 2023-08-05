import { NodeKwil, Utils } from 'kwil';
import {
  ExtensionBuilder,
  InitializeFn,
  MethodFn,
  logFn,
} from 'kwil-extensions';
import * as fs from 'fs';
import { Database } from 'kwil/dist/core/database';
import Bundlr from '@bundlr-network/client';
import { nanoid } from 'nanoid';
import { Wallet } from 'ethers';
import type { Signer } from 'ethers';
import dbSyncClient from './db-sync-client.mjs';

type ActionData = {
  name: string;
  value: string;
};

type ActionToSync = {
  actionName: string;
  data: ActionData[];
};

const signer: Signer = new Wallet(process.env.ADMIN_PRIVATE_KEY as string);

const initialize: InitializeFn = async (
  metadata: Record<string, string>
): Promise<Record<string, string>> => {
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

  const providerAddress = await signer.getAddress();

  metadata['provider_address'] = providerAddress;

  const localProviderDbId: string = Utils.generateDBID(
    providerAddress,
    metadata['local_db_name']
  );

  metadata['local_dbid'] = localProviderDbId;

  // If originalDbId is not set, it means this is the first time this DB schema is started
  // So the local provider dbid is set as the original dbid
  if (!metadata['original_dbid']) {
    metadata['original_dbid'] = localProviderDbId;
  }

  const originalDbId: string = metadata['original_dbid'];

  // Connect to sync db gRPC container
  initiateSyncDbServer(originalDbId, localProviderDbId, providerAddress);

  return metadata;
};

const logger: logFn = (log: string, level: 'info' | 'error' | 'debug') => {
  fs.appendFileSync('logs.txt', log);
};

const initiateSyncDbServer = (
  originalDbId: string | undefined,
  localProviderDbid: string,
  providerAddress: string
) => {
  dbSyncClient.Sync(
    {
      originalDbId,
      localProviderDbid,
      providerAddress,
    },
    (err, response) => {
      if (err) {
        throw err;
      }
      console.log('INITIATING THE DB SYNC PROCESS:', response);
    }
  );
};

const save_action: MethodFn = async ({ metadata, inputs }) => {
  const localDbId = metadata['local_dbid'];
  const actionName = inputs[0].toString();

  // remove first element from inputs array - as it is the action name
  // the rest will be mapped to the action inputs
  inputs.shift();

  // get schema using localDbId
  const kwil = new NodeKwil({
    kwilProvider: process.env.KWIL_PROVIDER_URL as string,
  });
  const schema = await kwil.getSchema(localDbId);

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

  // Here we build the action parameters based on the schema defined
  const actionSchemaInputs = actionSchema.inputs;
  const actionData: ActionData[] = [];
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

  return await saveActionToBundlr(metadata, actionToSync);
};

const saveActionToBundlr = async (
  metadata: Record<string, string>,
  actionToSync: ActionToSync
) => {
  console.log('Saving Action => ');

  console.log('BUNDLR_NODE_URL => ', process.env.BUNDLR_NODE_URL);
  console.log('BUNDLR_NODE_CURRENCY => ', process.env.BUNDLR_NODE_CURRENCY);

  const bundlr = new Bundlr(
    process.env.BUNDLR_NODE_URL as string,
    process.env.BUNDLR_NODE_CURRENCY as string,
    process.env.ADMIN_PRIVATE_KEY as string
  );

  const actionId = nanoid();

  const signature = await signer.signMessage(actionId);

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

  const response = await bundlr.upload(JSON.stringify(actionToSync), {
    tags,
  });

  if (response && !response.id) {
    throw new Error('No response id found');
  }

  console.log(`Data Available at => https://arweave.net/${response.id}`);
  console.log(`Timestamp ${response.timestamp}`);

  return response.id;
};

function startServer(): void {
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
