import { TransactionBuilder, Server, Networks, Operation, Asset } from 'stellar-sdk'
import BigNumber from 'bignumber.js';

const feePK = STELLAR_NETWORK === 'PUBLIC'
    ? ''
    : 'GCOEKGEWXD5CG5AWML6MJVEWND25WVUHWEPYUONSLKMUOCBYUVGBPJI2'

const masterPK = STELLAR_NETWORK === 'PUBLIC'
    ? ''
    : 'GCAZFDBB5QZJOT36ESNEKFBU7B5C3ZDU7SB2HWKUFGGVUHHUYZZ64ZGR'

const server = new Server(HORIZON_URL);

export default async (body) => {
    const { action } = body;

    console.log(`action: ${action}`);

    switch(action) {

        case 'placeSellOffer':
            return placeSellOffer(body);

        case 'buy':
            return buy(body);

        case 'cancelOffer':
            return cancelOffer(body);

        // case 'setSigners':
        //     return setSigners(body);

        case 'updateFees':
            return updateFees(body);

        default:
            throw {message: 'Invalid action.'}
    }
}

function validatePublicKey(pk, name) {
    if (pk === masterPK ||
        pk === feePK)
        throw {message: `Invalid ${name}.`}
}

async function placeSellOffer(body) {
    const { sellerPK, toSellPK, price, tag } = body

    validatePublicKey(sellerPK, "sellerPK")
    validatePublicKey(toSellPK, "toSellPK")

    const config = await getConfig();
    console.log(`config: ${JSON.stringify(config)}`);
    console.log(`sellerPK: ${sellerPK}`)
    console.log(`toSellPK: ${toSellPK}`)

    const masterAccount = await server.loadAccount(masterPK);
    const toSellAccount = await server.loadAccount(toSellPK);
    const fee = await getFee();

    let tx = new TransactionBuilder(masterAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    tx.addOperation(Operation.beginSponsoringFutureReserves({
        source: masterPK,
        sponsoredId: toSellPK
    }));

    tx.addOperation(Operation.payment({
        source: sellerPK,
        destination: feePK,
        asset: Asset.native(),
        amount: config.flatFee
    }));

    tx.addOperation(Operation.manageData({
        source: toSellPK,
        name: "tag",
        value: tag
    }));

    tx.addOperation(Operation.manageData({
        source: toSellPK,
        name: "price",
        value: price
    }));

    tx.addOperation(Operation.manageData({
        source: toSellPK,
        name: "sellerPK",
        value: sellerPK
    }));

    for (const signer of config.signers) {
        tx.addOperation(Operation.setOptions({
            source: toSellPK,
            signer: {
                ed25519PublicKey: signer,
                weight: 1
            }
        }));
    }

    for (const signer of toSellAccount.signers) {
        tx.addOperation(Operation.setOptions({
            source: toSellPK,
            signer: {
                ed25519PublicKey: signer,
                weight: 0
            }
        }));
    }

    tx.addOperation(Operation.setOptions({
        masterWeight: 0,
        lowThreshold: config.signers.length,
        medThreshold: config.signers.length,
        highThreshold: config.signers.length,
        source: toSellPK
    }));

    tx.addOperation(Operation.endSponsoringFutureReserves({
        source: toSellPK
    }));

    tx = tx.setTimeout(0).build();

    return tx.toXDR('base64');
}

async function buy(body) {
    const { buyerPK, toBuyPK } = body

    validatePublicKey(buyerPK, "buyerPK")
    validatePublicKey(toBuyPK, "toBuyPK")

    const config = await getConfig();
    const { price, sellerPK } = await getPriceAndSellerPK(toBuyPK);

    console.log(`config: ${JSON.stringify(config)}`);
    console.log(`sellerPK: ${sellerPK}`)
    console.log(`price: ${price}`)

    const _price = new BigNumber(price);
    const _percentageFee = new BigNumber(config.percentageFee);

    const priceFee = _price.multipliedBy(_percentageFee);
    const priceAfterFee = _price.minus(priceFee);

    console.log(`priceFee: ${priceFee}`)
    console.log(`priceAfterFee: ${priceAfterFee}`)

    const masterAccount = await server.loadAccount(masterPK);
    const fee = await getFee();

    let tx = new TransactionBuilder(masterAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    tx.addOperation(Operation.payment({
        source: buyerPK,
        destination: sellerPK,
        asset: Asset.native(),
        amount: priceAfterFee.toFixed(7)
    }));

    tx.addOperation(Operation.payment({
        source: buyerPK,
        destination: feePK,
        asset: Asset.native(),
        amount: priceFee.toFixed(7)
    }));

    tx.addOperation(Operation.beginSponsoringFutureReserves({
        source: buyerPK,
        sponsoredId: toBuyPK
    }));

    tx.addOperation(Operation.setOptions({
        source: toBuyPK,
        signer: {
            ed25519PublicKey: buyerPK,
            weight: 1
        },
        lowThreshold: 1,
        medThreshold: 1,
        highThreshold: 1
    }));

    for (const signer of config.signers) {
        tx.addOperation(Operation.setOptions({
            source: toBuyPK,
            signer: {
                ed25519PublicKey: signer,
                weight: 0
            }
        }));
    }

    tx.addOperation(Operation.endSponsoringFutureReserves({
        source: toBuyPK
    }));

    tx.addOperation(Operation.manageData({
        source: toBuyPK,
        name: "tag",
        value: null
    }));

    tx.addOperation(Operation.manageData({
        source: toBuyPK,
        name: "price",
        value: null
    }));

    tx.addOperation(Operation.manageData({
        source: toBuyPK,
        name: "sellerPK",
        value: null
    }));

    tx = tx.setTimeout(0).build();

    return tx.toXDR('base64');

}

async function cancelOffer(body) {
    const { forSalePK } = body

    validatePublicKey(forSalePK, "forSalePK")

    const config = await getConfig();
    const { price, sellerPK } = await getPriceAndSellerPK(forSalePK);

    console.log(`config: ${JSON.stringify(config)}`);
    console.log(`sellerPK: ${sellerPK}`)

    const masterAccount = await server.loadAccount(masterPK);
    const fee = await getFee();

    let tx = new TransactionBuilder(masterAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    tx.addOperation(Operation.payment({
        source: sellerPK,
        destination: feePK,
        asset: Asset.native(),
        amount: config.flatFee
    }));

    tx.addOperation(Operation.setOptions({
        source: forSalePK,
        masterWeight: 1,
        lowThreshold: 1,
        medThreshold: 1,
        highThreshold: 1
    }));

    for (const signer of config.signers) {
        tx.addOperation(Operation.setOptions({
            source: forSalePK,
            signer: {
                ed25519PublicKey: signer,
                weight: 0
            }
        }));
    }

    tx.addOperation(Operation.manageData({
        source: forSalePK,
        name: "tag",
        value: null
    }));

    tx.addOperation(Operation.manageData({
        source: forSalePK,
        name: "price",
        value: null
    }));

    tx.addOperation(Operation.manageData({
        source: forSalePK,
        name: "sellerPK",
        value: null
    }));

    tx = tx.setTimeout(0).build();

    return tx.toXDR('base64');
}

async function updateFees(body) {
    const { flatFee, percentageFee } = body

    const feeAccount = await server.loadAccount(feePK);
    const fee = await getFee();

    let tx = new TransactionBuilder(feeAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    tx.addOperation(Operation.manageData({
        source: masterPK,
        name: "flatFee",
        value: flatFee
    }));

    tx.addOperation(Operation.manageData({
        source: masterPK,
        name: "percentageFee",
        value: percentageFee
    }));

    tx = tx.setTimeout(0).build();

    return tx.toXDR('base64');
}

// async function setSigners(body) {
//     const { signers } = body
//
//     if (signers.length >= 100) {
//         throw {message: "Too many signers."}
//     }
//
//     const masterAccount = await server.loadAccount(masterPK);
//
//     if ("signer0" in masterAccount.data_attr) {
//         throw {message: "Signers have already been set."}
//     }
//
//     const feeAccount = await server.loadAccount(feePK);
//     const fee = await getFee();
//
//     let tx = new TransactionBuilder(feeAccount, {
//         fee,
//         networkPassphrase: Networks[STELLAR_NETWORK]
//     });
//
//     for (let i = 0; i < signers.length; i++) {
//         tx.addOperation(Operation.manageData({
//             source: masterPK,
//             name: "signer" + i,
//             value: signers[i]
//         }));
//     }
//
//     tx = tx.setTimeout(0).build();
//
//     return tx.toXDR('base64');
// }

function decodeManageDataString(str) {
    return new Buffer(str, 'base64').toString("utf-8")
}

async function getPriceAndSellerPK(pk) {
    const account = await server.loadAccount(pk);

    if (!("price" in account.data_attr)) {
        throw {message: "Account is not for sale."}
    }

    const price = decodeManageDataString(account.data_attr.price);
    const sellerPK = decodeManageDataString(account.data_attr.sellerPK);

    return { price, sellerPK };
}

async function getConfig() {
    const masterAccount = await server.loadAccount(masterPK);

    let signers = [];
    for (const [key, value] of Object.entries(masterAccount.data_attr)) {
        if (key.startsWith("signer")) {
            signers.push(decodeManageDataString(value));
        }
    }

    if (signers.length == 0)
        throw {message: "Signers not initialized."}

    const config = {
        flatFee: decodeManageDataString(masterAccount.data_attr.flatFee),
        percentageFee: decodeManageDataString(masterAccount.data_attr.percentageFee),
        signers: signers
    }
    return config
}

function getFee() {
    return server
    .feeStats()
    .then((feeStats) => feeStats?.fee_charged?.max || 100000)
    .catch(() => 100000)
};
