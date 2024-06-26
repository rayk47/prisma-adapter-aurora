# PrismaAdapterAurora

This repo is a community-maintained driver adapter for Prisma to use Aurora Serverless V2 RDS Data API. This repo is an NX based monorepo and contains 2 main projects.

1. [aurora-prisma-adapter](packages/aurora-prisma-adapter) this package is the adapter to use with prisma
2. [examples/aws-lambda](packages/examples/aws-lambda) this is a package that uses CDK to standup an example database so that you can test using the adapter

You can follow the README.MD for each project to see how the adapter works and how you can standup a test database