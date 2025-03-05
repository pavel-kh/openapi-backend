"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAPIValidator = exports.ValidationContext = void 0;
const _ = __importStar(require("lodash"));
const ajv_1 = __importDefault(require("ajv"));
const router_1 = require("./router");
const utils_1 = __importDefault(require("./utils"));
const backend_1 = require("./backend");
var ValidationContext;
(function (ValidationContext) {
    ValidationContext["RequestBody"] = "requestBodyValidator";
    ValidationContext["Params"] = "paramsValidator";
    ValidationContext["Response"] = "responseValidator";
    ValidationContext["ResponseHeaders"] = "responseHeadersValidator";
})(ValidationContext || (exports.ValidationContext = ValidationContext = {}));
function getBitRangeValidator(bits) {
    const max = Math.pow(2, bits - 1);
    return (value) => value >= -max && value < max;
}
const defaultFormats = {
    int32: {
        type: 'number',
        validate: getBitRangeValidator(32),
    },
    int64: {
        type: 'number',
        validate: getBitRangeValidator(64),
    },
    float: {
        type: 'number',
        validate: () => true,
    },
    double: {
        type: 'number',
        validate: () => true,
    },
    byte: {
        type: 'string',
        validate: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    },
    binary: {
        type: 'string',
        validate: () => true,
    },
    password: {
        type: 'string',
        validate: () => true,
    },
};
class OpenAPIValidator {
    constructor(opts) {
        this.definition = opts.definition;
        this.ajvOpts = {
            strict: false,
            ...(opts.ajvOpts || {}),
        };
        this.customizeAjv = opts.customizeAjv;
        this.router = opts.router || new router_1.OpenAPIRouter({ definition: this.definition });
        this.requestValidators = {};
        this.responseValidators = {};
        this.statusBasedResponseValidators = {};
        this.responseHeadersValidators = {};
        if (!opts.lazyCompileValidators) {
            this.preCompileRequestValidators();
            this.preCompileResponseValidators();
            this.preCompileResponseHeaderValidators();
        }
    }
    preCompileRequestValidators() {
        const operations = this.router.getOperations();
        for (const operation of operations) {
            const operationId = utils_1.default.getOperationId(operation);
            this.requestValidators[operationId] = this.buildRequestValidatorsForOperation(operation);
        }
    }
    preCompileResponseValidators() {
        const operations = this.router.getOperations();
        for (const operation of operations) {
            const operationId = utils_1.default.getOperationId(operation);
            this.responseValidators[operationId] = this.buildResponseValidatorForOperation(operation);
            this.statusBasedResponseValidators[operationId] = this.buildStatusBasedResponseValidatorForOperation(operation);
        }
    }
    preCompileResponseHeaderValidators() {
        const operations = this.router.getOperations();
        for (const operation of operations) {
            const operationId = utils_1.default.getOperationId(operation);
            this.responseHeadersValidators[operationId] = this.buildResponseHeadersValidatorForOperation(operation);
        }
    }
    validateRequest(req, operation) {
        const result = { valid: true };
        result.errors = [];
        if (!operation) {
            operation = this.router.matchOperation(req);
        }
        else if (typeof operation === 'string') {
            operation = this.router.getOperation(operation);
        }
        if (!operation || !operation.operationId) {
            throw new Error(`Unknown operation`);
        }
        const { operationId } = operation;
        const validators = this.getRequestValidatorsForOperation(operationId) || [];
        const { params, query, headers, cookies, requestBody } = this.router.parseRequest(req, operation);
        if (query) {
            for (const [name, value] of _.entries(query)) {
                if (typeof value === 'string') {
                    const operationParameter = _.find(operation.parameters, { name, in: 'query' });
                    if (operationParameter) {
                        const { schema } = operationParameter;
                        if (schema &&
                            schema.type === 'array') {
                            query[name] = [value];
                        }
                    }
                }
            }
        }
        const parameters = _.omitBy({
            path: params,
            query,
            header: headers,
            cookie: cookies,
        }, _.isNil);
        if (typeof req.body !== 'object' && req.body !== undefined) {
            const payloadFormats = _.keys(_.get(operation, 'requestBody.content', {}));
            if (payloadFormats.length === 1 && payloadFormats[0] === 'application/json') {
                try {
                    JSON.parse(`${req.body}`);
                }
                catch (err) {
                    if (err instanceof Error) {
                        result.errors.push({
                            keyword: 'parse',
                            instancePath: '',
                            schemaPath: '#/requestBody',
                            params: [],
                            message: err.message,
                        });
                    }
                }
            }
        }
        if (typeof requestBody === 'object' || headers['content-type'] === 'application/json') {
            parameters.requestBody = requestBody;
        }
        for (const validate of validators) {
            validate(parameters);
            if (validate.errors) {
                result.errors.push(...validate.errors);
            }
        }
        if (_.isEmpty(result.errors)) {
            result.errors = null;
        }
        else {
            result.valid = false;
        }
        return result;
    }
    validateResponse(res, operation, statusCode) {
        const result = { valid: true };
        result.errors = [];
        const op = typeof operation === 'string' ? this.router.getOperation(operation) : operation;
        if (!op || !op.operationId) {
            throw new Error(`Unknown operation`);
        }
        const { operationId } = op;
        let validate = null;
        if (statusCode) {
            const validateMap = this.getStatusBasedResponseValidatorForOperation(operationId);
            if (validateMap) {
                validate = utils_1.default.findStatusCodeMatch(statusCode, validateMap);
            }
        }
        else {
            validate = this.getResponseValidatorForOperation(operationId);
        }
        if (validate) {
            validate(res);
            if (validate.errors) {
                result.errors.push(...validate.errors);
            }
        }
        else {
        }
        if (_.isEmpty(result.errors)) {
            result.errors = null;
        }
        else {
            result.valid = false;
        }
        return result;
    }
    validateResponseHeaders(headers, operation, opts) {
        const result = { valid: true };
        result.errors = [];
        const op = typeof operation === 'string' ? this.router.getOperation(operation) : operation;
        if (!op || !op.operationId) {
            throw new Error(`Unknown operation`);
        }
        let setMatchType = opts && opts.setMatchType;
        const statusCode = opts && opts.statusCode;
        if (!setMatchType) {
            setMatchType = backend_1.SetMatchType.Any;
        }
        else if (!_.includes(Object.values(backend_1.SetMatchType), setMatchType)) {
            throw new Error(`Unknown setMatchType ${setMatchType}`);
        }
        const { operationId } = op;
        const validateMap = this.getResponseHeadersValidatorForOperation(operationId);
        if (validateMap) {
            let validateForStatus;
            if (statusCode) {
                validateForStatus = utils_1.default.findStatusCodeMatch(statusCode, validateMap);
            }
            else {
                validateForStatus = utils_1.default.findDefaultStatusCodeMatch(validateMap).res;
            }
            if (validateForStatus) {
                const validate = validateForStatus[setMatchType];
                if (validate) {
                    headers = _.mapKeys(headers, (_, headerName) => headerName.toLowerCase());
                    validate({ headers });
                    if (validate.errors) {
                        result.errors.push(...validate.errors);
                    }
                }
            }
        }
        if (_.isEmpty(result.errors)) {
            result.errors = null;
        }
        else {
            result.valid = false;
        }
        return result;
    }
    getRequestValidatorsForOperation(operationId) {
        if (this.requestValidators[operationId] === undefined) {
            const operation = this.router.getOperation(operationId);
            this.requestValidators[operationId] = this.buildRequestValidatorsForOperation(operation);
        }
        return this.requestValidators[operationId];
    }
    static compileSchema(ajv, schema) {
        const decycledSchema = this.decycle(schema);
        return ajv.compile(decycledSchema);
    }
    static decycle(object) {
        const objects = new WeakMap();
        return (function derez(value, path) {
            let oldPath;
            let nu;
            if (typeof value === 'object' &&
                value !== null &&
                !(value instanceof Boolean) &&
                !(value instanceof Date) &&
                !(value instanceof Number) &&
                !(value instanceof RegExp) &&
                !(value instanceof String)) {
                oldPath = objects.get(value);
                if (oldPath !== undefined) {
                    return { $ref: oldPath };
                }
                objects.set(value, path);
                if (Array.isArray(value)) {
                    nu = [];
                    value.forEach((element, i) => {
                        nu[i] = derez(element, path + '/' + i);
                    });
                }
                else {
                    nu = {};
                    Object.keys(value).forEach((name) => {
                        nu[name] = derez(value[name], path + '/' + name);
                    });
                }
                return nu;
            }
            return value;
        })(object, '#');
    }
    buildRequestValidatorsForOperation(operation) {
        if (!(operation === null || operation === void 0 ? void 0 : operation.operationId)) {
            return null;
        }
        const validators = [];
        if (operation.requestBody) {
            const requestBody = operation.requestBody;
            const jsonbody = requestBody.content['application/json'];
            if (jsonbody && jsonbody.schema) {
                const requestBodySchema = {
                    title: 'Request',
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                        requestBody: jsonbody.schema,
                    },
                };
                requestBodySchema.required = [];
                if (_.keys(requestBody.content).length === 1) {
                    requestBodySchema.required.push('requestBody');
                }
                const requestBodyValidator = this.getAjv(ValidationContext.RequestBody);
                validators.push(OpenAPIValidator.compileSchema(requestBodyValidator, requestBodySchema));
            }
        }
        const paramsSchema = {
            title: 'Request',
            type: 'object',
            additionalProperties: true,
            properties: {
                path: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {},
                    required: [],
                },
                query: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false,
                    required: [],
                },
                header: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {},
                    required: [],
                },
                cookie: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {},
                    required: [],
                },
            },
            required: [],
        };
        const { parameters } = operation;
        if (parameters) {
            parameters.map((parameter) => {
                const param = parameter;
                const target = paramsSchema.properties[param.in];
                const normalizedParamName = param.in === 'header' ? param.name.toLowerCase() : param.name;
                if (param.required) {
                    target.required = target.required || [];
                    target.required = _.uniq([...target.required, normalizedParamName]);
                    paramsSchema.required = _.uniq([...paramsSchema.required, param.in]);
                }
                target.properties = target.properties || {};
                const paramSchema = param.schema;
                if (paramSchema && (paramSchema === null || paramSchema === void 0 ? void 0 : paramSchema.additionalProperties) !== undefined) {
                    target.additionalProperties = paramSchema.additionalProperties;
                }
                if (param.content && param.content['application/json']) {
                    target.properties[normalizedParamName] = param.content['application/json'].schema;
                }
                else {
                    target.properties[normalizedParamName] = param.schema;
                }
            });
        }
        const paramsValidator = this.getAjv(ValidationContext.Params, { coerceTypes: true });
        validators.push(OpenAPIValidator.compileSchema(paramsValidator, paramsSchema));
        return validators;
    }
    getResponseValidatorForOperation(operationId) {
        if (this.responseValidators[operationId] === undefined) {
            const operation = this.router.getOperation(operationId);
            this.responseValidators[operationId] = this.buildResponseValidatorForOperation(operation);
        }
        return this.responseValidators[operationId];
    }
    buildResponseValidatorForOperation(operation) {
        if (!operation || !operation.operationId) {
            return null;
        }
        if (!operation.responses) {
            return null;
        }
        const responseSchemas = [];
        _.mapKeys(operation.responses, (res, _status) => {
            const response = res;
            if (response.content && response.content['application/json'] && response.content['application/json'].schema) {
                responseSchemas.push(response.content['application/json'].schema);
            }
            return null;
        });
        if (_.isEmpty(responseSchemas)) {
            return null;
        }
        const schema = { oneOf: responseSchemas };
        const responseValidator = this.getAjv(ValidationContext.Response);
        return OpenAPIValidator.compileSchema(responseValidator, schema);
    }
    getStatusBasedResponseValidatorForOperation(operationId) {
        if (this.statusBasedResponseValidators[operationId] === undefined) {
            const operation = this.router.getOperation(operationId);
            this.statusBasedResponseValidators[operationId] = this.buildStatusBasedResponseValidatorForOperation(operation);
        }
        return this.statusBasedResponseValidators[operationId];
    }
    buildStatusBasedResponseValidatorForOperation(operation) {
        if (!operation || !operation.operationId) {
            return null;
        }
        if (!operation.responses) {
            return null;
        }
        const responseValidators = {};
        const validator = this.getAjv(ValidationContext.Response);
        _.mapKeys(operation.responses, (res, status) => {
            const response = res;
            if (response.content && response.content['application/json'] && response.content['application/json'].schema) {
                const validateFn = response.content['application/json'].schema;
                responseValidators[status] = OpenAPIValidator.compileSchema(validator, validateFn);
            }
            if (!response.content && status === '204') {
                const validateFn = {
                    type: 'null',
                    title: 'The root schema',
                    description: 'The root schema comprises the entire JSON document.',
                    default: null,
                };
                responseValidators[status] = OpenAPIValidator.compileSchema(validator, validateFn);
            }
            return null;
        });
        return responseValidators;
    }
    getResponseHeadersValidatorForOperation(operationId) {
        if (this.responseHeadersValidators[operationId] === undefined) {
            const operation = this.router.getOperation(operationId);
            this.responseHeadersValidators[operationId] = this.buildResponseHeadersValidatorForOperation(operation);
        }
        return this.responseHeadersValidators[operationId];
    }
    buildResponseHeadersValidatorForOperation(operation) {
        if (!operation || !operation.operationId) {
            return null;
        }
        if (!operation.responses) {
            return null;
        }
        const headerValidators = {};
        const validator = this.getAjv(ValidationContext.ResponseHeaders, { coerceTypes: true });
        _.mapKeys(operation.responses, (res, status) => {
            const response = res;
            const validateFns = {};
            const properties = {};
            const required = [];
            _.mapKeys(response.headers, (h, headerName) => {
                const header = h;
                headerName = headerName.toLowerCase();
                if (header.schema) {
                    properties[headerName] = header.schema;
                    required.push(headerName);
                }
                return null;
            });
            validateFns[backend_1.SetMatchType.Any] = OpenAPIValidator.compileSchema(validator, {
                type: 'object',
                properties: {
                    headers: {
                        type: 'object',
                        additionalProperties: true,
                        properties,
                        required: [],
                    },
                },
            });
            validateFns[backend_1.SetMatchType.Superset] = OpenAPIValidator.compileSchema(validator, {
                type: 'object',
                properties: {
                    headers: {
                        type: 'object',
                        additionalProperties: true,
                        properties,
                        required,
                    },
                },
            });
            validateFns[backend_1.SetMatchType.Subset] = OpenAPIValidator.compileSchema(validator, {
                type: 'object',
                properties: {
                    headers: {
                        type: 'object',
                        additionalProperties: false,
                        properties,
                        required: [],
                    },
                },
            });
            validateFns[backend_1.SetMatchType.Exact] = OpenAPIValidator.compileSchema(validator, {
                type: 'object',
                properties: {
                    headers: {
                        type: 'object',
                        additionalProperties: false,
                        properties,
                        required,
                    },
                },
            });
            headerValidators[status] = validateFns;
            return null;
        });
        return headerValidators;
    }
    getAjv(validationContext, opts = {}) {
        const ajvOpts = { ...this.ajvOpts, ...opts };
        const ajv = new ajv_1.default(ajvOpts);
        for (const [name, format] of Object.entries(defaultFormats)) {
            ajv.addFormat(name, format);
        }
        if (this.customizeAjv) {
            return this.customizeAjv(ajv, ajvOpts, validationContext);
        }
        return ajv;
    }
}
exports.OpenAPIValidator = OpenAPIValidator;
//# sourceMappingURL=validation.js.map