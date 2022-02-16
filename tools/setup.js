const { Keypair, Networks, Transaction, TransactionBuilder, Operation, Server } = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'
const server = new Server(HORIZON_URL);

console.log("a");
(async () => {
    console.log("b")
    const masterAccount = await server.loadAccount("GCAZFDBB5QZJOT36ESNEKFBU7B5C3ZDU7SB2HWKUFGGVUHHUYZZ64ZGR");
    console.log(masterAccount)
})();
