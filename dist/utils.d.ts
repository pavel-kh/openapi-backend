import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { Operation } from './router';
type Document = OpenAPIV3_1.Document | OpenAPIV3.Document;
export default class OpenAPIUtils {
    static findStatusCodeMatch(statusCode: number, obj: {
        [patternedStatusCode: string]: any;
    }): any;
    static findDefaultStatusCodeMatch(obj: {
        [patternedStatusCode: string]: any;
    }): {
        status: number;
        res: any;
    };
    static getOperationId<D extends Document = Document>(operation: Operation<D>): string;
}
export {};
