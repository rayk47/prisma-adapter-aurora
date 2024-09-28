import { ColumnMetadata, Field } from "@aws-sdk/client-rds-data";
import { ColumnType, ColumnTypeEnum, Debug } from "@prisma/driver-adapter-utils";

const debug = Debug('prisma:driver-adapter:aurora');

/**
 * Convert the column type returned by RDS to a column type that Prisma can process
 * @param typeName 
 * @returns a prisma compatible column type
 */
export const convertColumnType = (typeName: ColumnMetadata['typeName']): ColumnType => {
    //TODO may need to dig into how null is handled
    switch (typeName?.toUpperCase()) {
        case 'SERIAL':
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
            debug(`[js::convertColumnType] Unsupported RDS column type ${typeName}. Please raise a github issue asking for support of this type %O`);
            throw new Error(`Unsupported column type: ${typeName}`);
    }
}

/**
 * Convert a value returned from RDS to a value that is compatible with Prisma
 * @param field 
 * @returns a prisma compatible value
 */
export const convertValue = (field: Field) => {
    if (field.stringValue) {
        return field.stringValue;
    } else if (field.doubleValue) {
        return field.doubleValue;
    } else if (field.booleanValue) {
        return field.booleanValue;
    } else if (field.blobValue) {
        return field.blobValue;
    } else if (field.longValue) {
        return field.longValue;
    } else if (field.isNull) {
        return null;
    } else if (field.arrayValue) {
        //TODO: Fix this https://github.com/rayk47/prisma-adapter-aurora/issues/10
        return field.arrayValue;
    } else {
        debug(`[js::convertValue] RDS Data API field ${field} is not supported for value conversion. Please raise a github issue asking for support of this field %O`, field);
    }
}