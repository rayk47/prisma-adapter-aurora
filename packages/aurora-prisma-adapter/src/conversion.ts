import { ColumnMetadata, Field, SqlParameter } from "@aws-sdk/client-rds-data";
import { type ColumnType, ColumnTypeEnum } from '@prisma/driver-adapter-utils';
import { isArray, isBoolean, isInteger, isNull, isNumber, isString } from 'lodash';

/**
 * Used when converting positional parameters to variable parameters
 */
const prefixedParameterVariableName = 'id';

/**
 * Converts the Prisma values to RDS Parameters
 * @param values 
 * @returns SqlParameter[]
 */
export const convertPrismaValuesToRdsParameters = (values: unknown[]) => {
    values = fixArrayBufferValues(values);
    const parameters: SqlParameter[] = (values).map((param: any, index) => { return { name: prefixedParameterVariableName + String(index + 1), value: convertValueToRDSField(param) } });
    return parameters;
}

/**
 * Converts a value to RDS Data API field 
 * @param value 
 * @returns Field
 */
const convertValueToRDSField = (value: any | any[]): Field => {
    if (isNull(value)) {
        return { 'isNull': true }
    }
    if (isBoolean(value)) {
        return { 'booleanValue': value };
    }
    if (isArray(value)) {
        return {
            'arrayValue': [] as any //TODO: Fix this
        }
    }
    if (isNumber(value)) {
        return { 'doubleValue': value };
    }
    if (isInteger(value)) {
        return { 'longValue': value };
    }
    if (isString(value)) {
        return { 'stringValue': value };
    } else {
        return { '$unknown': value };
    }
}

/**
 * See https://github.com/limelighthealth/prisma-adapter-aurora/issues/3 for more context
 * @param sql 
 * @returns sql
 */
export const convertPositionalParametersToVariableParameters = (sql: string) => {
    return sql.replace(/\$/g, ':' + prefixedParameterVariableName); //TODO nasty hack that needs to be reviewed and fixed
}

/**
 * https://github.com/brianc/node-postgres/pull/2930
 * See https://github.com/limelighthealth/prisma-adapter-aurora/issues/2
 * @param values 
 * @returns 
 */
export function fixArrayBufferValues(values: unknown[]) {
    for (let i = 0; i < values.length; i++) {
        const list = values[i];
        if (!Array.isArray(list)) {
            continue;
        }

        for (let j = 0; j < list.length; j++) {
            const listItem = list[j];
            if (ArrayBuffer.isView(listItem)) {
                list[j] = Buffer.from(
                    listItem.buffer,
                    listItem.byteOffset,
                    listItem.byteLength,
                );
            }
        }
    }

    return values;
}

/**
 * Converts the columns returned by RDS to a corresponding Prisma Column Type that the Prisma Client and Engine can use
 * Needs more testing. See https://github.com/limelighthealth/prisma-adapter-aurora/issues/5
 * @param field 
 * @returns ColumnType
 */
export function covertFieldToPrismaColumnType(field: ColumnMetadata['typeName']): ColumnType {
    switch (field?.toUpperCase()) {
        case 'INT8':
        case 'UINT8':
        case 'INT16':
        case 'UINT16':
        case 'INT24':
        case 'UINT24':
        case 'INT32':
        case 'YEAR':
            return ColumnTypeEnum.Int32
        case 'UINT32':
        case 'INT64':
        case 'UINT64':
            return ColumnTypeEnum.Int64
        case 'FLOAT32':
            return ColumnTypeEnum.Float
        case 'FLOAT64':
            return ColumnTypeEnum.Double
        case 'TIMESTAMP':
        case 'DATETIME':
            return ColumnTypeEnum.DateTime
        case 'DATE':
            return ColumnTypeEnum.Date
        case 'TIME':
            return ColumnTypeEnum.Time
        case 'DECIMAL':
            return ColumnTypeEnum.Numeric
        case 'CHAR':
        case 'TEXT':
        case 'VARCHAR':
            return ColumnTypeEnum.Text
        case 'ENUM':
            return ColumnTypeEnum.Enum
        case 'JSON':
            return ColumnTypeEnum.Json
        case 'BLOB':
        case 'BINARY':
        case 'VARBINARY':
        case 'BIT':
        case 'BITNUM':
        case 'HEXNUM':
        case 'HEXVAL':
        case 'GEOMETRY':
            return ColumnTypeEnum.Bytes
        case 'NULL':
            // Fall back to Int32 for consistency with quaint.
            return ColumnTypeEnum.Int32
        default:
            throw new Error(`Unsupported column type: ${field}`)
    }
}