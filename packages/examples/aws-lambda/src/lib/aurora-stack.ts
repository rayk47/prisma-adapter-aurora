import {
  Stack,
  StackProps,
  CfnOutput,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AuroraPostgresEngineVersion, ClusterInstance, Credentials, DatabaseCluster, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface AuroraProps extends StackProps {
  readonly dbName: string;
  readonly description: string;
  readonly envName: string;
}


export class Aurora extends Stack {
  auroraCluster: DatabaseCluster;

  constructor(scope: Construct, id: string, props: AuroraProps) {
    const { dbName, envName } = props;
    super(scope, id, props);

    const auroraClusterSecret = new Secret(
      this,
      envName + 'AuroraClusterCredentials',
      {
        secretName: dbName + 'AuroraClusterCredentials',
        description: dbName + 'AuroraClusterCredentials',
        generateSecretString: {
          excludeCharacters: "\"@/\\ '",
          generateStringKey: 'password',
          passwordLength: 30,
          secretStringTemplate: JSON.stringify({ username: dbName }),
        },
      },
    );
    auroraClusterSecret.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // aurora credentials
    const auroraClusterCredentials = Credentials.fromSecret(
      auroraClusterSecret,
      props.dbName,
    );

    const vpc = new Vpc(this, envName + 'AuroraDatabaseVPC');
    vpc.applyRemovalPolicy(RemovalPolicy.DESTROY);

    this.auroraCluster = new DatabaseCluster(this, envName + 'AuroraDatabase', {
      engine: DatabaseClusterEngine.auroraPostgres({ version: AuroraPostgresEngineVersion.VER_14_8 }),
      credentials: auroraClusterCredentials,
      writer: ClusterInstance.serverlessV2('writer'),
      defaultDatabaseName: dbName,
      removalPolicy: RemovalPolicy.DESTROY,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: RetentionDays.ONE_DAY,
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 1,
      enableDataApi: true,
      vpc,
      // iamAuthentication: true,
    });

    this.cfnOutputConfig();
  }

  public cfnOutputConfig = () => {
    new CfnOutput(this, 'OutputSecretName', {
      exportName: this.auroraCluster.stack.stackName + ':SecretName',
      value: this.auroraCluster.secret!.secretArn!,
    });

    new CfnOutput(this, 'OutputSecretArn', {
      exportName: this.auroraCluster.stack.stackName + ':SecretArn',
      value: this.auroraCluster.secret!.secretArn!,
    });


    new CfnOutput(this, 'OutputGetSecretValue', {
      exportName: this.auroraCluster.stack.stackName + ':GetSecretValue',
      value: 'aws secretsmanager get-secret-value --secret-id ' + this.auroraCluster.secret?.secretArn,
    });


    new CfnOutput(this, 'OutputInstanceIdentifiers', {
      exportName: this.auroraCluster.stack.stackName + 'InstanceIdentifiers',
      value: this.auroraCluster.instanceIdentifiers.toString(),
    });

    const instance_endpoints: any = [];

    for (const ie of this.auroraCluster.instanceEndpoints) {
      instance_endpoints.push(ie.hostname);
    }
    new CfnOutput(this, 'OutputEndpoints', {
      exportName: this.auroraCluster.stack.stackName + ':Endpoints',
      value: instance_endpoints.toString(),
    });

    new CfnOutput(this, 'OutputClusterEndpoint', {
      exportName: this.auroraCluster.stack.stackName + ':Endpoint',
      value: this.auroraCluster.clusterEndpoint.socketAddress,
    });


    // Outputs Cluster Engine
    new CfnOutput(this, 'OutputEngineFamily', {
      exportName: this.auroraCluster.stack.stackName + ':EngineFamily',
      value: this.auroraCluster.engine!.engineFamily!,
    });

    new CfnOutput(this, 'OutputEngineType', {
      exportName: this.auroraCluster.stack.stackName + ':EngineType',
      value: this.auroraCluster.engine!.engineType!,
    });

    new CfnOutput(this, 'OutputEngineFullVersion', {
      exportName: this.auroraCluster.stack.stackName + ':EngineFullVersion',
      value: this.auroraCluster.engine!.engineVersion!.fullVersion!,
    });

    new CfnOutput(this, 'OutputEngineMajorVersion', {
      exportName: this.auroraCluster.stack.stackName + ':EngineMajorVersion',
      value: this.auroraCluster.engine!.engineVersion!.majorVersion!,
    });

    new CfnOutput(this, 'OutputParameterGroupFamily', {
      exportName: this.auroraCluster.stack.stackName + ':ParameterGroupFamily',
      value: this.auroraCluster.engine!.parameterGroupFamily!,
    });
  }
}
