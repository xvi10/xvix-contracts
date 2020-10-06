const Latte = require("../../artifacts/Latte.json")
const Pricer = require("../../artifacts/PricerMock.json")
const Shopper = require("../../artifacts/Shopper.json")
const Pool = require("../../artifacts/Pool.json")
const Cafe = require("../../artifacts/Cafe.json")

const { deployContract } = require("ethereum-waffle")

async function loadSystemFixture(wallet) {
  const latte = await deployContract(wallet, Latte, [])
  const pricer = await deployContract(wallet, Pricer, [])
  const shopper = await deployContract(wallet, Shopper, [latte.address, pricer.address])
  const pool = await deployContract(wallet, Pool, [latte.address, pricer.address])
  const cafe = await deployContract(wallet, Cafe, [latte.address, pricer.address, shopper.address, pool.address])

  await latte.setCafe(cafe.address)
  await latte.setShopper(shopper.address);
  await latte.setPricer(pricer.address);
  await latte.setPool(pool.address);

  await pool.setMarket(wallet.address);

  return { latte, pricer, shopper, pool, cafe }
}

module.exports = {
  loadSystemFixture
}
