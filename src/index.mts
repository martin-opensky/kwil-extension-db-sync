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

type TableData = {
  name: string;
  data: any[];
};

type Export = {
  dbid: string;
  schema: Database<string>;
  tableData: TableData[];
};

const initialize: InitializeFn = async (
  metadata: Record<string, string>
): Promise<Record<string, string>> => {
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

  const signer: Signer = new Wallet(process.env.KWILD_PRIVATE_KEY as string);
  const providerAddress = await signer.getAddress();

  const originalDbId: string | undefined = metadata['original_dbid'];

  const localProviderDbId: string = Utils.generateDBID(
    providerAddress,
    metadata['local_db_name']
  );

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

const action: MethodFn = async ({ metadata, inputs }) => {
  return 'action';
};

function startServer(): void {
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
