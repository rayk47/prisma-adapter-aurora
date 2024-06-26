import { RDSDataClient, BeginTransactionCommand, CommitTransactionCommand, CommitTransactionCommandInput, BeginTransactionCommandInput, ExecuteStatementCommand, ExecuteStatementCommandInput, SqlParameter } from '@aws-sdk/client-rds-data';
import { randomUUID } from 'crypto';
import { env } from 'process';

const client = new RDSDataClient({ region: env['AWS_REGION'] });

/**
 * Test setting up a basic database table
 * @returns
 */
export const setupDatabase = async () => {
    const clusterArn = env['CLUSTER_ARN']!;
    const secretArn = env['SECRET_ARN']!;
    const dbName = env['DATABASE_NAME']!;

    const dropTable = 'DROP TABLE IF EXISTS "User"';
    const createUserTable = 'CREATE TABLE "User" ("name" TEXT NOT NULL, "email" TEXT NOT NULL);';
    const createUniqueIndex = 'CREATE UNIQUE INDEX "User_email_key" ON "User"("email");';
    const createInitialUserSql = `INSERT INTO "User" (name, email) VALUES ('test', '${randomUUID()}@test.com');`
    const selectAll = "SELECT \"User\".\"email\", \"User\".\"name\" FROM \"User\" WHERE 1=1";

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
            sql: dropTable
        });

        await performQueryInExistingTransaction({
            clusterArn,
            secretArn,
            dbName,
            transactionId,
            sql: createUserTable
        });

        await performQueryInExistingTransaction({
            clusterArn,
            secretArn,
            dbName,
            transactionId,
            sql: createUniqueIndex
        });

        await performQueryInExistingTransaction({
            clusterArn,
            secretArn,
            dbName,
            transactionId,
            sql: createInitialUserSql
        });

        await performQueryInExistingTransaction({
            clusterArn,
            secretArn,
            dbName,
            transactionId,
            sql: selectAll,
        });

        const finalCommit = await commitTransaction({
            clusterArn,
            secretArn,
            transactionId
        })

        return { statusCode: 200, body: JSON.stringify(finalCommit) };
    } catch (error: any) {
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
    sql: string,
    parameters?: SqlParameter[]
}) => {
    const queryParams: ExecuteStatementCommandInput = {
        database: params.dbName,
        resourceArn: params.clusterArn,
        secretArn: params.secretArn,
        sql: params.sql,
        transactionId: params.transactionId,
        parameters: params.parameters ?? []
    };
    try {
        console.log(`performQueryInExistingTransaction Query`, JSON.stringify(queryParams));
        const command = new ExecuteStatementCommand(queryParams);
        const data = await client.send(command);
        return data;
    } catch (error) {
        console.log(`performQueryInExistingTransaction FAILURE`, JSON.stringify({ sql: queryParams.sql, parameters: queryParams.parameters }));
        throw error;
    }

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