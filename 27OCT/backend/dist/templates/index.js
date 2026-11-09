"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = registerTemplateRoutes;
const templateRoutes_1 = __importDefault(require("./templateRoutes"));
const templateWorkflow_1 = __importDefault(require("./templateWorkflow"));
function registerTemplateRoutes(deps) {
    (0, templateRoutes_1.default)(deps);
    (0, templateWorkflow_1.default)(deps);
}
;
