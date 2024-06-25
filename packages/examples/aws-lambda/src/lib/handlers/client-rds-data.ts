import { RDSDataClient, BeginTransactionCommand, CommitTransactionCommand, CommitTransactionCommandInput, BeginTransactionCommandInput, ExecuteStatementCommand, ExecuteStatementCommandInput } from '@aws-sdk/client-rds-data';
import { env } from 'process';

const client = new RDSDataClient({ region: env['AWS_REGION'] });
/**
 * Test access to the database via the client-rds-data
 * @param event
 * @param context
 * @returns
 */
export const clientRdsData = async () => {
    const clusterArn = env['CLUSTER_ARN']!;
    const secretArn = env['SECRET_ARN']!;
    const dbName = env['DATABASE_NAME']!;

    const query1 = 'select * from information_schema.tables;';
    const query2 = 'select 1';

    try {
        const transactionId = await beginTransaction({
            clusterArn,
            secretArn,
            dbName
        });

        await performQueryInExistingTransaction({
            clusterArn,
            secretArn,
            dbName,
            transactionId,
            sql: query1
        });

        await performQueryInExistingTransaction({
            clusterArn,
            secretArn,
            dbName,
            transactionId,
            sql: query2
        });

        const finalCommit = await commitTransaction({
            clusterArn,
            secretArn,
            transactionId
        })

        return { statusCode: 200, body: JSON.stringify(finalCommit) };
    } catch (error: any) {
        const { requestId, cfId, extendedRequestId } = error.$metadata;
        console.log({ requestId, cfId, extendedRequestId });

        return { statusCode: 400, body: JSON.stringify(error) };

    }

}

const beginTransaction = async (params: {
    clusterArn: string,
    secretArn: string,
    dbName: string
}) => {

    const queryParams: BeginTransactionCommandInput = {
        database: params.dbName,
        resourceArn: params.clusterArn,
        secretArn: params.secretArn
    };

    const command = new BeginTransactionCommand(queryParams);
    const data = await client.send(command);

    console.log(`beginTransaction SUCCESS`, JSON.stringify(data));
    return data.transactionId!;
}

const performQueryInExistingTransaction = async (params: {
    clusterArn: string,
    secretArn: string,
    dbName: string,
    transactionId: string,
    sql: string
}) => {
    const queryParams: ExecuteStatementCommandInput = {
        database: params.dbName,
        resourceArn: params.clusterArn,
        secretArn: params.secretArn,
        sql: params.sql,
        transactionId: params.transactionId
    };

    const command = new ExecuteStatementCommand(queryParams);
    const data = await client.send(command);
    console.log(`performQueryInExistingTransaction SUCCESS`, JSON.stringify(data));
    return data;
}

const commitTransaction = async (params: {
    clusterArn: string,
    secretArn: string,
    transactionId: string
}) => {
    const queryParams: CommitTransactionCommandInput = {
        resourceArn: params.clusterArn,
        secretArn: params.secretArn,
        transactionId: params.transactionId
    };

    const command = new CommitTransactionCommand(queryParams);
    const data = await client.send(command);
    console.log(`commitTransaction SUCCESS`, JSON.stringify(data));
    return data;
}