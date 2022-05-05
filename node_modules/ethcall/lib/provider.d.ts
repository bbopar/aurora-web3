import { BaseProvider } from '@ethersproject/providers';
import { Call } from './call';
import { Multicall } from './multicall';
declare type CallType = 'BASIC' | 'TRY_ALL' | 'TRY_EACH';
export declare type BlockTag = number | 'latest' | 'pending';
export default class Provider {
    provider?: BaseProvider;
    multicall: Multicall | null;
    multicall2: Multicall | null;
    multicall3: Multicall | null;
    constructor();
    init(provider: BaseProvider): Promise<void>;
    /**
     * Makes one call to the multicall contract to retrieve eth balance of the given address.
     * @param address  Address of the account you want to look up
     */
    getEthBalance(address: string): Call;
    /**
     * Aggregates multiple calls into one call. Reverts when any of the calls fails. For
     * ignoring the success of each call, use {@link tryAll} instead.
     * @param calls  Array of Call objects containing information about each read call
     * @param block  Block number for this call
     */
    all<T>(calls: Call[], block?: BlockTag): Promise<T[]>;
    /**
     * Aggregates multiple calls into one call. If any of the calls fail, it returns a null value
     * in place of the failed call's return data.
     * @param calls  Array of Call objects containing information about each read call
     * @param block  Block number for this call
     */
    tryAll<T>(calls: Call[], block?: number): Promise<(T | null)[]>;
    /**
     * Aggregates multiple calls into one call. If any of the calls that are allowed to fail do fail,
     * it returns a null value in place of the failed call's return data.
     * @param calls    Array of Call objects containing information about each read call
     * @param canFail  Array of booleans specifying whether each call can fail
     * @param block    Block number for this call
     */
    tryEach<T>(calls: Call[], canFail: boolean[], block?: number): Promise<(T | null)[]>;
    getContract(call: CallType, block?: BlockTag): Multicall | null;
    isAvailable(multicall: Multicall | null, block?: BlockTag): boolean;
}
export {};
//# sourceMappingURL=provider.d.ts.map