/**
 * Module dependencies.
 */

const axios = require('axios');
const config = require('config');
const ethcall = require('ethcall');
const ethers = require('ethers');

/**
 * Constants.
 */

const BRL_CHEF_ABI = config.get('ABI.BRL_CHEF_ABI');
const UNI_ABI = config.get('ABI.UNI_ABI');
const ERC20_ABI = config.get('ABI.ERC20_ABI');
const BRL_CHEF_ADDR = config.get('AURORA.BRL_CHEF_ADDR');
const REWARD_TOKEN_TICKER = config.get('AURORA.REWARD_TOKEN_TICKER');

/**
 * Export methods.
 */

module.exports = {
	/**
	 * Method `getAuroraAPR`
	 */

	async getAuroraAPR(App, selectedPools) {
		const BRL_CHEF = new ethers.Contract(BRL_CHEF_ADDR, BRL_CHEF_ABI, App.provider);
		const blockNumber = await App.provider.getBlockNumber();
		const multiplier = await BRL_CHEF.getMultiplier(blockNumber, blockNumber + 1);
		const rewardsPerWeek = await BRL_CHEF.BRLPerBlock() / 1e18 * multiplier * 604800 / 1.1;
		const chef = await loadAuroraChefContract(
			App,
			{},
			await getAuroraPrices(),
			BRL_CHEF,
			BRL_CHEF_ADDR,
			BRL_CHEF_ABI,
			REWARD_TOKEN_TICKER,
			"BRL",
			null,
			rewardsPerWeek,
			"pendingBRL",
			selectedPools
		);
 
		return {
			chefAdd: BRL_CHEF_ADDR,
			blockNumber: parseInt(blockNumber),
			...chef
		};
	}
}

/**
 * Fn `loadAuroraChefContract`. 
 */

async function loadAuroraChefContract(
	App,
	tokens,
	prices,
	chef,
	chefAddress,
	chefAbi,
	rewardTokenTicker,
	rewardTokenFunction,
	rewardsPerBlockFunction,
	rewardsPerWeekFixed,
	pendingRewardsFunction,
	selectedPools)
{
	const chefContract = new ethers.Contract(chefAddress, chefAbi, App.provider);
	const poolCount = parseInt(await chefContract.poolLength(), 10);
	const totalAllocPoints = await chefContract.totalAllocPoint();
	const rewardTokenAddress = await chefContract.callStatic[rewardTokenFunction]();
	const rewardToken = await getAuroraToken(App, rewardTokenAddress, chefAddress);
	const rewardsPerWeek = rewardsPerWeekFixed
		? rewardsPerWeekFixed
		: await chefContract.callStatic[rewardsPerBlockFunction]() / 10 ** rewardToken.decimals * 604800 / 3

	const poolInfos = await Promise.all([...Array(poolCount).keys()]
		.filter(x => selectedPools.indexOf(x.toString()) >= 0)
		.map(async (x) => await getAuroraPoolInfo(App, chefContract, chefAddress, x, pendingRewardsFunction)));

	var tokenAddresses = [].concat.apply([], poolInfos.filter(x => x.poolToken).map(x => x.poolToken.tokens));

	await Promise.all(tokenAddresses.map(async (address) => {
			tokens[address] = await getAuroraToken(App, address, chefAddress);
	}));

	const poolPrices = poolInfos.map(poolInfo => poolInfo.poolToken ? getUniPrices(tokens, prices, poolInfo.poolToken, "aurora") : undefined);

	const pools = [];
	for (let i = 0; i < poolCount; i++) {
		if (poolPrices[i]) {
			const apr = fetchChefPool(chefAbi, chefAddress, prices, tokens, poolInfos[i], i, poolPrices[i],
				totalAllocPoints, rewardsPerWeek, rewardTokenTicker, rewardTokenAddress,
				pendingRewardsFunction, null, null, "aurora", poolInfos[i].depositFee, poolInfos[i].withdrawFee);

			const { t0, t1, price, tvl, staked_tvl, stakeTokenTicker } = poolPrices[i];
			const token0 = { symbol: t0.symbol, name: t0.name };
			const token1 = { symbol: t1.symbol, name: t1.name };
			pools.push({
				token0,
				token1,
				tvl: {
					pooled: tvl,
					staked: staked_tvl
				},
				stakingToken: stakeTokenTicker,
				...apr
			});
		}
	}

	return pools[0];
}

/**
 * Fn `getAuroraPoolInfo`
 */

async function getAuroraPoolInfo(app, chefContract, chefAddress, poolIndex, pendingRewardsFunction) {
	const poolInfo = await chefContract.poolInfo(poolIndex);
	if (poolInfo.allocPoint == 0) {
		return {
			address: poolInfo.lpToken,
			allocPoints: poolInfo.allocPoint ? poolInfo.allocPoint : 1,
			poolToken: null,
			userStaked : 0,
			pendingRewardTokens : 0,
		};
	}
	const selectedToken = poolInfo.lpToken ? poolInfo.lpToken : (poolInfo.token ? poolInfo.token : poolInfo.stakingToken);
	const poolToken = await getAuroraToken(app, selectedToken, chefAddress);
	const userInfo = await chefContract.userInfo(poolIndex, app.YOUR_ADDRESS);
	const pendingRewardTokens = await chefContract.callStatic[pendingRewardsFunction](poolIndex, app.YOUR_ADDRESS);
	const staked = userInfo.amount / 10 ** poolToken.decimals;
	return {
			address : selectedToken,
			allocPoints: poolInfo.allocPoint ? poolInfo.allocPoint : 1,
			poolToken: poolToken,
			userStaked : staked,
			pendingRewardTokens : pendingRewardTokens / 10 ** 18,
			depositFee : (poolInfo.depositFeeBP ? poolInfo.depositFeeBP : 0) / 100,
			withdrawFee : (poolInfo.withdrawFeeBP ? poolInfo.withdrawFeeBP : 0) / 100
	};
}

/**
 * Fn `getAuroraPrices`
 */

async function getAuroraPrices() {
	const auroraTokens = config.get('AURORA.TOKENS');

	const idPrices = await lookUpPrices(auroraTokens);
	const prices = {}
	for (const bt of auroraTokens)
			if (idPrices[bt.id])
					prices[bt.contract] = idPrices[bt.id];
	return prices;
}

/**
 * Fn `getAuroraToken`
 */

 async function getAuroraToken(App, tokenAddress, stakingAddress) {
	if (tokenAddress == "0x0000000000000000000000000000000000000000") {
		return getAuroraErc20(App, null, tokenAddress, "")
	}

	try {
		const pool = new ethcall.Contract(tokenAddress, UNI_ABI);
		const _token0 = await App.ethcallProvider.all([pool.token0()]);
		const uniPool = await getAuroraUniPool(App, pool, tokenAddress, stakingAddress);
		return uniPool;
	} catch(err){}

	try {
		const erc20 = new ethcall.Contract(tokenAddress, ERC20_ABI);
		const _name = await App.ethcallProvider.all([erc20.name()]);
		const erc20tok = await getAuroraErc20(App, erc20, tokenAddress, stakingAddress);
		return erc20tok;
	} catch(err) {
		console.log(err);
		console.log(`Couldn't match ${tokenAddress} to any known token type.`);
	}
}

/**
 * Fn `getAuroraUniPool`
 */

async function getAuroraUniPool(App, pool, poolAddress, stakingAddress) {
	const calls = [
		pool.decimals(), pool.token0(), pool.token1(), pool.symbol(), pool.name(),
		pool.totalSupply(), pool.balanceOf(stakingAddress), pool.balanceOf(App.YOUR_ADDRESS)
	];

	const [decimals, token0, token1, symbol, name, totalSupply, staked, unstaked]
		= await App.ethcallProvider.all(calls);

	let q0, q1, is1inch;

	try {
		const [reserves] = await App.ethcallProvider.all([pool.getReserves()]);
		q0 = reserves._reserve0;
		q1 = reserves._reserve1;
		is1inch = false;
	} catch(error) { //for 1inch
		if (token0 == "0x0000000000000000000000000000000000000000") {
			q0 = await App.provider.getBalance(poolAddress);
		}
		else {
			const c0 = new ethers.Contract(token0, ERC20_ABI, App.provider);
			q0 = await c0.balanceOf(poolAddress);
		}
		if (token1 == "0x0000000000000000000000000000000000000000") {
			q1 = await App.provider.getBalance(poolAddress);
		}
		else {
			const c1 = new ethers.Contract(token1, ERC20_ABI, App.provider);
			q1 = await c1.balanceOf(poolAddress);
		}
		is1inch = true;
	}

	return {
			symbol,
			name,
			address: poolAddress,
			token0: token0,
			q0,
			token1: token1,
			q1,
			totalSupply: totalSupply / 10 ** decimals,
			stakingAddress: stakingAddress,
			staked: staked / 10 ** decimals,
			decimals: decimals,
			unstaked: unstaked / 10 ** decimals,
			contract: pool,
			tokens : [token0, token1],
			is1inch
	};
}

/**
 * Get aurora ERC20
 */

async function getAuroraErc20(App, token, address, stakingAddress) {
	if (address == "0x0000000000000000000000000000000000000000") {
		return {
			address,
			name : "Aurora",
			symbol : "AOA",
			totalSupply: 1e8,
			decimals: 18,
			staked: 0,
			unstaked: 0,
			contract: null,
			tokens:[address]
		}
	}
	const calls = [token.decimals(), token.balanceOf(stakingAddress), token.balanceOf(App.YOUR_ADDRESS),
		token.name(), token.symbol(), token.totalSupply()];
	const [decimals, staked, unstaked, name, symbol, totalSupply] = await App.ethcallProvider.all(calls);
	return {
			address,
			name,
			symbol,
			totalSupply,
			decimals : decimals,
			staked:  staked / 10 ** decimals,
			unstaked: unstaked  / 10 ** decimals,
			contract: token,
			tokens : [address]
	};
}

/**
 * Fn `getUniPrices`
 */

function getUniPrices(tokens, prices, pool, chain="eth") {
  var t0 = getParameterCaseInsensitive(tokens,pool.token0);
  var p0 = getParameterCaseInsensitive(prices,pool.token0).usd ? getParameterCaseInsensitive(prices,pool.token0).usd : getParameterCaseInsensitive(prices,pool.token0);
  var t1 = getParameterCaseInsensitive(tokens,pool.token1);
  var p1 = getParameterCaseInsensitive(prices,pool.token1).usd ? getParameterCaseInsensitive(prices,pool.token1).usd : getParameterCaseInsensitive(prices,pool.token1);
  if (p0 == null && p1 == null) {
    console.log(`Missing prices for tokens ${pool.token0} and ${pool.token1}.`);
    return undefined;
  }
  if (t0 == null || t0.decimals == null) {
    console.log(`Missing information for token ${pool.token0}.`);
    return undefined;
  }
  if (t1 == null || t1.decimals == null) {
    console.log(`Missing information for token ${pool.token1}.`);
    return undefined;
  }
  var q0 = pool.q0 / 10 ** t0.decimals;
  var q1 = pool.q1 / 10 ** t1.decimals;
  if (p0 == null)
  {
      p0 = q1 * p1 / q0;
      prices[pool.token0] = { usd : p0 };
  }
  if (p1 == null)
  {
      p1 = q0 * p0 / q1;
      prices[pool.token1] = { usd : p1 };
  }
  var tvl = q0 * p0 + q1 * p1;
  var price = tvl / pool.totalSupply;
  prices[pool.address] = { usd : price };
  var staked_tvl = pool.staked * price;

  let stakeTokenTicker = `[${t0.symbol}]-[${t1.symbol}]`;

  stakeTokenTicker += " Uni LP";

  return {
      t0: t0,
      p0: p0,
      q0  : q0,
      t1: t1,
      p1: p1,
      q1  : q1,
      price: price,
      tvl : tvl,
      staked_tvl : staked_tvl,
      stakeTokenTicker : stakeTokenTicker
  }
}

/**
 * Fn `getParameterCaseInsensitive`.
 */

function getParameterCaseInsensitive(object, key) {
  return object[Object.keys(object)
    .find(k => k.toLowerCase() === key.toLowerCase())
  ];
}

/**
 * Fn `fetchChefPool`.
 */

function fetchChefPool(chefAbi, chefAddr, prices, tokens, poolInfo, poolIndex, poolPrices,
	totalAllocPoints, rewardsPerWeek, rewardTokenTicker, rewardTokenAddress,
	pendingRewardsFunction, fixedDecimals, claimFunction, chain="eth", depositFee=0, withdrawFee=0) {
		fixedDecimals = fixedDecimals ? fixedDecimals : 2;
		const sp = (poolInfo.stakedToken == null) ? null : getUniPrices(tokens, prices, poolInfo.stakedToken, chain);
		var poolRewardsPerWeek = poolInfo.allocPoints / totalAllocPoints * rewardsPerWeek;
		if (poolRewardsPerWeek == 0 && rewardsPerWeek != 0) return;
		const userStaked = poolInfo.userLPStaked ? poolInfo.userLPStaked : poolInfo.userStaked;
		const rewardPrice = getParameterCaseInsensitive(prices, rewardTokenAddress) ? getParameterCaseInsensitive(prices, rewardTokenAddress).usd : null;
		const staked_tvl = sp && sp.staked_tvl ? sp.staked_tvl : poolPrices.staked_tvl;

		const apr = calculateAPRs(rewardTokenTicker, rewardPrice, poolRewardsPerWeek, poolPrices.stakeTokenTicker,
		staked_tvl, userStaked, poolPrices.price, fixedDecimals);

		return apr;
}

/**
 * Fn `lookUpPrices`
 */

async function lookUpPrices(tokens) {
  const id_array = tokens.map(x => x.id);
  const prices = {}
  for (const id_chunk of chunk(id_array, 50)) {
    let ids = id_chunk.join('%2C')

    try {
      const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      for (const [key, v] of Object.entries(response.data)) {
        if (v.usd) prices[key] =  { ...v, symbol: tokens.find(token => token.id === key).symbol };
      }
    } catch (err) {
      console.log('Could not fetch prices from coingecko', err);

      throw err;
    }
  }

  return prices
}

/**
 * Fn `chunk`.
 */

function chunk(arr, n) {
	return arr.length ? [arr.slice(0, n), ...chunk(arr.slice(n), n)] : []
}


/**
 * Fn `calculateAPRs`. 
 */

function calculateAPRs(
  rewardTokenTicker,
  rewardPrice,
  poolRewardsPerWeek,
  stakeTokenTicker,
  staked_tvl,
  userStaked,
  poolTokenPrice,
  fixedDecimals
) {
  fixedDecimals = fixedDecimals ? fixedDecimals : 2;
  const usdPerWeek = poolRewardsPerWeek * rewardPrice;
  const weeklyAPR = usdPerWeek / staked_tvl * 100;
  const dailyAPR = weeklyAPR / 7;
  const yearlyAPR = weeklyAPR * 52;

  return {
    usdPerWeek,
    rewardTokenTicker,
    poolRewardsPerWeek,
    dailyAPR: Math.floor(dailyAPR * 1000000) / 100000000,
    weeklyAPR: Math.floor(weeklyAPR * 1000000) / 100000000,
    yearlyAPR: Math.floor(yearlyAPR * 1000000) / 100000000
  }
}
