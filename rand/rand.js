
/**
 * @param {BigInt} seed - input seed
 * @returns {BigInt}
 */
function rand(seed) {
    seed = seed * BigInt("0x5d588b656c078965");
    seed = seed + BigInt("0x269ec3");
    seed = seed & BigInt("0xFFFFFFFFFFFFFFFF");
    return seed;
}

/**
 * @param {BigInt} input
 * @returns {BigInt}
 */
function calculatePercent(input) {
    let output = input >> BigInt(32);
    output = output * BigInt(100);
    output = output / (BigInt(2) << BigInt(31));
    return output;
}

