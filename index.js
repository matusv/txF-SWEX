const { NodeVM } = require('vm2');
const fs = require('fs');
const { Keypair, Networks, Transaction, TransactionBuilder, Operation, Server } = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'
const server = new Server(HORIZON_URL);

const feeKeypair = Keypair.fromSecret("SDPDWG763YQJ47M4Q4WJVNP4225E3PVCCY5QMSATPEMKPGOU6JPJR2AQ");
const masterKeypair = Keypair.fromSecret("SDIN23LBBNKQPM6CXCMVE7QMRSJJPZPCGIXOVZWPS5NTQWRMD6OBMS54");
const signerKeypair = Keypair.fromSecret("SCAI6FIQ6RUGEMWGH4AYKQSBOTNVAYTDBY74HHQBRO37QUEXWZ6PO2DG");

const sellerKeypair = Keypair.fromSecret("SAZLEK3C45UULRQRH3UT2J6P5XNUWZKV3VQ3W2ASGVAFJRLNAH4CJWML");
const buyerKeypair = Keypair.fromSecret("SBOYOBF2SJFY75KEDGI5HFTS7FOG63Z3AJETJLYUICCTAZA4AQKA2ZZU");

let keypairToSell;

console.log("master")
console.log("public:", masterKeypair.publicKey())
console.log("secret:", masterKeypair.secret())
console.log("fee")
console.log("public:", feeKeypair.publicKey())
console.log("secret:", feeKeypair.secret());
console.log("signer")
console.log("public:", signerKeypair.publicKey())
console.log("secret:", signerKeypair.secret());
console.log("seller")
console.log("public:", sellerKeypair.publicKey())
console.log("secret:", sellerKeypair.secret());
console.log("buyer")
console.log("public:", buyerKeypair.publicKey())
console.log("secret:", buyerKeypair.secret());

// console.log("pk:", keypairToSell.publicKey())
// console.log("secret:", keypairToSell.secret())



(async () => {
    for (let i = 0; i < 1; i++) {
        keypairToSell = Keypair.random();
        await fundKeypairToSell();

        try {
            const vm = new NodeVM({
                console: 'redirect',
                eval: false,
                wasm: false,
                strict: true,
                sandbox: {
                    HORIZON_URL,
                    STELLAR_NETWORK,
                },
                require: {
                    builtin: ['util', 'stream'],
                    external: {
                        modules: ['bignumber.js', 'node-fetch', 'stellar-sdk', 'lodash']
                    },
                    context: 'host',
                }
            });

            vm.on('console.log', (data) => {
                console.log(`<txF> ${data}`);
            });

            const seed = Keypair.random().publicKey();

            const txFunctionCode = fs.readFileSync('./dist/txF-SWEX.js', 'utf8')

            let ticketTxHash = null;
            try {
                let txXdr = await runCancelOffer(vm, txFunctionCode)
                txHash = await submitXDR(txXdr);
            } catch (e) {
                console.log(e);
            }

        } catch(err) {
            console.error(err)
        }
    }
})();

async function runPlaceSellOffer(vm, txFunctionCode){
    return await vm.run(txFunctionCode, 'vm.js')({
        action: 'placeSellOffer',
        sellerPK: sellerKeypair.publicKey(),
        toSellPK: keypairToSell.publicKey(),
        price: '50',
        tag: 'tag'
    })
};

async function runBuy(vm, txFunctionCode){
    return await vm.run(txFunctionCode, 'vm.js')({
        action: 'buy',
        buyerPK: buyerKeypair.publicKey(),
        toBuyPK: "GDYLTCZXULHDSKGJDS2LUPLHTRVZ7YVXTYXX7PTSXHMSER4FCRNENFFB"
    })
};

async function runCancelOffer(vm, txFunctionCode){
    return await vm.run(txFunctionCode, 'vm.js')({
        action: 'cancelOffer',
        forSalePK: "GDYDL3DZFOX5ZA32Q6Q6S4IITNQWPJXJNRERAKOOTWWRZLU4XDFC2HCP"
    })
};

async function runSetSigners(vm, txFunctionCode){
    return await vm.run(txFunctionCode, 'vm.js')({
        action: 'setSigners',
        signers: [signerKeypair.publicKey(),]
    })
};

async function runUpdateFees(vm, txFunctionCode){
    return await vm.run(txFunctionCode, 'vm.js')({
        action: 'updateFees',
        flatFee: '10',
        percentageFee: '0.05'
    })
};

// async function runGenerateNFT(vm, txFunctionCode, ticketTxHash){
//     const nftIssuerSeed = Keypair.random().publicKey();
//
//     return await vm.run(txFunctionCode, 'vm.js')({
//         stage: 'generateNFT',
//         source: sourceKeypair.publicKey(),
//         hostIpfs: IPFS_HOST,
//         authIpfs: IPFS_AUTH,
//         ticketTxHash: ticketTxHash,
//         nftIssuerSeed: nftIssuerSeed
//     })
// };

async function submitXDR(xdr) {

    let tx = new Transaction(xdr, Networks.TESTNET);

    //tx.sign(masterKeypair);
    tx.sign(sellerKeypair);
    //tx.sign(keypairToSell);
    //tx.sign(buyerKeypair);
    tx.sign(signerKeypair);

    try {
        const txResult = await server.submitTransaction(tx);
        //console.log(JSON.stringify(txResult, null, 2));
        console.log('Success!');
        console.log('tx id:', txResult.id);

        return txResult.hash;
    } catch (e) {
        console.log('An error has occured:');
        console.log(e.response.data);
        console.log(e.response.data.extras.result_codes);
    }
}

function getFee() {
    return server
    .feeStats()
    .then((feeStats) => feeStats?.fee_charged?.max || 100000)
    .catch(() => 100000)
};

async function fundKeypairToSell(){
    const fee = await getFee();

    console.log("fee:", fee);

    const sellerAccount = await server.loadAccount(sellerKeypair.publicKey());

    let tx = new TransactionBuilder(sellerAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    tx.addOperation(Operation.createAccount({
        source: sellerKeypair.publicKey(),
        destination: keypairToSell.publicKey(),
        startingBalance: '20'
    }));

    tx = tx.setTimeout(100).build();
    tx.sign(sellerKeypair);

    try {
        const txResult = await server.submitTransaction(tx);
        //console.log(JSON.stringify(txResult, null, 2));
        console.log(`keypairToSell funded (tx id: ${txResult.id})`);
    } catch (e) {
        console.log('An error has occured:');
        console.log(e.response.data);
        //console.log(e.response.data.extras.result_codes);
    }
}
