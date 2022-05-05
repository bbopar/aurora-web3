"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var abi_coder_1 = __importDefault(require("abi-coder"));
var Abi = /** @class */ (function () {
    function Abi() {
    }
    Object.defineProperty(Abi, "encode", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (name, jsonInputs, params) {
            var abi = [
                {
                    type: 'function',
                    name: name,
                    inputs: jsonInputs,
                },
            ];
            var coder = new abi_coder_1.default(abi);
            return coder.encodeFunction(name, params);
        }
    });
    Object.defineProperty(Abi, "encodeConstructor", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (jsonInputs, params) {
            var abi = [
                {
                    type: 'constructor',
                    inputs: jsonInputs,
                },
            ];
            var coder = new abi_coder_1.default(abi);
            return coder.encodeConstructor(params);
        }
    });
    Object.defineProperty(Abi, "decode", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: function (name, jsonOutputs, data) {
            var abi = [
                {
                    type: 'function',
                    name: name,
                    outputs: jsonOutputs,
                },
            ];
            var coder = new abi_coder_1.default(abi);
            var output = coder.decodeFunctionOutput(name, data);
            return output.values;
        }
    });
    return Abi;
}());
exports.default = Abi;
//# sourceMappingURL=abi.js.map