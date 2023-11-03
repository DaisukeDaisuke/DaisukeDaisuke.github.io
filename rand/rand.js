
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

/**
 * @param {BigInt} input
 * @returns Number
 */
function calculatePercentFloat(input) {
    let output = input >> BigInt(32);
    output = output * BigInt(100);
    let test = (BigInt(2) << BigInt(31));
    //output = output / test;
    output = division(output, test);
    return output;
}

/**
 * Thanks https://stackoverflow.com/questions/54409854/how-to-divide-two-native-javascript-bigints-and-get-a-decimal-result
 *
 * @param {BigInt} a
 * @param {BigInt} b
 * @returns Number
 */
function division(a, b){
    return Number(a * 10000n / b) / 10000;
}

/**
 * @param {Number} nowPercent
 * @param {Number} max
 * @returns Number
 */
function getRand(nowPercent, max){
    let randomValue = nowPercent / 100 * max;
    return Math.floor(randomValue);
}