import { ColumnMetadata, Field, SqlParameter, TypeHint } from "@aws-sdk/client-rds-data";
import { ArgType, type ColumnType, ColumnTypeEnum } from '@prisma/driver-adapter-utils';
import { isArray, isNil } from 'lodash';

/**
 * Used when converting positional parameters to variable parameters
 */
const prefixedParameterVariableName = 'id';

/**
 * Converts the Prisma values to RDS Parameters
 * @param values 
 * @returns SqlParameter[]
 */
export const convertPrismaValuesToRdsParameters = (values: unknown[], argTypes: Array<ArgType>) => {
    values = fixArrayBufferValues(values);
    const parameters: SqlParameter[] = (values).map((value: unknown, index) => { return { name: prefixedParameterVariableName + String(index + 1), value: convertValueToRDSField(value, argTypes[index]!), typeHint: getRDSDataAPITypeHint(argTypes[index]!) } });
    return parameters;
}

const getRDSDataAPITypeHint = (argType: ArgType): TypeHint | undefined => {
    switch (argType) {
        case 'DateTime':
            return 'TIMESTAMP';
        case 'Time':
            return 'TIME';
        case 'Date':
            return 'DATE';
        case 'Json':
            return 'JSON';
        default:
            return undefined;
    }
}

/**
 * Converts a value to RDS Data API field 
 * @param value 
 * @returns Field
 */
const convertValueToRDSField = (value: any | any[], argType: ArgType): Field => {
    switch (argType) {
        case 'Int32':
        case 'Int64':
            return { 'longValue': value };

        case 'Float':
        case 'Double':
            return { 'doubleValue': value };

        case 'Text':
        case 'Char':
            return { 'stringValue': value };

        case 'Enum':
        case 'EnumArray': // Handle Enums and Enum Arrays as Text values. TODO the enum array needs testing
            return { 'stringValue': value };

        case 'Bytes':
            return { 'blobValue': value };

        case 'Boolean':
            return { 'booleanValue': value };

        case 'Array':
            return isArray(value) ? { 'arrayValue': { 'arrayValues': [] } } : { 'isNull': true }; //TODO: Fix this https://github.com/limelighthealth/prisma-adapter-aurora/issues/10
        // return isArray(value) ? { 'arrayValue': { 'arrayValues': value.map(v => convertValueToRDSField(v)) } } : { 'isNull': true };

        case 'Numeric':
            return isNil(value) ? { 'isNull': true } : { 'doubleValue': parseFloat(value) };

        //TODO Review this, this looks wrong
        case 'Json':
        case 'Xml':
            return { 'stringValue': value };

        case 'Uuid':
            return { 'stringValue': value };

        case 'DateTime':
        case 'Date':
        case 'Time':
            return { 'stringValue': value };

        default:
            throw new Error(`Unsupported ArgType: ${argType}`);
    }
}

/**
 * Converts RDS Field to Prisma Value
 * @param value 
 * @returns Field
 */
export const convertRDSFieldToValue = (rdsField: Field) => {
    if (rdsField.stringValue) {
        return rdsField.stringValue;
    } else if (rdsField.doubleValue) {
        return rdsField.doubleValue;
    } else if (rdsField.booleanValue) {
        return rdsField.booleanValue;
    } else if (rdsField.blobValue) {
        return rdsField.blobValue;
    } else if (rdsField.longValue) {
        return rdsField.longValue;
    } else if (rdsField.isNull) {
        return null;
    } else if (rdsField.arrayValue) {
        return rdsField.arrayValue; //TODO: Fix this https://github.com/limelighthealth/prisma-adapter-aurora/issues/10
    }
}

/**
 * Converts the columns returned by RDS to a corresponding Prisma Column Type that the Prisma Client and Engine can use
 * Needs more testing. See https://github.com/limelighthealth/prisma-adapter-aurora/issues/5
 * @param field 
 * @returns ColumnType
 */
export function covertFieldToPrismaColumnType(field: ColumnMetadata['typeName']): ColumnType {
    //TODO may need to dig into how null is handled
    switch (field?.toUpperCase()) {
        case 'INT2':
        case 'INT4':
            return ColumnTypeEnum.Int32;
        case 'INT8':
            return ColumnTypeEnum.Int64;
        case 'FLOAT4':
            return ColumnTypeEnum.Float;
        case 'FLOAT8':
            return ColumnTypeEnum.Double;
        case 'NUMERIC':
            return ColumnTypeEnum.Numeric;
        case 'BOOL':
            return ColumnTypeEnum.Boolean;
        case 'CHAR':
        case 'BPCHAR':
        case 'CHARACTER':
            return ColumnTypeEnum.Character;
        case 'TEXT':
        case 'VARCHAR':
            return ColumnTypeEnum.Text;
        case 'DATE':
            return ColumnTypeEnum.Date;
        case 'TIME':
            return ColumnTypeEnum.Time;
        case 'TIMESTAMP':
        case 'TIMESTAMPTZ':
            return ColumnTypeEnum.DateTime;
        case 'JSON':
        case 'JSONB':
            return ColumnTypeEnum.Json;
        case 'ENUM':
            return ColumnTypeEnum.Enum;
        case 'BYTEA':
            return ColumnTypeEnum.Bytes;
        case 'UUID':
            return ColumnTypeEnum.Uuid;
        case 'INT4[]':
            return ColumnTypeEnum.Int32Array;
        case 'INT8[]':
            return ColumnTypeEnum.Int64Array;
        case 'FLOAT4[]':
            return ColumnTypeEnum.FloatArray;
        case 'FLOAT8[]':
            return ColumnTypeEnum.DoubleArray;
        case 'NUMERIC[]':
            return ColumnTypeEnum.NumericArray;
        case 'BOOL[]':
            return ColumnTypeEnum.BooleanArray;
        case 'TEXT[]':
        case 'VARCHAR[]':
            return ColumnTypeEnum.TextArray;
        case 'DATE[]':
            return ColumnTypeEnum.DateArray;
        case 'TIME[]':
            return ColumnTypeEnum.TimeArray;
        case 'TIMESTAMP[]':
        case 'TIMESTAMPTZ[]':
            return ColumnTypeEnum.DateTimeArray;
        case 'JSON[]':
        case 'JSONB[]':
            return ColumnTypeEnum.JsonArray;
        case 'ENUM[]':
            return ColumnTypeEnum.EnumArray;
        case 'BYTEA[]':
            return ColumnTypeEnum.BytesArray;
        case 'UUID[]':
            return ColumnTypeEnum.UuidArray;
        default:
            throw new Error(`Unsupported column type: ${field}`);
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