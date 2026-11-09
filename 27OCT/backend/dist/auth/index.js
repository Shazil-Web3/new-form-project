"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = registerAuthRoutes;
const userRoutes_1 = __importDefault(require("./userRoutes"));
const taskRoutes_1 = __importDefault(require("./taskRoutes"));
const orgRoutes_1 = __importDefault(require("./orgRoutes"));
const numberRoutes_1 = require("./numberRoutes");
function registerAuthRoutes(deps) {
    (0, userRoutes_1.default)(deps);
    (0, taskRoutes_1.default)(deps);
    (0, orgRoutes_1.default)(deps);
    (0, numberRoutes_1.registerNumberRoutes)(deps);
}
