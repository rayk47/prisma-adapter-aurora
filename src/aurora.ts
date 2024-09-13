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
import { convertPrismaValuesToRdsParameters, covertFieldToPrismaColumnType, convertPositionalParametersToVariableParameters } from './conversion';
import { omit } from 'lodash';

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
    const tag = '[js::queryRaw]';
    debug(`${tag} %O`, query);

    const res = await this.performIO(query);

    if (!res.ok) {
      return err(res.error);
    }

    return res.map((result) => {
      const columnNames = result.columnMetadata ? result.columnMetadata?.map((column) => column.name ?? '') : [];
      const columnTypes = result.columnMetadata ? result.columnMetadata?.map((column) => covertFieldToPrismaColumnType(column.typeName)) : [];
      const rows = result.records?.map(recordsArray => recordsArray.map(record => record.stringValue)) ?? [];
      return {
        columnNames: columnNames,
        columnTypes: columnTypes,
        rows,
      };
    })
  }

  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::executeRaw]';
    debug(`${tag} %O`, query);

    return (await this.performIO(query)).map((r) => r.numberOfRecordsUpdated ?? 0);
  }

  /**
   * Run a query against the database, returning the result set.
   */
  private async performIO(query: Query): Promise<Result<ExecuteStatementResponse>> {
    const executeStatementCommandInput: ExecuteStatementCommandInput = {
      database: this.queryParams.databaseName,
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
      sql: convertPositionalParametersToVariableParameters(query.sql),
      parameters: convertPrismaValuesToRdsParameters(query.args),
      includeResultMetadata: true,
      transactionId: this.transactionId,
    };

    const rdsQueryToLog = omit(executeStatementCommandInput, 'database', 'resourceArn', 'secretArn');
    const tag = '[js::performIO]';

    try {
      const executeStatementCommand = new ExecuteStatementCommand(executeStatementCommandInput);
      debug(`${tag} %O`, rdsQueryToLog);
      const result = await this.client.send(executeStatementCommand);
      debug(`${tag} Result %O`, result);

      return ok(result);
    } catch (e) {
      //TODO: Do better error handling
      debug('Error in performIO: %O', JSON.stringify(e));
      throw e;
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
