# PrismaAdapterAurora

Prisma driver adapter for [Aurora Serverless Data Client](https://www.npmjs.com/package/@aws-sdk/client-rds-data).

Aurora serverless client provides a way of communicating with your Aurora Serverless database over HTTP which can improve connection reliability, connection management, security and also performance in a serverless architecture.

This repo is an NX based monorepo and contains 2 main projects.

1. [aurora-prisma-adapter](packages/aurora-prisma-adapter) this package is the adapter to use with prisma
2. [examples/aws-lambda](packages/examples/aws-lambda) this is a package that uses CDK to standup an example database so that you can test using the adapter

You can follow the README.MD for each project to see how the adapter works and how you can standup a test database.

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

model User {
    name  String
    email String @unique
}
```

Generate Prisma Client:

```sh
npx prisma generate
```

Install the Prisma adapter for Aurora and the Aurora serverless data client packages:

```sh
npm install @raymondjkelly/aurora-prisma-adapter
npm install "@aws-sdk/client-rds-data"
```

Update your Prisma Client instance to use the Aurora serverless adapter:

```ts
// Import needed packages
import { RDSDataClient } from '@aws-sdk/client-rds-data';
import { PrismaAurora } from '@raymondjkelly/aurora-prisma-adapter';
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

## Helpful Resources
- [Prisma Adapters](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
- [RDSDataClient Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/rds-data/)
- [NPM Library for data api](https://www.npmjs.com/package/@aws-sdk/client-rds-data)
- [Using RDS Data API](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/data-api.html)
