const { expandDecimals } = require("../test/shared/utilities")
const { sendTxn, deployContract, contractAt } = require("./helpers")

async function createPair(factory, token0, token1, label) {
  await sendTxn(factory.createPair(token0.address, token1.address), label)

  const pairAddress = await factory.getPair(token0.address, token1.address)
  const pair = await contractAt("UniswapV2Pair", pairAddress)
  console.info("Deployed pair to " + pair.address)
  return pair
}

async function main() {
  const provider = waffle.provider
  const accounts = await provider.listAccounts()
  const fund = { address: accounts[0] }
  const now = parseInt(Date.now() / 1000)
  const govHandoverTime = now + 7 * 24 * 60 * 60
  const lgeEndTime = now + 24 * 60 * 60
  const lpUnlockTime = now + 2 * 24 * 60 * 60
  const initialSupply = expandDecimals(100000, 18)
  const maxSupply = expandDecimals(200000, 18)
  const xvix = await deployContract("XVIX", [initialSupply, maxSupply, govHandoverTime])
  const weth = await contractAt("WETH", "0xc778417e063141139fce010982780140aa0cd5ab")
  const dai = await contractAt("DAI", "0xad6d458402f60fd3bd25163575031acdce07538d")

  const pairs = { xvix: {}, weth: {} }

  const factory = await contractAt("UniswapV2Factory", "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f")
  const router = await contractAt("UniswapV2Router", "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D")

  pairs.xvix.weth = await createPair(factory, xvix, weth, "createPair(xvix, weth)")
  pairs.xvix.dai = await createPair(factory, xvix, dai, "createPair(xvix, dai)")

  const distributor = await deployContract("Distributor", [])
  const floor = await deployContract("Floor", [xvix.address])
  const minter = await deployContract("Minter", [xvix.address, floor.address, distributor.address])

  const lgeTokenWETH = await deployContract("LGEToken", ["XLGE WETH LP", "XLGE:WETH", distributor.address, weth.address])
  const lgeTokenDAI = await deployContract("LGEToken", ["XLGE DAI LP", "XLGE:DAI", distributor.address, dai.address])

  await sendTxn(distributor.initialize([
    xvix.address,
    weth.address,
    dai.address,
    lgeTokenWETH.address,
    lgeTokenDAI.address,
    floor.address,
    minter.address,
    router.address,
    factory.address],
    lgeEndTime,
    lpUnlockTime
  ), "distributor.initialize")

  await sendTxn(xvix.setMinter(minter.address), "setMinter")
  await sendTxn(xvix.setFloor(floor.address), "setFloor")
  await sendTxn(xvix.setDistributor(distributor.address), "setDistributor")
  await sendTxn(xvix.setFund(fund.address), "setFund")

  await sendTxn(xvix.createSafe(distributor.address), "createSafe(distributor)")
  await sendTxn(xvix.createSafe(pairs.xvix.weth.address), "createSafe(xvix/weth pair)")
  await sendTxn(xvix.createSafe(pairs.xvix.dai.address), "createSafe(xvix/dai pair)")

  await sendTxn(xvix.transfer(distributor.address, initialSupply), "xvix.transfer(distributor, initialSupply)");

  const reader = await deployContract("Reader", [factory.address, xvix.address, dai.address,
    lgeTokenWETH.address, distributor.address, floor.address])

  return { xvix, weth, dai, router, factory, pairs, floor, minter, distributor, fund, reader }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
