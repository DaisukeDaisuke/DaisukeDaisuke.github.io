
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

/**
 * @param {BigInt} seed - input seed
 */
function ARand(seed){
    let before = seed;
    seed = seed * BigInt("0x41C64E6D");
    seed = seed + BigInt("0x3039");
    seed = seed & BigInt("0xFFFFFFFF");

    let ret = BigInt("0x7FFF") & rightShift(seed,0x10);
    return [seed, ret];
}

/**
 * @param {BigInt} seed - input seed
 * @return BigInt
 */
function getType(seed){
    let seed1 = rightShift(seed, 0x1f);
    seed = ((leftShift(seed, 0x1d) & BigInt("0xFFFFFFFF"))) - seed1 & BigInt("0xFFFFFFFF");
    if (seed < 0){
        seed = BigInt("0xFFFFFFFF") - seed;
    }
    seed1 = seed1 + ror(seed, BigInt(0x1d));
    seed1 = seed1 & BigInt(0xff);
    return seed1;
}

/**
 * @param {BigInt} input - input seed
 * @param {BigInt} ror
 * @return BigInt
 */
function ror(input, ror){
    return (rightShift(input, ror) | (leftShift(input, (BigInt(32) - ror)))) & BigInt(0xFFFFFFFF);
}

function leftShift(num, shift) { // <<
    return num * (2n ** BigInt(shift));
}

function rightShift(num, shift) { // >>
    return num / (2n ** BigInt(shift));
}

/**
 * @param {BigInt} input - input seed
 * @return BigInt
 */
function calculateATablePercentFloat(input) {
    let output = input * BigInt(100);
    //output = output / test;
    output = division(output, BigInt("0x7fff"));
    return output;
}