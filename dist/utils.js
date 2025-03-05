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
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("lodash"));
class OpenAPIUtils {
    static findStatusCodeMatch(statusCode, obj) {
        let value = obj[statusCode];
        if (value !== undefined) {
            return value;
        }
        const strStatusCode = Math.floor(statusCode / 100) + 'XX';
        value = obj[strStatusCode];
        if (value !== undefined) {
            return value;
        }
        return obj['default'];
    }
    static findDefaultStatusCodeMatch(obj) {
        for (const ok of _.range(200, 204)) {
            if (obj[ok]) {
                return {
                    status: ok,
                    res: obj[ok],
                };
            }
        }
        if (obj['2XX']) {
            return {
                status: 200,
                res: obj['2XX'],
            };
        }
        if (obj.default) {
            return {
                status: 200,
                res: obj.default,
            };
        }
        const code = Object.keys(obj)[0];
        return {
            status: Number(code),
            res: obj[code],
        };
    }
    static getOperationId(operation) {
        if (!(operation === null || operation === void 0 ? void 0 : operation.operationId)) {
            return `unknown`;
        }
        return operation.operationId;
    }
}
exports.default = OpenAPIUtils;
//# sourceMappingURL=utils.js.map