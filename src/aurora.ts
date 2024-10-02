import {
  BeginTransactionCommand,
  BeginTransactionCommandInput,
  CommitTransactionCommand,
  CommitTransactionCommandInput,
  ExecuteStatementCommand,
  ExecuteStatementCommandInput,
  ExecuteStatementResponse,
  RDSDataClient,
  RollbackTransactionCommand,
  RollbackTransactionCommandInput
} from '@aws-sdk/client-rds-data';
import {
  ConnectionInfo,
  Debug,
  DriverAdapter,
  err,
  ok,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils';
import { name as packageName } from '../package.json';
import { omit } from 'lodash';
import { convertSql, convertParameters } from './conversion/prismaToRds';
import { convertColumnType, convertValue } from './conversion/rdsToPrisma';
import { inspect } from 'util';

const debug = Debug('prisma:driver-adapter:aurora');

interface AuroraQueryParams {
  readonly resourceArn: string
  readonly secretArn: string
  readonly databaseName: string
}

class AuroraQueryable<ClientT extends RDSDataClient> implements Queryable {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  constructor(protected client: ClientT, protected queryParams: AuroraQueryParams, protected transactionId?: string) { }

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    try {
      const res = await this.performIO(query);

      if (!res.ok) {
        return err(res.error);
      }

      const response = res.map((result) => {
        const columnNames = result.columnMetadata ? result.columnMetadata?.map((column) => column.name ?? '') : [];
        const columnTypes = result.columnMetadata ? result.columnMetadata?.map((column) => convertColumnType(column.typeName)) : [];
        const rows = result.records?.map(recordsArray => recordsArray.map((record, index) => convertValue(record, columnTypes[index]!))) ?? [];

        return {
          columnNames: columnNames,
          columnTypes: columnTypes,
          rows,
        };
      });
      debug(`[js::queryRaw] RDS Response Converted to Prisma %O`, JSON.stringify(response));

      return response;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      debug(`[js::queryRaw] Error %O`, inspect(error));
      return err({
        'kind': 'Postgres',
        severity: 'Critical',
        code: 'P2036',
        detail: 'queryRaw: Failed to covert from RDS Data API to Prisma',
        ...error,
        'message': 'message' in error ? error?.message : 'Unknown Error',
      });
    }

  }

  async executeRaw(query: Query): Promise<Result<number>> {
    const res = (await this.performIO(query)).map((r) => r.numberOfRecordsUpdated ?? 0);

    if (!res.ok) {
      return err(res.error);
    }

    return res;
  }

  /**
   * Run a query against the database, returning the result set.
   */
  private async performIO(query: Query): Promise<Result<ExecuteStatementResponse>> {
    const tag = '[js::performIO]';
    debug(`${tag} %O`);
    debug(`${tag} Query before transformation %O`, query);

    const executeStatementCommandInput: ExecuteStatementCommandInput = {
      database: this.queryParams.databaseName,
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
      sql: convertSql(query.sql),
      parameters: convertParameters(query.args, query.argTypes),
      includeResultMetadata: true,
      transactionId: this.transactionId,
    };

    const rdsQueryToLog = omit(executeStatementCommandInput, 'database', 'resourceArn', 'secretArn');

    try {
      const executeStatementCommand = new ExecuteStatementCommand(executeStatementCommandInput);
      debug(`${tag} Query after transformation %O`, rdsQueryToLog);
      const result = await this.client.send(executeStatementCommand);
      debug(`${tag} Result %O`, result);

      return ok(result);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      //TODO: Do better error handling
      debug('Error in performIO: %O', JSON.stringify(error));
      return err({
        ...error,
        'kind': 'Postgres',
        'message': 'message' in error ? error?.message : 'Unknown Error',
      });
    }
  }
}

class AuroraTransaction extends AuroraQueryable<RDSDataClient> implements Transaction {
  constructor(
    client: RDSDataClient,
    queryParams: AuroraQueryParams,
    transactionId: string,
    readonly options: TransactionOptions,
  ) {
    super(client, queryParams, transactionId)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`);

    const queryParams: CommitTransactionCommandInput = {
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
      transactionId: this.transactionId,
    };

    const commitTransactionCommand = new CommitTransactionCommand(queryParams);
    await this.client.send(commitTransactionCommand);
    return Promise.resolve(ok(undefined));
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`);

    const queryParams: RollbackTransactionCommandInput = {
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
      transactionId: this.transactionId,
    };

    const rollbackTransactionCommand = new RollbackTransactionCommand(queryParams);
    await this.client.send(rollbackTransactionCommand);
    return Promise.resolve(ok(undefined));
  }
}

export class PrismaAurora extends AuroraQueryable<RDSDataClient> implements DriverAdapter {
  constructor(client: RDSDataClient, queryParams: AuroraQueryParams) {
    if (!(client instanceof RDSDataClient)) {
      throw new TypeError(`PrismaAurora must be initialized with an instance of Client:
  import { RDSDataClient } from "@aws-sdk/client-rds-data"
  const client = new RDSDataClient({ region: env.AWS_REGION });
  const adapter = new PrismaAurora(client)
  `)
    }
    super(client, queryParams);
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    };

    const tag = '[js::startTransaction]';
    debug(`${tag} options: %O`, options);

    const beginTransactionCommandInput: BeginTransactionCommandInput = {
      database: this.queryParams.databaseName,
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
    };

    const command = new BeginTransactionCommand(beginTransactionCommandInput);
    const beginTransactionResponse = await this.client.send(command);

    if (!beginTransactionResponse.transactionId) {
      throw new Error(`Unable to create transaction`);
    }
    debug(`${tag} transaction created: %O`, beginTransactionResponse.transactionId);

    return ok(new AuroraTransaction(this.client, this.queryParams, beginTransactionResponse.transactionId, options));
  }

  getConnectionInfo(): Result<ConnectionInfo> {
    return ok({
      schemaName: undefined,
    });
  }
}
