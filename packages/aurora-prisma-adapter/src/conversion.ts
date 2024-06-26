import { SqlParameter } from "@aws-sdk/client-rds-data";

export const buildRdsParametersFromValues = (values: unknown[]) => {
    values = fixArrayBufferValues(values);
    const parameters: SqlParameter[] = (values).map((param: any, index) => { return { name: String(index + 1), value: { stringValue: param } } });
    return parameters;
}

export const transformPrismaSqlQueryToRdsQuery = (sql: string) => {
    return sql.replace(/\$/g, ':'); //TODO nasty hack that needs to be reviewed 
}

// https://github.com/brianc/node-postgres/pull/2930
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