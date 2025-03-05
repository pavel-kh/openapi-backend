import Ajv, { Options as AjvOpts, ErrorObject, ValidateFunction } from 'ajv';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { OpenAPIRouter, Request, Operation } from './router';
import { SetMatchType } from './backend';
type Document = OpenAPIV3_1.Document | OpenAPIV3.Document;
export interface ValidationResult {
    valid: boolean;
    errors?: ErrorObject[] | null;
}
interface ResponseHeadersValidateFunctionMap {
    [statusCode: string]: {
        [setMatchType: string]: ValidateFunction;
    };
}
interface StatusBasedResponseValidatorsFunctionMap {
    [statusCode: string]: ValidateFunction;
}
export declare enum ValidationContext {
    RequestBody = "requestBodyValidator",
    Params = "paramsValidator",
    Response = "responseValidator",
    ResponseHeaders = "responseHeadersValidator"
}
export type AjvCustomizer = (originalAjv: Ajv, ajvOpts: AjvOpts, validationContext: ValidationContext) => Ajv;
export declare class OpenAPIValidator<D extends Document = Document> {
    definition: D;
    ajvOpts: AjvOpts;
    lazyCompileValidators: boolean;
    customizeAjv: AjvCustomizer | undefined;
    requestValidators: {
        [operationId: string]: ValidateFunction[] | null;
    };
    responseValidators: {
        [operationId: string]: ValidateFunction | null;
    };
    statusBasedResponseValidators: {
        [operationId: string]: StatusBasedResponseValidatorsFunctionMap | null;
    };
    responseHeadersValidators: {
        [operationId: string]: ResponseHeadersValidateFunctionMap | null;
    };
    router: OpenAPIRouter<D>;
    constructor(opts: {
        definition: D;
        ajvOpts?: AjvOpts;
        router?: OpenAPIRouter<D>;
        lazyCompileValidators?: boolean;
        customizeAjv?: AjvCustomizer;
    });
    preCompileRequestValidators(): void;
    preCompileResponseValidators(): void;
    preCompileResponseHeaderValidators(): void;
    validateRequest(req: Request, operation?: Operation<D> | string): ValidationResult;
    validateResponse(res: any, operation: Operation<D> | string, statusCode?: number): ValidationResult;
    validateResponseHeaders(headers: any, operation: Operation<D> | string, opts?: {
        statusCode?: number;
        setMatchType?: SetMatchType;
    }): ValidationResult;
    getRequestValidatorsForOperation(operationId: string): ValidateFunction<unknown>[] | null;
    private static compileSchema;
    private static decycle;
    buildRequestValidatorsForOperation(operation: Operation<D>): ValidateFunction[] | null;
    getResponseValidatorForOperation(operationId: string): ValidateFunction<unknown> | null;
    buildResponseValidatorForOperation(operation: Operation<D>): ValidateFunction | null;
    getStatusBasedResponseValidatorForOperation(operationId: string): StatusBasedResponseValidatorsFunctionMap | null;
    buildStatusBasedResponseValidatorForOperation(operation: Operation<D>): StatusBasedResponseValidatorsFunctionMap | null;
    getResponseHeadersValidatorForOperation(operationId: string): ResponseHeadersValidateFunctionMap | null;
    buildResponseHeadersValidatorForOperation(operation: Operation<D>): ResponseHeadersValidateFunctionMap | null;
    getAjv(validationContext: ValidationContext, opts?: AjvOpts): Ajv;
}
export {};
