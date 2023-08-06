import {
  ExtensionBuilder,
  InitializeFn,
  MethodFn,
  logFn,
} from 'kwil-extensions';
import * as fs from 'fs';
import DbSync from './db-sync.mjs';
const dbSync = new DbSync();

const initialize: InitializeFn = async (
  metadata: Record<string, string>
): Promise<Record<string, string>> => {
  if (!metadata['local_db_name']) {
    throw new Error('local_db_name needs to be set in db_sync metadata');
  }

  return await dbSync.initialize(metadata);
};

const logger: logFn = (log: string, level: 'info' | 'error' | 'debug') => {
  fs.appendFileSync('logs.txt', log);
};

const save_action: MethodFn = async ({ metadata, inputs }) => {
  const actionName = inputs[0].toString();

  // remove first element from inputs array - as it is the action name
  // the rest will be mapped to the action inputs
  inputs.shift();

  return await dbSync.saveAction(actionName, inputs);
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
