import {
    Stack,
    StackProps,
    RemovalPolicy,
    Duration,
} from 'aws-cdk-lib';
import { Architecture, Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { DatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { randomUUID } from 'crypto';
import { copyFileSync, mkdirSync } from 'fs';
import * as path from 'path';

export interface LambdasProps extends StackProps {
    readonly dbName: string;
    readonly description: string;
    readonly envName: string;
    readonly cluster: DatabaseCluster;
}

const ROOT_OF_PROJECT = path.join(__dirname, '../', '../', '../', '../', '../');
const PRISMA_QUERY_ENGINE_BINARY_NAME = 'libquery_engine-rhel-openssl-3.0.x.so.node';
const PRISMA_QUERY_ENGINE_BINARY_PATH = '/opt/' + PRISMA_QUERY_ENGINE_BINARY_NAME;
const PRISMA_CLIENT_PATH = path.join(__dirname, 'handlers', 'prisma', 'client');

export class Lambdas extends Stack {
    public envName: string;

    constructor(scope: Construct, id: string, props: LambdasProps) {
        const { dbName, cluster } = props;

        super(scope, id, props);
        this.envName = props.envName;


        const prismaBinaryLayer = this.createPrismaBinaryLayer();
        this.createSetupDatabaseLambda(cluster, dbName);
        this.createUseAdapterLambda(cluster, dbName, prismaBinaryLayer);
    }

    createSetupDatabaseLambda = (cluster: DatabaseCluster, dbName: string) => {
        const setupDatabaseLambda = new NodejsFunction(this, this.envName + 'SetupDbLambda', {
            description: 'Setup Database',
            entry: path.join(__dirname, 'handlers', 'setup-database.ts'),
            handler: 'setupDatabase',
            bundling: {
                minify: false
            },
            runtime: Runtime.NODEJS_20_X,
            projectRoot: path.join(ROOT_OF_PROJECT, '..',),
            architecture: Architecture.X86_64,
            depsLockFilePath: path.join(ROOT_OF_PROJECT, 'package-lock.json'),
            environment: {
                CLUSTER_ARN: cluster.clusterArn,
                SECRET_ARN: cluster.secret!.secretArn,
                DATABASE_NAME: dbName
            }
        });

        setupDatabaseLambda.applyRemovalPolicy(RemovalPolicy.DESTROY);

        cluster.grantDataApiAccess(setupDatabaseLambda);
        cluster.secret?.grantRead(setupDatabaseLambda);

        return setupDatabaseLambda;
    }

    createUseAdapterLambda = (cluster: DatabaseCluster, dbName: string, prismaBinaryLayer: LayerVersion) => {
        const useAdapterLambda = new NodejsFunction(this, this.envName + 'UseAdapterLambda', {
            description: 'Test using the prisma adapter',
            entry: path.join(__dirname, 'handlers', 'test-adapter.ts'),
            handler: 'testAdapter',
            timeout: Duration.seconds(10),
            bundling: {
                minify: false
            },
            runtime: Runtime.NODEJS_20_X,
            projectRoot: path.join(ROOT_OF_PROJECT, '..',),
            architecture: Architecture.X86_64,
            depsLockFilePath: path.join(ROOT_OF_PROJECT, 'package-lock.json'),
            layers: [prismaBinaryLayer],
            environment: {
                DEBUG: "prisma*",
                RESOURCE_ARN: cluster.clusterArn,
                SECRET_ARN: cluster.secret!.secretArn,
                DATABASE_NAME: dbName,
                DATABASE_URL: 'na',
                PRISMA_QUERY_ENGINE_LIBRARY: PRISMA_QUERY_ENGINE_BINARY_PATH
            }
        });

        useAdapterLambda.applyRemovalPolicy(RemovalPolicy.DESTROY);

        cluster.grantDataApiAccess(useAdapterLambda);
        cluster.secret?.grantRead(useAdapterLambda);
    }

    createPrismaBinaryLayer = () => {
        // move the binary into its own folder to reduce the layer size to only include that binary file
        const newFolder = path.join(PRISMA_CLIENT_PATH, randomUUID());
        mkdirSync(newFolder);
        copyFileSync(
            path.join(PRISMA_CLIENT_PATH, PRISMA_QUERY_ENGINE_BINARY_NAME),
            path.join(newFolder, PRISMA_QUERY_ENGINE_BINARY_NAME)
        );

        return new LayerVersion(
            this,
            this.envName + 'PrismaEngineBinaryLambdaLayer',
            {
                compatibleRuntimes: [Runtime.NODEJS_20_X,],
                compatibleArchitectures: [Architecture.X86_64],
                code: Code.fromAsset(path.join(newFolder))
            }
        );
    }
}
