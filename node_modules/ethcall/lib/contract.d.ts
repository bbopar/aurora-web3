import { JsonFragment } from '@ethersproject/abi';
import { Call } from './call';
declare class Contract {
    address: string;
    abi: JsonFragment[];
    functions: JsonFragment[];
    [key: string]: Call | any;
    constructor(address: string, abi: JsonFragment[]);
}
export default Contract;
//# sourceMappingURL=contract.d.ts.map