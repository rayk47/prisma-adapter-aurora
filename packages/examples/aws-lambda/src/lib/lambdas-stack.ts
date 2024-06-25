import {
    Stack,
    StackProps,
    RemovalPolicy,
} from 'aws-cdk-lib';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { DatabaseCluster } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LambdasProps extends StackProps {
    readonly dbName: string;
    readonly description: string;
    readonly envName: string;
    readonly cluster: DatabaseCluster;
}


export class Lambdas extends Stack {

    constructor(scope: Construct, id: string, props: LambdasProps) {
        const { dbName, cluster, envName } = props;
        const rootOfProject = path.join(__dirname, '../', '../', '../', '../', '../');

        super(scope, id, props);

        const clientRdsDataLambda = new NodejsFunction(this, envName + 'clientRdsData', {
            description: 'Test out using the RDS Data API Client',
            entry: path.join(__dirname, 'handlers', 'client-rds-data.ts'),
            handler: 'clientRdsData',
            bundling: {
                minify: false
            },
            runtime: Runtime.NODEJS_20_X,
            projectRoot: path.join(rootOfProject, '..',),
            architecture: Architecture.X86_64,
            depsLockFilePath: path.join(rootOfProject, 'package-lock.json'),
            environment: {
                CLUSTER_ARN: cluster.clusterArn,
                SECRET_ARN: cluster.secret!.secretArn,
                DATABASE_NAME: dbName
            }
        });

        clientRdsDataLambda.applyRemovalPolicy(RemovalPolicy.DESTROY);

        cluster.grantDataApiAccess(clientRdsDataLambda);
        cluster.secret?.grantRead(clientRdsDataLambda);
    }

}
