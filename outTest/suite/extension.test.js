"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('Should start extension', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const started = ((_a = vscode.extensions.getExtension('@totvs/tds-vscode')) === null || _a === void 0 ? void 0 : _a.isActive) || false;
        assert.strictEqual(started, false, "Extensão TDS-VSCode não ativada.");
    }));
});
//# sourceMappingURL=extension.test.js.map