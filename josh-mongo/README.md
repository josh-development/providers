# MongoDB Provider for JOSH

The MongoDB provider uses the `mongodb` module for persistent storage of JOSH data.

## Installation

The installation of the mongodb module is fairly straightforward and does not have any pre-requisites.

However, you must ensure that you have an available MongoDB server running. `josh-mongo` **does not** automatically create a server for you!

If you don't know, or don't *want*, to host a Mongo DB server instance, you can create a free one on [MongoDB Atlas](https://cloud.mongodb.com/). See specific instructions below for that service.

### Running the installer

In your project folder, you should be able to install using this command: 

```
npm i @joshdb/mongo
** OR **
yarn add @joshdb/mongo
```

## Usage

Using the mongo provider goes as such: 

```js
const Josh = require('@joshdb/core');
const JoshMongo = require('@joshdb/mongo');

const db = new Josh({
  name: 'testing',
  provider: JoshMongo,
  // See below for all provider options.
  providerOptions: {
    collection: 'testing',
    dbName: "yourclustername",
    url: "mongodb+srv://<username>:<password>@cluster0.0zbvd.mongodb.net/<dbName>?retryWrites=true&w=majority"
  }
});

db.defer.then( async () => {
  console.log(`Connected, there are ${await db.size} rows in the database.`);
});
```

## Provider Options

Let's try to make some sense of the options. In the above example I use the URL for the connection, using a Mongo Atlas cluster.

Here is a list of full options this provider supports: 

| Param | Type | Description |
| --- | --- | --- |
| [providerOptions] | <code>Object</code> | The Provider Options Object, with the below properties: |
| [providerOptions.collection] | <code>string</code> | Required. The name of the collection in which to save the data. |
| [providerOptions.dbName] | <code>string</code> | Optional, defaults to `josh`. The name of the database to which collections are written. |
| [providerOptions.user] | <code>string</code> | Optional if not using a URL. The username for the mongodb connection. |
| [providerOptions.password] | <code>string</code> | Optional if not using a URL. The password for the mongodb connection. |
| [providerOptions.port] | <code>string</code> | Optional, defaults to `27017`. The port where mongodb is hosted. |
| [providerOptions.host] | <code>string</code> | Optional, defaults to `localhost`. The host/machine/URL where the mongodb connection is located. Should never be an HTTP address! |
| [providerOptions.url] | <code>string</code> | Optional, single-line configuration. If used, ignores all other options except `options.collection`, and requires the full connection string to access the database, *including the database name* |
| [providerOptions.maxConnections] | <code>number</code> | Optional. The maximum amount of connections Josh may concurrently make to your database. *Setting a very low value may prevent Josh from writing to your database at all.* |

## Mongo Atlas Configuration

Mongo Atlas is a free mongodb hosting service made by, if that wasn't obvious, the Mongo people. While there are some limitations to the free service, it's still very useable for any small implementation.

The setup for Mongo Atlas goes something like this: 
- Get an account at [mongodb.com](https://www.mongodb.com/cloud/atlas)
- Once created, setup your cluster: 
  - Provider & Region: Up to you, I chose AWS in my test (but you might have a closer free region!). Make sure to select a "FREE TIER AVAILABLE" region!
  - Keep the M0 cluster tier (the only free one). You may select backups if you want, other additional options are paid.
  - Type in a cluster name of your choice. Something like `guidebot-cluster`.
  - Click **Create Cluster**.
  - Go make a sandwich, setup can take a while...
  - Click the Collection button in the middle of the page.
  - Click Create Database. Enter a name such as `guidebot-session` then a collection name such as `sessions`.
- Now that the cluster is created, we now need to get a connection string. But we need to create a user, which there's a wizard for. 
  - Click **Command Line Tools** at the top of the cluster window, then click **Connect Instructions**.
  - Click **Add your Current IP** if you're on the machine that will host your bot. Otherwise, click **Add a Different IP Address** and enter it on the left. Click **Add IP Address**.
  - Enter a database access *username* and *password*, then click **Create MongoDB User**.
  - Click **Choose a connection method**.
  - Click **Connect your Application**
  - Change the driver version to **3.0 or later**.
  - Your connection string is here! Keep the page open to copy it later in the setup stage.
