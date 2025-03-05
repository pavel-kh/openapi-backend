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
exports.OpenAPIBackend = exports.SetMatchType = void 0;
const _ = __importStar(require("lodash"));
const openapi_schema_validator_1 = __importDefault(require("openapi-schema-validator"));
const refparser_1 = require("./refparser");
const dereference_json_schema_1 = require("dereference-json-schema");
const mock_json_schema_1 = require("mock-json-schema");
const router_1 = require("./router");
const validation_1 = require("./validation");
const utils_1 = __importDefault(require("./utils"));
var SetMatchType;
(function (SetMatchType) {
    SetMatchType["Any"] = "any";
    SetMatchType["Superset"] = "superset";
    SetMatchType["Subset"] = "subset";
    SetMatchType["Exact"] = "exact";
})(SetMatchType || (exports.SetMatchType = SetMatchType = {}));
class OpenAPIBackend {
    constructor(opts) {
        var _a, _b;
        this.allowedHandlers = [
            '404',
            'notFound',
            '405',
            'methodNotAllowed',
            '501',
            'notImplemented',
            '400',
            'validationFail',
            'unauthorizedHandler',
            'postResponseHandler',
        ];
        const optsWithDefaults = {
            apiRoot: '/',
            validate: true,
            strict: false,
            quick: false,
            ignoreTrailingSlashes: true,
            handlers: {},
            securityHandlers: {},
            ...opts,
        };
        this.apiRoot = (_a = optsWithDefaults.apiRoot) !== null && _a !== void 0 ? _a : '/';
        this.inputDocument = optsWithDefaults.definition;
        this.strict = !!optsWithDefaults.strict;
        this.quick = !!optsWithDefaults.quick;
        this.validate = !!optsWithDefaults.validate;
        this.ignoreTrailingSlashes = !!optsWithDefaults.ignoreTrailingSlashes;
        this.handlers = { ...optsWithDefaults.handlers };
        this.securityHandlers = { ...optsWithDefaults.securityHandlers };
        this.ajvOpts = (_b = optsWithDefaults.ajvOpts) !== null && _b !== void 0 ? _b : {};
        this.customizeAjv = optsWithDefaults.customizeAjv;
    }
    async init() {
        try {
            if (this.quick) {
                this.loadDocument();
            }
            else {
                await this.loadDocument();
            }
            if (!this.quick) {
                this.validateDefinition();
            }
            if (typeof this.inputDocument === 'string') {
                this.definition = (await (0, refparser_1.dereference)(this.inputDocument));
            }
            else if (this.quick && typeof this.inputDocument === 'object') {
                this.definition = (0, dereference_json_schema_1.dereferenceSync)(this.inputDocument);
            }
            else {
                this.definition = (await (0, refparser_1.dereference)(this.document || this.inputDocument));
            }
        }
        catch (err) {
            if (this.strict) {
                throw err;
            }
            else {
                console.warn(err);
            }
        }
        this.router = new router_1.OpenAPIRouter({
            definition: this.definition,
            apiRoot: this.apiRoot,
            ignoreTrailingSlashes: this.ignoreTrailingSlashes,
        });
        if (this.validate !== false) {
            this.validator = new validation_1.OpenAPIValidator({
                definition: this.definition,
                ajvOpts: this.ajvOpts,
                customizeAjv: this.customizeAjv,
                router: this.router,
                lazyCompileValidators: Boolean(this.quick),
            });
        }
        this.initalized = true;
        if (this.handlers) {
            this.register(this.handlers);
        }
        if (this.securityHandlers) {
            for (const [name, handler] of Object.entries(this.securityHandlers)) {
                if (handler) {
                    this.registerSecurityHandler(name, handler);
                }
            }
        }
        return this;
    }
    async loadDocument() {
        this.document = (await (0, refparser_1.parse)(this.inputDocument));
        if (this.document.paths) {
            const normalizedPaths = {};
            for (const [path, pathObj] of Object.entries(this.document.paths)) {
                const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
                normalizedPaths[normalizedPath] = pathObj;
            }
            this.document.paths = normalizedPaths;
        }
        return this.document;
    }
    async handleRequest(req, ...handlerArgs) {
        if (!this.initalized) {
            await this.init();
        }
        const context = { api: this };
        const response = await (async () => {
            context.request = this.router.parseRequest(req);
            try {
                context.operation = this.router.matchOperation(req, true);
            }
            catch (err) {
                let handler = this.handlers['404'] || this.handlers['notFound'];
                if (err instanceof Error && err.message.startsWith('405')) {
                    handler = this.handlers['405'] || this.handlers['methodNotAllowed'] || handler;
                }
                if (!handler) {
                    throw err;
                }
                return handler(context, ...handlerArgs);
            }
            const operationId = context.operation.operationId;
            context.request = this.router.parseRequest(req, context.operation);
            const securityRequirements = context.operation.security || [];
            const securitySchemes = _.flatMap(securityRequirements, _.keys);
            const securityHandlerResults = {};
            await Promise.all(securitySchemes.map(async (name) => {
                securityHandlerResults[name] = undefined;
                if (this.securityHandlers[name]) {
                    const securityHandler = this.securityHandlers[name];
                    return await Promise.resolve()
                        .then(() => {
                        if (securityHandler) {
                            return securityHandler(context, ...handlerArgs);
                        }
                        return Promise.resolve();
                    })
                        .then((result) => {
                        securityHandlerResults[name] = result;
                    })
                        .catch((error) => {
                        securityHandlerResults[name] = { error };
                    });
                }
                else {
                    securityHandlerResults[name] = undefined;
                }
            }));
            const requirementsSatisfied = securityRequirements.map((requirementObject) => {
                for (const requirement of Object.keys(requirementObject)) {
                    const requirementResult = securityHandlerResults[requirement];
                    if (Boolean(requirementResult) === false) {
                        return false;
                    }
                    if (typeof requirementResult === 'object' &&
                        Object.keys(requirementResult).includes('error') &&
                        Object.keys(requirementResult).length === 1) {
                        return false;
                    }
                }
                return true;
            });
            const authorized = requirementsSatisfied.some((securityResult) => securityResult === true);
            context.security = {
                authorized,
                ...securityHandlerResults,
            };
            if (!authorized && securityRequirements.length > 0) {
                const unauthorizedHandler = this.handlers['unauthorizedHandler'];
                if (unauthorizedHandler) {
                    return unauthorizedHandler(context, ...handlerArgs);
                }
            }
            const validate = typeof this.validate === 'function'
                ? this.validate(context, ...handlerArgs)
                : Boolean(this.validate);
            const validationFailHandler = this.handlers['validationFail'];
            if (validate) {
                context.validation = this.validator.validateRequest(req, context.operation);
                if (context.validation.errors) {
                    if (validationFailHandler) {
                        return validationFailHandler(context, ...handlerArgs);
                    }
                }
            }
            const routeHandler = this.handlers[operationId];
            if (!routeHandler) {
                const notImplementedHandler = this.handlers['501'] || this.handlers['notImplemented'];
                if (!notImplementedHandler) {
                    throw Error(`501-notImplemented: ${operationId} no handler registered`);
                }
                return notImplementedHandler(context, ...handlerArgs);
            }
            return routeHandler(context, ...handlerArgs);
        }).bind(this)();
        const postResponseHandler = this.handlers['postResponseHandler'];
        if (postResponseHandler) {
            context.response = response;
            return postResponseHandler(context, ...handlerArgs);
        }
        return response;
    }
    registerHandler(operationId, handler) {
        if (typeof handler !== 'function') {
            throw new Error('Handler should be a function');
        }
        if (this.initalized) {
            const operation = this.router.getOperation(operationId);
            if (!operation && !_.includes(this.allowedHandlers, operationId)) {
                const err = `Unknown operationId ${operationId}`;
                if (this.strict) {
                    throw new Error(`${err}. Refusing to register handler`);
                }
                else {
                    console.warn(err);
                }
            }
        }
        this.handlers[operationId] = handler;
    }
    register(...args) {
        if (typeof args[0] === 'string') {
            const operationId = args[0];
            const handler = args[1];
            this.registerHandler(operationId, handler);
        }
        else {
            const handlers = args[0];
            for (const operationId in handlers) {
                if (handlers[operationId]) {
                    this.registerHandler(operationId, handlers[operationId]);
                }
            }
        }
    }
    registerSecurityHandler(name, handler) {
        var _a;
        if (typeof handler !== 'function') {
            throw new Error('Security handler should be a function');
        }
        if (this.initalized) {
            const securitySchemes = ((_a = this.definition.components) === null || _a === void 0 ? void 0 : _a.securitySchemes) || {};
            if (!securitySchemes[name]) {
                const err = `Unknown security scheme ${name}`;
                if (this.strict) {
                    throw new Error(`${err}. Refusing to register security handler`);
                }
                else {
                    console.warn(err);
                }
            }
        }
        this.securityHandlers[name] = handler;
    }
    mockResponseForOperation(operationId, opts = {}) {
        let status = 200;
        const defaultMock = {};
        const operation = this.router.getOperation(operationId);
        if (!operation || !operation.responses) {
            return { status, mock: defaultMock };
        }
        const { responses } = operation;
        let response;
        if (opts.code && responses[opts.code]) {
            status = Number(opts.code);
            response = responses[opts.code];
        }
        else {
            const res = utils_1.default.findDefaultStatusCodeMatch(responses);
            status = res.status;
            response = res.res;
        }
        if (!response || !response.content) {
            return { status, mock: defaultMock };
        }
        const { content } = response;
        const mediaType = opts.mediaType || 'application/json';
        const mediaResponse = content[mediaType] || content[Object.keys(content)[0]];
        if (!mediaResponse) {
            return { status, mock: defaultMock };
        }
        const { examples, schema } = mediaResponse;
        if (opts.example && examples) {
            const exampleObject = examples[opts.example];
            if (exampleObject && exampleObject.value) {
                return { status, mock: exampleObject.value };
            }
        }
        if (mediaResponse.example) {
            return { status, mock: mediaResponse.example };
        }
        if (examples) {
            const exampleObject = examples[Object.keys(examples)[0]];
            return { status, mock: exampleObject.value };
        }
        if (schema) {
            return { status, mock: (0, mock_json_schema_1.mock)(schema) };
        }
        return { status, mock: defaultMock };
    }
    validateDefinition() {
        const validateOpenAPI = new openapi_schema_validator_1.default({ version: 3 });
        const { errors } = validateOpenAPI.validate(this.document);
        if (errors.length) {
            const prettyErrors = JSON.stringify(errors, null, 2);
            throw new Error(`Document is not valid OpenAPI. ${errors.length} validation errors:\n${prettyErrors}`);
        }
        return this.document;
    }
    getOperations() {
        return this.router.getOperations();
    }
    getOperation(operationId) {
        return this.router.getOperation(operationId);
    }
    matchOperation(req) {
        return this.router.matchOperation(req);
    }
    validateRequest(req, operation) {
        return this.validator.validateRequest(req, operation);
    }
    validateResponse(res, operation, statusCode) {
        return this.validator.validateResponse(res, operation, statusCode);
    }
    validateResponseHeaders(headers, operation, opts) {
        return this.validator.validateResponseHeaders(headers, operation, opts);
    }
}
exports.OpenAPIBackend = OpenAPIBackend;
//# sourceMappingURL=backend.js.map