import grpc from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { resolve } from 'path';

const protoPath = resolve('./proto/db-sync.proto');

const packageDefinition = loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const DbSyncService =
  grpc.loadPackageDefinition(packageDefinition).DbSyncService;

if (!process.env.DB_SYNC_GRPC_URL) {
  throw new Error('DB_SYNC_GRPC_URL not found in ENV file');
}

// @ts-ignore
const dbSyncClient = new DbSyncService(
  process.env.DB_SYNC_GRPC_URL as string,
  grpc.credentials.createInsecure()
);

export default dbSyncClient;
