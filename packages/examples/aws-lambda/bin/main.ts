#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { config } from 'dotenv';
import { Aurora } from '../src/lib/aurora-stack';
import { Lambdas } from '../src/lib/lambdas-stack';
import { env } from 'process';
import * as path from 'path';

config({ path: path.join(__dirname, '../', '.env') });
const ENV_NAME = env['ENV_NAME']!;
const AWS_ACCOUNT = env['AWS_ACCOUNT']!;
const AWS_REGION = env['AWS_REGION']!;

const app = new cdk.App();

const DB_NAME = 'PrismaRdsDataApi';

const auroraCluster = new Aurora(app, ENV_NAME + 'AuroraStack', {
  env: { account: AWS_ACCOUNT, region: AWS_REGION },
  envName: ENV_NAME,
  description: "Aurora Stack",
  dbName: DB_NAME
});

// import { CloudwatchDashboard } from '../src/lib/cloudwatch-dashboard';
// new CloudwatchDashboard(app, ENV_NAME + 'CloudwatchDashboard', {
//   env: { account: AWS_ACCOUNT, region: AWS_REGION },
//   description: "Cloudwatch Dashboard Stack",
//   envName: ENV_NAME,
//   auroraCluster: auroraCluster.auroraCluster,
//   dbName: DB_NAME
// })

new Lambdas(app, ENV_NAME + 'lambdas', {
  env: { account: AWS_ACCOUNT, region: AWS_REGION },
  description: "Lambdas for testing RDS Data API",
  envName: ENV_NAME,
  cluster: auroraCluster.auroraCluster,
  dbName: DB_NAME
});