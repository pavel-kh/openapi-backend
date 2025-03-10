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
/**
 * Class that handles routing
 *
 * @export
 * @class OpenAPIRouter
 */
class OpenAPIRouter {
    /**
     * Creates an instance of OpenAPIRouter
     *
     * @param opts - constructor options
     * @param {D} opts.definition - the OpenAPI definition, file path or Document object
     * @param {string} opts.apiRoot - the root URI of the api. all paths are matched relative to apiRoot
     * @memberof OpenAPIRouter
     */
    constructor(opts) {
        var _a;
        this.definition = opts.definition;
        this.apiRoot = opts.apiRoot || '/';
        this.ignoreTrailingSlashes = (_a = opts.ignoreTrailingSlashes) !== null && _a !== void 0 ? _a : true;
    }
    matchOperation(req, strict) {
        // normalize request for matching
        req = this.normalizeRequest(req);
        // if request doesn't match apiRoot, throw 404
        if (!req.path.startsWith(this.apiRoot)) {
            if (strict) {
                throw Error('404-notFound: no route matches request');
            }
            else {
                return undefined;
            }
        }
        // get relative path
        const normalizedPath = this.normalizePath(req.path);
        // get all operations matching exact path
        const exactPathMatches = this.getOperations().filter(({ path }) => path === normalizedPath);
        // check if there's one with correct method and return if found
        const exactMatch = exactPathMatches.find(({ method }) => method === req.method);
        if (exactMatch) {
            return exactMatch;
        }
        // check with path templates
        const templatePathMatches = this.getOperations().filter(({ path }) => {
            // convert openapi path template to a regex pattern i.e. /{id}/ becomes /[^/]+/
            const pathPattern = `^${path.replace(/\{.*?\}/g, '[^/]+')}$`;
            return Boolean(normalizedPath.match(new RegExp(pathPattern, 'g')));
        });
        // if no operations match the path, throw 404
        if (!templatePathMatches.length) {
            if (strict) {
                throw Error('404-notFound: no route matches request');
            }
            else {
                return undefined;
            }
        }
        // find matching operation
        const match = _.chain(templatePathMatches)
            // order matches by length (specificity)
            .orderBy((op) => op.path.replace(RegExp(/\{.*?\}/g), '').length, 'desc')
            // then check if one of the matched operations matches the method
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
    /**
     * Flattens operations into a simple array of Operation objects easy to work with
     *
     * @returns {Operation<D>[]}
     * @memberof OpenAPIRouter
     */
    getOperations() {
        var _a;
        const paths = ((_a = this.definition) === null || _a === void 0 ? void 0 : _a.paths) || {};
        return _.chain(paths)
            .entries()
            .flatMap(([path, pathBaseObject]) => {
            const methods = _.pick(pathBaseObject, ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
            return _.entries(methods).map(([method, operation]) => {
                const op = operation;
                return {
                    ...op,
                    path,
                    method,
                    // append the path base object's parameters to the operation's parameters
                    parameters: [
                        ...(op.parameters ||
                            []),
                        ...((pathBaseObject === null || pathBaseObject === void 0 ? void 0 : pathBaseObject.parameters) || []), // path base object parameters
                    ],
                    // operation-specific security requirement override global requirements
                    security: op.security || this.definition.security || [],
                };
            });
        })
            .value();
    }
    /**
     * Gets a single operation based on operationId
     *
     * @param {string} operationId
     * @returns {Operation<D>}
     * @memberof OpenAPIRouter
     */
    getOperation(operationId) {
        return this.getOperations().find((op) => op.operationId === operationId);
    }
    /**
     * Normalises request:
     * - http method to lowercase
     * - remove path leading slash
     * - remove path query string
     *
     * @export
     * @param {Request} req
     * @returns {Request}
     */
    normalizeRequest(req) {
        var _a;
        let path = ((_a = req.path) === null || _a === void 0 ? void 0 : _a.trim()) || '';
        // add leading prefix to path
        if (!path.startsWith('/')) {
            path = `/${path}`;
        }
        // remove query string from path
        path = path.split('?')[0];
        // normalize method to lowercase
        const method = req.method.trim().toLowerCase();
        return { ...req, path, method };
    }
    /**
     * Normalises path for matching: strips apiRoot prefix from the path
     *
     * Also depending on configuration, will remove trailing slashes
     *
     * @export
     * @param {string} path
     * @returns {string}
     */
    normalizePath(pathInput) {
        let path = pathInput.trim();
        // strip apiRoot from path
        if (path.startsWith(this.apiRoot)) {
            path = path.replace(new RegExp(`^${this.apiRoot}/?`), '/');
        }
        while (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        return path;
    }
    /**
     * Parses and normalizes a request
     * - parse json body
     * - parse query string
     * - parse cookies from headers
     * - parse path params based on uri template
     *
     * @export
     * @param {Request} req
     * @param {Operation<D>} [operation]
     * @param {string} [patbh]
     * @returns {ParsedRequest}
     */
    parseRequest(req, operation) {
        var _a;
        let requestBody = req.body;
        if (req.body && typeof req.body !== 'object') {
            try {
                // attempt to parse json
                requestBody = JSON.parse(req.body.toString());
            }
            catch {
                // suppress json parsing errors
                // we will emit error if validation requires it later
            }
        }
        // header keys are converted to lowercase, so Content-Type becomes content-type
        const headers = _.mapKeys(req.headers, (val, header) => header.toLowerCase());
        // parse cookie from headers
        const cookieHeader = headers['cookie'];
        const cookies = cookie.parse(_.flatten([cookieHeader]).join('; '));
        // parse query
        const queryString = typeof req.query === 'string' ? req.query.replace('?', '') : req.path.split('?')[1];
        const query = typeof req.query === 'object' ? _.cloneDeep(req.query) : (0, qs_1.parse)(queryString);
        // normalize
        req = this.normalizeRequest(req);
        let params = {};
        if (operation) {
            // get relative path
            const normalizedPath = this.normalizePath(req.path);
            // parse path params if path is given
            const pathParams = (0, bath_es5_1.default)(operation.path);
            params = pathParams.params(normalizedPath) || {};
            // parse query parameters with specified style for parameter
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
                            // use comma parsing e.g. &a=1,2,3
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