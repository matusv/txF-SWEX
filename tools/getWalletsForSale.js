const { Keypair, Networks, Transaction, TransactionBuilder, Operation, Server } = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

const server = new Server(HORIZON_URL);

const masterPK = "GCAZFDBB5QZJOT36ESNEKFBU7B5C3ZDU7SB2HWKUFGGVUHHUYZZ64ZGR";
const signerPK = "GCAAWX5AURYAANBIX2UFNKHFY5YEZOD7KCYBM2TYQ2YTLAJR7ZRNQSQN";
const limitPerPage = 10;

(async () => {
    let page = await server.accounts().forSigner(signerPK).limit(limitPerPage).call();

    while (page.records.length > 0){
        console.log("page length:", page.records.length)
        //if (page.records.length < 10)
        for (account of page.records) {
            if (account.id == masterPK)
                continue;
            const price = decodeManageDataString(account.data_attr.price);
            const tag = decodeManageDataString(account.data_attr.tag);
            const sellerPK = decodeManageDataString(account.data_attr.sellerPK);
            console.log(`${account.id}, price: ${price}, tag: ${tag}, sellerPK: ${sellerPK}`);
        }

        page = await page.next();
    }
})();

function decodeManageDataString(str) {
    return new Buffer.from(str, 'base64').toString("utf-8")
}
