const { Keypair, Networks, Transaction, TransactionBuilder, Operation, Server } = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'
const server = new Server(HORIZON_URL);

const masterKeypair = Keypair.fromSecret('SCL2Y2IOQHR7SRVRWOOEP7BAAX7HNCPBX4ZZIBOPRJ3N5MOMFMQJJB4U');

(async () => {

    const masterAccount = await server.loadAccount(masterKeypair.publicKey())
    const fee = await getFee()

    let tx = new TransactionBuilder(masterAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    })

    for (const signer of masterAccount.signers) {
        if (signer.key == masterKeypair.publicKey())
            continue

        tx.addOperation(Operation.setOptions({
            source: masterKeypair.publicKey(),
            signer: {
                ed25519PublicKey: signer.key,
                weight: 0
            }
        }));
    }

    tx.addOperation(Operation.manageData({
        source: masterKeypair.publicKey(),
        name: "flatFee",
        value: "10"
    }))

    tx.addOperation(Operation.manageData({
        source: masterKeypair.publicKey(),
        name: "percentageFee",
        value: "0.05"
    }))

    tx = tx.setTimeout(100).build();
    tx.sign(masterKeypair);

    try {
        const txResult = await server.submitTransaction(tx);
        //console.log(JSON.stringify(txResult, null, 2));
        console.log(`Finished: ${txResult.id})`);
    } catch (e) {
        console.log('An error has occured:');
        console.log(e.response.data);
        //console.log(e.response.data.extras.result_codes);
    }

})();

async function getFee() {
  return server
  .feeStats()
  .then((feeStats) => feeStats?.fee_charged?.max || 100000)
  .catch(() => 100000)
};
