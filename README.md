# XVIX

Contracts for the XVIX system. More info can be found at https://xvix.finance/.

## XVIX Contracts

- Distributor.sol: XLGE coordinator
- Floor.sol: Allows XVIX to be burnt for ETH
- LGEToken.sol: Entitles XLGE participants to distributed assets
- Minter.sol: Allows XVIX to be minted with ETH
- Reader.sol: Peripheral contract for retrieving data
- XVIX.sol: XVIX token contract

## Install Dependencies

If npx is not installed yet:
`npm install -g npx`

Install packages:
`npm i`

## Compile Contracts

`npx buidler compile`

## Run Tests

`npx buidler test`
