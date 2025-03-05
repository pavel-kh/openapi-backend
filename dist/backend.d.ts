import type { Options as AjvOpts } from 'ajv';
import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { OpenAPIRouter, Request, ParsedRequest, Operation, UnknownParams } from './router';
import { OpenAPIValidator, ValidationResult, AjvCustomizer } from './validation';
export type Document = OpenAPIV3_1.Document | OpenAPIV3.Document;
export type PickVersionElement<D extends Document, V30, V31> = D extends OpenAPIV3_1.Document ? V31 : V30;
export type SecurityRequirement = OpenAPIV3_1.SecurityRequirementObject | OpenAPIV3.SecurityRequirementObject;
interface SecurityHandlerResults {
    [name: string]: any;
}
export interface SecurityContext extends SecurityHandlerResults {
    authorized: boolean;
}
export interface Context<RequestBody = any, Params = UnknownParams, Query = UnknownParams, Headers = UnknownParams, Cookies = UnknownParams, D extends Document = Document> {
    api: OpenAPIBackend<D>;
    request: ParsedRequest<RequestBody, Params, Query, Headers, Cookies>;
    operation: Operation<D>;
    validation: ValidationResult;
    security: SecurityHandlerResults;
    response: any;
}
export type Handler<RequestBody = any, Params = UnknownParams, Query = UnknownParams, Headers = UnknownParams, Cookies = UnknownParams, D extends Document = Document> = (context: Context<RequestBody, Params, Query, Headers, Cookies, D>, ...args: any[]) => any | Promise<any>;
export type HandlerMap = {
    [operationId: string]: Handler | undefined;
};
export type BoolPredicate = (context: Context, ...args: any[]) => boolean;
export declare enum SetMatchType {
    Any = "any",
    Superset = "superset",
    Subset = "subset",
    Exact = "exact"
}
export interface Options<D extends Document = Document> {
    definition: D | string;
    apiRoot?: string;
    strict?: boolean;
    quick?: boolean;
    validate?: boolean | BoolPredicate;
    ajvOpts?: AjvOpts;
    customizeAjv?: AjvCustomizer;
    handlers?: HandlerMap & {
        notFound?: Handler;
        notImplemented?: Handler;
        validationFail?: Handler;
    };
    securityHandlers?: HandlerMap;
    ignoreTrailingSlashes?: boolean;
}
export declare class OpenAPIBackend<D extends Document = Document> {
    document: D;
    inputDocument: D | string;
    definition: D;
    apiRoot: string;
    initalized: boolean;
    strict: boolean;
    quick: boolean;
    validate: boolean | BoolPredicate;
    ignoreTrailingSlashes: boolean;
    ajvOpts: AjvOpts;
    customizeAjv: AjvCustomizer | undefined;
    handlers: HandlerMap;
    allowedHandlers: string[];
    securityHandlers: HandlerMap;
    router: OpenAPIRouter<D>;
    validator: OpenAPIValidator<D>;
    constructor(opts: Options<D>);
    init(): Promise<this>;
    loadDocument(): Promise<D>;
    handleRequest(req: Request, ...handlerArgs: any[]): Promise<any>;
    registerHandler(operationId: string, handler: Handler): void;
    register<Handlers extends HandlerMap = HandlerMap>(handlers: Handlers): void;
    register<OperationHandler = Handler>(operationId: string, handler: OperationHandler): void;
    registerSecurityHandler(name: string, handler: Handler): void;
    mockResponseForOperation(operationId: string, opts?: {
        code?: number;
        mediaType?: string;
        example?: string;
    }): {
        status: number;
        mock: any;
    };
    validateDefinition(): D;
    getOperations(): Operation<D>[];
    getOperation(operationId: string): Operation<D> | undefined;
    matchOperation(req: Request): Operation<D> | undefined;
    validateRequest(req: Request, operation?: Operation<D> | string): ValidationResult;
    validateResponse(res: any, operation: Operation<D> | string, statusCode?: number): ValidationResult;
    validateResponseHeaders(headers: any, operation: Operation<D> | string, opts?: {
        statusCode?: number;
        setMatchType?: SetMatchType;
    }): ValidationResult;
}
export {};
