## Kwil DB Sync & Restore

This tool includes 2 repositories: one is for an extension and the other is for a gRPC server that runs as a container alongside the sync extension. This tool saves database actions to Arweave (through Bundlr) along with specific tags enabling actions to be easily traced and synced with other Kwil Providers running the service.

**gRPC Server**: https://github.com/martin-opensky/kwil-db-sync-server

When the DB Sync extension is initialised it communicates with the Sync Server to restore any actions that exist on Arweave for that DB ID. It does this using the Bundlr GraphQL API and the server executes any found actions on the local DB. This enables actions to be re-played when a server has been taken down or when the schema is re-deployed on another server.

Once the initial actions have been restored, the Sync Server will continue to listen for transactions on the GQL API. This enables another Provider to run on a different server and submit actions to the same DB. By running 2 or more Providers with this service, specific databases can remain synced. If all Providers were to be destroyed, there is still the option to fully restore the DB, given the permanent storage of actions on Arweave.

<div style="display: flex; justify-content: space-between;">
<img src="https://lets.embrace.community/arweave-hack/sync-setup.png" style="height: 200px;" />
</div>

<div style="display: flex; justify-content: space-between;">
<img src="https://lets.embrace.community/arweave-hack/sync-function.png" style="height: 300px;" />
</div>

Each action that is synced must have a private equivalent so that the data can be restored by the DB Owner / Admin only. This is as certain information such as @caller, $date, $id etc could not be replayed successfully at another time by different account.

<div style="display: flex; justify-content: space-between;">
<img src="https://lets.embrace.community/arweave-hack/sync-function-owner.png" style="height: 100px;" />
</div>

Once the save_action method is called on the extension the data is saved to Arweave and can be found through the Bundlr GQL API.

<div style="display: flex; justify-content: space-between;">
<img src="https://lets.embrace.community/arweave-hack/sync-tags.png" style="height: 400px;" />
</div>

The file stored on Arweave contains information about which action to run and what parameters to use:

<div style="display: flex; justify-content: space-between;">
<img src="https://lets.embrace.community/arweave-hack/sync-json.png" style="height: 400px;" />
</div>

Another server can deploy the same schema and remain in sync with the original DB by supplying the ID when registering the extension:

<div style="display: flex; justify-content: space-between;">
<img src="https://lets.embrace.community/arweave-hack/sync-function-2.png" style="height: 120px;" />
</div>
