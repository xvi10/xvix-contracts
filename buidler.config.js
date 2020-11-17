const { ROPSTEN_URL, ROPSTEN_DEPLOY_KEY } = require("./env.json")

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-solhint");
// usePlugin("buidler-gas-reporter");

// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.info(await account.getAddress());
  }
});

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
module.exports = {
  networks: {
    buidlerevm: {
    },
    ropsten: {
      url: ROPSTEN_URL,
      accounts: [ROPSTEN_DEPLOY_KEY]
    }
  },
  solc: {
    version: "0.6.12",
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
};
