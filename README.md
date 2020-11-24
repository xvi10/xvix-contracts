# XVIX

Contracts for the XVIX system. More info can be found at https://xvix.finance/.

## XVIX Contracts

An overview of the XVIX contracts.

### XVIX

The XVIX token contract allows addresses to be specified as "safe". Tokens in "safe" addresses do not change with time, while tokens in "regular" addresses get reduced by 0.02% every hour through rebases.

### Minter

The Minter contract allows XVIX tokens to be minted with ETH, following a bonding curve. All ETH received from this minting is sent to the Floor contract.

### Floor

The Floor contract allows XVIX tokens to be burnt for ETH.

### Distributor

At launch, all XVIX tokens are transferred to the Distributor contract. During the XLGE, for any 1 ETH sent to the Distributor contract, the ETH is split:

1. 0.25 ETH is kept within the contract
2. 0.25 ETH is swapped to DAI through Uniswap
3. 0.5 ETH is sent to the Floor contract

When the XLGE ends, the XVIX, ETH and DAI tokens are sent to the XVIX / ETH and XVIX / DAI Uniswap pairs.

XLGE participants receive XLGE LP tokens for their contribution. For every 1 ETH contributed, XLGE participants will receive 1 XLGE:WETH and 1 XLGE:DAI token.

The XLGE LP tokens are unlocked after one month.

When XLGE participants redeem their XLGE LP tokens, the following happens:

1. The participant's entitled liquidity is withdrawn from the XVIX / ETH or XVIX / DAI Uniswap pair depending on the XLGE token being redeemed
2. The quantity redeemed is compared against the quantity of ETH / DAI at the end of the XLGE
3. Depending on the amount of ETH / DAI redeemed, some XVIX tokens would be burnt using the Floor contract and the ETH received is refunded to the user. The amount of XVIX tokens to burn matches the amount required to return the XLGE participant's initial capital. The rest of the XVIX tokens are burnt and permanently removed from the supply.

## Install Dependencies

If npx is not installed yet:
`npm install -g npx`

Install packages:
`npm i`

## Compile Contracts

`npx buidler compile`

## Run Tests

`npx buidler test`
