import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { PickVersionElement } from './backend';
type Document = OpenAPIV3_1.Document | OpenAPIV3.Document;
export type Operation<D extends Document = Document> = PickVersionElement<D, OpenAPIV3.OperationObject, OpenAPIV3_1.OperationObject> & {
    path: string;
    method: string;
};
export type AnyRequestBody = any;
export type UnknownParams = any;
export interface Request {
    method: string;
    path: string;
    headers: {
        [key: string]: string | string[];
    };
    query?: {
        [key: string]: string | string[];
    } | string;
    body?: AnyRequestBody;
}
export interface ParsedRequest<RequestBody = AnyRequestBody, Params = UnknownParams, Query = UnknownParams, Headers = UnknownParams, Cookies = UnknownParams> {
    method: string;
    path: string;
    requestBody: RequestBody;
    params: Params;
    query: Query;
    headers: Headers;
    cookies: Cookies;
    body?: AnyRequestBody;
}
export declare class OpenAPIRouter<D extends Document = Document> {
    definition: D;
    apiRoot: string;
    private ignoreTrailingSlashes;
    constructor(opts: {
        definition: D;
        apiRoot?: string;
        ignoreTrailingSlashes?: boolean;
    });
    matchOperation(req: Request): Operation<D> | undefined;
    matchOperation(req: Request, strict: boolean): Operation<D>;
    getOperations(): Operation<D>[];
    getOperation(operationId: string): Operation<D> | undefined;
    normalizeRequest(req: Request): Request;
    normalizePath(pathInput: string): string;
    parseRequest(req: Request, operation?: Operation<D>): ParsedRequest;
}
export {};
