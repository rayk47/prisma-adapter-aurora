import { ArgType } from "@prisma/driver-adapter-utils";
import { Field, SqlParameter, TypeHint } from "@aws-sdk/client-rds-data";
import { isArray, isNil } from "lodash";

/**
 * Used when converting positional parameters to variable parameters
 */
const prefixedParameterVariableName = 'id';

/**
 * See https://github.com/rayk47/prisma-adapter-aurora/issues/3 for more context
 * @param sql prisma built SQL statement
 * @returns sql RDS Compatible SQL statement
 */
export const convertSql = (sql: string) => {
    return sql.replace(/\$/g, ':' + prefixedParameterVariableName); //TODO nasty hack that needs to be reviewed and fixed
}

/**
 * Convert Prisma built parameters to parameters that are compatible with the RDS Data API
 * @param parameters prisma built parameters
 * @param parameterTypes the type of parameter being passed in by prisma. This is helpful for giving type hints to the RDS Data API
 * @returns an rds compatible parameter list
 */
export const convertParameters = (parameters: unknown[], parameterTypes: ArgType[]): SqlParameter[] => {
    parameters = fixArrayBufferParameters(parameters);
    const rdsParameters: SqlParameter[] = (parameters).map((value: unknown, index) => {
        return {
            name: prefixedParameterVariableName + String(index + 1),
            value: getRdsField(value, parameterTypes[index]!),
            typeHint: getTypeHint(parameterTypes[index]!)
        }
    });
    return rdsParameters;
}

const getTypeHint = (argType: ArgType): TypeHint | undefined => {
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

const getRdsField = (value: any | any[], argType: ArgType): Field => {
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
            //TODO: Fix this https://github.com/rayk47/prisma-adapter-aurora/issues/10
            return isArray(value) ? { 'arrayValue': { 'arrayValues': [] } } : { 'isNull': true };
        // return isArray(value) ? { 'arrayValue': { 'arrayValues': value.map(v => convertValueToRDSField(v)) } } : { 'isNull': true };
        case 'Numeric':
            return isNil(value) ? { 'isNull': true } : { 'doubleValue': parseFloat(value) };
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
 * https://github.com/brianc/node-postgres/pull/2930
 * See https://github.com/rayk47/prisma-adapter-aurora/issues/2
 * @param values 
 * @returns 
 */
function fixArrayBufferParameters(values: unknown[]) {
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