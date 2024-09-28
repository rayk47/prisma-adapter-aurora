import { ArgType, Debug } from "@prisma/driver-adapter-utils";
import { Field, SqlParameter, TypeHint } from "@aws-sdk/client-rds-data";
import { isArray, isNil } from "lodash";

const debug = Debug('prisma:driver-adapter:aurora');

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

//TODO needs more type checking, and nil checking
const getRdsField = (value: unknown | unknown[], argType: ArgType): Field => {
    switch (argType) {
        case 'Int32':
        case 'Int64':
            debug(`[js::getRdsField] Converting ${argType} to longValue with value ${value} %O`);
            return { 'longValue': value as number };
        case 'Float':
        case 'Double':
            debug(`[js::getRdsField] Converting ${argType} to doubleValue with value ${value} %O`);
            return { 'doubleValue': value as number };
        case 'Text':
        case 'Char':
        case 'Json':
        case 'Xml':
        case 'Uuid':
        case 'DateTime':
        case 'Date':
        case 'Time':
            debug(`[js::getRdsField] Converting ${argType} to stringValue with value ${value} %O`);
            return { 'stringValue': value as string };
        case 'Enum':
        case 'EnumArray': // Handle Enums and Enum Arrays as Text values. TODO the enum array needs testing
            debug(`[js::getRdsField] Converting ${argType} to stringValue with value ${value} %O`);
            return { 'stringValue': value as string };
        case 'Bytes':
            debug(`[js::getRdsField] Converting ${argType} to blobValue with value ${value} %O`);
            return { 'blobValue': value as Uint8Array };
        case 'Boolean':
            debug(`[js::getRdsField] Converting ${argType} to booleanValue with value ${value} %O`);
            return { 'booleanValue': value as boolean };
        case 'Array':
            debug(`[js::getRdsField] Converting ${argType} to arrayValue with value ${value} %O`);
            //TODO: Fix this https://github.com/rayk47/prisma-adapter-aurora/issues/10
            return isArray(value) ? { 'arrayValue': { 'arrayValues': [] } } : { 'isNull': true };
        // return isArray(value) ? { 'arrayValue': { 'arrayValues': value.map(v => convertValueToRDSField(v)) } } : { 'isNull': true };
        case 'Numeric':
            debug(`[js::getRdsField] Converting ${argType} to doubleValue with value ${value} %O`);
            return isNil(value) ? { 'isNull': true } : { 'doubleValue': parseFloat(value as string) };
        default:
            debug(`[js::getRdsField] Unsupported Prisma Type ${argType}. Please raise a github issue asking for support of this type %O`, argType);
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