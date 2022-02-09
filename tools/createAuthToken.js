const { Keypair, TransactionBuilder, Server, Account, Networks, Operation } = require('stellar-sdk');

// The hashes the fee payment can apply to
// Note - this can be empty. Then, this key can be used to run any txFunction.
const txFunctionHashes = [
    'e88c5742b43236da0140b70f63df1787789d9492e1a357fbd43ef3a73698c4ab'
];

const feeAccountKeypair = Keypair.fromSecret('SCPWCKFZ6LKXMOK57FINGXRYLVYWPETI5L2FX37IYXOOWHVDLPRPPUP4');
const pk = feeAccountKeypair.publicKey();

//const testnet = new Server('https://horizon-testnet.stellar.org');
(async () => {
    try {
        // setup a fake account with a -1 seq number.
        // This ensures a zero seq number when the transaction is built (TransactionBuilder increments once).
        const tempAcct = new Account(pk, '-1');
        const fee = 0;
        const txBuilder = new TransactionBuilder(tempAcct, {fee, networkPassphrase: Networks.TESTNET});

        // add the manage data operations to specify the allowed txHashes to be run for this user
        for (const hash of txFunctionHashes) {
            txBuilder.addOperation(Operation.manageData({
                name: "txFunctionHash",
                value: hash
            }));
        }

        // set TTL on the token for 1 hour
        //const tx = txBuilder.setTimeout(24*60*60).build();
        const tx = txBuilder.setTimeout(0).build();

        // sign the TX with the source account of the Transaction. This token is now valid for this public key!
        tx.sign(feeAccountKeypair);

        // this is the XDR Token
        //const token = tx.toEnvelope().toXDR('base64')
        console.log(tx.toXDR());
    } catch (e) {
        console.error(e);
    }
})();
