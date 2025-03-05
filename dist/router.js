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
exports.OpenAPIRouter = void 0;
const _ = __importStar(require("lodash"));
const bath_es5_1 = __importDefault(require("bath-es5"));
const cookie = __importStar(require("cookie"));
const qs_1 = require("qs");
class OpenAPIRouter {
    constructor(opts) {
        var _a;
        this.ignoreTrailingSlashes = false;
        this.definition = opts.definition;
        this.apiRoot = opts.apiRoot || '/';
        this.ignoreTrailingSlashes = (_a = opts.ignoreTrailingSlashes) !== null && _a !== void 0 ? _a : false;
    }
    matchOperation(req, strict) {
        req = this.normalizeRequest(req);
        if (!req.path.startsWith(this.apiRoot)) {
            if (strict) {
                throw Error('404-notFound: no route matches request');
            }
            else {
                return undefined;
            }
        }
        const normalizedPath = this.normalizePath(req.path);
        const exactPathMatches = this.getOperations().filter(({ path }) => this.normalizePath(path) === normalizedPath);
        const exactMatch = exactPathMatches.find(({ method }) => method === req.method);
        if (exactMatch) {
            return exactMatch;
        }
        const templatePathMatches = this.getOperations().filter(({ path }) => {
            const normalizedOperationPath = this.normalizePath(path);
            const pathPattern = `^${normalizedOperationPath.replace(/\{.*?\}/g, '[^/]+')}$`;
            return Boolean(normalizedPath.match(new RegExp(pathPattern, 'g')));
        });
        if (!templatePathMatches.length) {
            if (strict) {
                throw Error('404-notFound: no route matches request');
            }
            else {
                return undefined;
            }
        }
        const match = _.chain(templatePathMatches)
            .orderBy((op) => this.normalizePath(op.path).replace(RegExp(/\{.*?\}/g), '').length, 'desc')
            .find(({ method }) => method === req.method)
            .value();
        if (!match) {
            if (strict) {
                throw Error('405-methodNotAllowed: this method is not registered for the route');
            }
            else {
                return undefined;
            }
        }
        return match;
    }
    getOperations() {
        var _a;
        const paths = ((_a = this.definition) === null || _a === void 0 ? void 0 : _a.paths) || {};
        return _.chain(paths)
            .entries()
            .flatMap(([path, pathBaseObject]) => {
            const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
            const methods = _.pick(pathBaseObject, ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
            return _.entries(methods).map(([method, operation]) => {
                const op = operation;
                return {
                    ...op,
                    path: normalizedPath,
                    method,
                    parameters: [
                        ...(op.parameters ||
                            []),
                        ...((pathBaseObject === null || pathBaseObject === void 0 ? void 0 : pathBaseObject.parameters) || []),
                    ],
                    security: op.security || this.definition.security || [],
                };
            });
        })
            .value();
    }
    getOperation(operationId) {
        return this.getOperations().find((op) => op.operationId === operationId);
    }
    normalizeRequest(req) {
        var _a;
        let path = ((_a = req.path) === null || _a === void 0 ? void 0 : _a.trim()) || '';
        if (!path.startsWith('/')) {
            path = `/${path}`;
        }
        path = path.split('?')[0];
        const method = req.method.trim().toLowerCase();
        return { ...req, path, method };
    }
    normalizePath(pathInput) {
        let path = pathInput;
        if (path.startsWith(this.apiRoot)) {
            path = path.slice(this.apiRoot.length);
        }
        if (!path.startsWith('/')) {
            path = `/${path}`;
        }
        if (!this.ignoreTrailingSlashes) {
            while (path.length > 1 && path.endsWith('/')) {
                path = path.slice(0, -1);
            }
        }
        return path;
    }
    parseRequest(req, operation) {
        var _a;
        let requestBody = req.body;
        if (req.body && typeof req.body !== 'object') {
            try {
                requestBody = JSON.parse(req.body.toString());
            }
            catch {
            }
        }
        const headers = _.mapKeys(req.headers, (_, header) => header.toLowerCase());
        const cookieHeader = headers['cookie'];
        const cookies = cookie.parse(_.flatten([cookieHeader]).join('; '));
        const queryString = typeof req.query === 'string' ? req.query.replace('?', '') : req.path.split('?')[1];
        const query = typeof req.query === 'object' ? _.cloneDeep(req.query) : (0, qs_1.parse)(queryString);
        req = this.normalizeRequest(req);
        let params = {};
        if (operation) {
            const normalizedPath = this.normalizePath(req.path);
            const pathParams = (0, bath_es5_1.default)(operation.path);
            params = pathParams.params(normalizedPath) || {};
            for (const queryParam in query) {
                if (query[queryParam]) {
                    const parameter = (_a = operation.parameters) === null || _a === void 0 ? void 0 : _a.find((param) => !('$ref' in param) && (param === null || param === void 0 ? void 0 : param.in) === 'query' && (param === null || param === void 0 ? void 0 : param.name) === queryParam);
                    if (parameter) {
                        if (parameter.content && parameter.content['application/json']) {
                            query[queryParam] = JSON.parse(query[queryParam]);
                        }
                        else if (parameter.explode === false && queryString) {
                            let commaQueryString = queryString.replace(/%2C/g, ',');
                            if (parameter.style === 'spaceDelimited') {
                                commaQueryString = commaQueryString.replace(/ /g, ',').replace(/%20/g, ',');
                            }
                            if (parameter.style === 'pipeDelimited') {
                                commaQueryString = commaQueryString.replace(/\|/g, ',').replace(/%7C/g, ',');
                            }
                            const commaParsed = (0, qs_1.parse)(commaQueryString, { comma: true });
                            query[queryParam] = commaParsed[queryParam];
                        }
                        else if (parameter.explode === false) {
                            let decoded = query[queryParam].replace(/%2C/g, ',');
                            if (parameter.style === 'spaceDelimited') {
                                decoded = decoded.replace(/ /g, ',').replace(/%20/g, ',');
                            }
                            if (parameter.style === 'pipeDelimited') {
                                decoded = decoded.replace(/\|/g, ',').replace(/%7C/g, ',');
                            }
                            query[queryParam] = decoded.split(',');
                        }
                    }
                }
            }
        }
        return {
            ...req,
            params,
            headers,
            query,
            cookies,
            requestBody,
        };
    }
}
exports.OpenAPIRouter = OpenAPIRouter;
//# sourceMappingURL=router.js.map