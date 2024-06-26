# Prisma driver adapter for Aurora serverless driver

Prisma driver adapter for [Aurora Serverless Data Client](https://www.npmjs.com/package/@aws-sdk/client-rds-data).

Aurora serverless client provides a way of communicating with your Aurora Serverless database over HTTP which can improve connection reliability, connection management, security and also performance in a serverless architecture.

## Getting started

To get started, enable the `driverAdapters` Preview feature in your Prisma schema:

```prisma
// schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider     = "postgres"
  url          = env("DATABASE_URL")
}
```

Generate Prisma Client:

```sh
npx prisma generate
```

Install the Prisma adapter for Aurora and the Aurora serverless data client packages:

```sh
npm install aurora-prisma-adapter ## TODO pending publishing to NPM
npm install "@aws-sdk/client-rds-data"
```

Update your Prisma Client instance to use the Aurora serverless adapter:

```ts
// Import needed packages
import { RDSDataClient } from '@aws-sdk/client-rds-data';
import { PrismaAurora } from 'aurora-prisma-adapter';
import { PrismaClient } from './prisma/client';

// Setup Prisma Client using Aurora Adapter
const awsRegion = `${process.env['AWS_REGION']}` //The region that the aurora cluster is deployed to
const resourceArn = `${process.env['RESOURCE_ARN']}` //The ARN of the aurora cluster to connect to
const secretArn = `${process.env['SECRET_ARN']}` // The database secret that is used for authentication to the cluster. Your Service/Lambda will need access to this see https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_database_secret.html
const databaseName = `${process.env['DATABASE_NAME']}` // The name of the database to connect to in the cluster

// Init prisma client
const client = new RDSDataClient({ region: awsRegion })
const adapter = new PrismaAurora(client, { resourceArn, secretArn, databaseName })
const prisma = new PrismaClient({ adapter });

// Use Prisma Client as normal

/**
 * Test the prisma adapter
 */
export const testAdapter = async () => {
    try {
        const id = `${randomUUID()}`;
        await prisma.user.create({
            data: {
                name: `${id}`,
                email: `${id}@test.com`
            }
        });
        const allUsers = await prisma.user.findMany();

        return { statusCode: 200, body: JSON.stringify(allUsers) };
    } catch (error: any) {
        return { statusCode: 400, body: JSON.stringify(error) };

    }
}
```

You can now use Prisma Client as you normally would with full type-safety. Your Prisma Client instance now uses Aurora serverless data client to connect to your database.

## Feedback

We encourage you to create an issue if you find something missing or run into a bug.

If you have any feedback, leave a comment in [this GitHub discussion](https://github.com/prisma/prisma/issues/1964).
