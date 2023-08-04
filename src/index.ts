import { NodeKwil } from 'kwil';
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
  // set node and currency
  if (!metadata['node']) {
    metadata['node'] = 'http://node2.bundlr.network';
  }

  if (!metadata['currency']) {
    metadata['currency'] = 'matic';
  }

  return metadata;
};

const logger: logFn = (log: string, level: 'info' | 'error' | 'debug') => {
  fs.appendFileSync('logs.txt', log);
};

const exportDb = async (dbid: string) => {
  const kwil: NodeKwil = new NodeKwil({
    kwilProvider: 'http://kwil:8080',
  });

  if (!dbid) {
    throw new Error('No dbid provided');
  }

  const schema = await kwil.getSchema(dbid);

  if (!schema.data) {
    throw new Error('No schema data found');
  }

  const dbTables = schema.data?.tables;

  if (!dbTables) {
    throw new Error('No tables found');
  }

  const tableData: TableData[] = [];
  for (const table of dbTables) {
    const tableName = table.name;
    const result = await kwil.selectQuery(dbid, `SELECT * FROM ${tableName}`);

    if (result && result.status === 200 && result.data?.length) {
      tableData.push({
        name: tableName,
        data: result.data,
      });
    }
  }

  if (!tableData.length) {
    throw new Error('No data to export');
  }

  const exportData: Export = {
    dbid,
    schema: schema.data,
    tableData,
  };

  console.log('Exporting DB => ', exportData);

  return exportData;
};

const saveExport = async (
  bundlrNode: string,
  bundlrCurrency: string,
  exportData: Export,
  dbid: string
) => {
  console.log('Saving Export => ');

  const bundlr = new Bundlr(
    bundlrNode,
    bundlrCurrency,
    process.env.BUNDLR_WALLET_PK as string
  );

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

  const response = await bundlr.upload(JSON.stringify(exportData), {
    tags,
  });

  if (response && !response.id) {
    throw new Error('No response id found');
  }

  console.log(`Data Available at => https://arweave.net/${response.id}`);
  console.log(`DBID => ${dbid}`);

  return response.id;
};

const start: MethodFn = async ({ metadata, inputs }) => {
  const dbid: string = inputs[0]?.toString();

  if (!dbid) {
    throw new Error('No dbid provided');
  }

  if (!process.env.BUNDLR_WALLET_PK) {
    throw new Error('No bundlr wallet pk found');
  }

  console.log('Exporting DB => ', dbid);

  const bundlrNode = metadata['node'];
  const bundlrCurrency = metadata['currency'];

  const exportData = await exportDb(dbid);

  const txId = await saveExport(bundlrNode, bundlrCurrency, exportData, dbid);

  return txId;
};

function startServer(): void {
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
