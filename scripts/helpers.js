async function deployContract(name, args) {
  const contractFactory = await ethers.getContractFactory(name);
  const contract = await contractFactory.deploy(...args);
  console.log(`Deploying ${name} to ${contract.address}...`)
  await contract.deployTransaction.wait()
  console.log("... Completed!")
  return contract
}

async function contractAt(name, address) {
  const contractFactory = await ethers.getContractFactory(name);
  return await contractFactory.attach(address);
}

module.exports = { deployContract, contractAt }
