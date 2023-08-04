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
const DbSyncService = grpc.loadPackageDefinition(packageDefinition).DbSyncService;
// @ts-ignore
const dbSyncClient = new DbSyncService('dns:///kwil-db-sync:50061', grpc.credentials.createInsecure());
export default dbSyncClient;
