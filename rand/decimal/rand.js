
class BigDecimal {
    static decimals = 1;
    constructor(value) {
        let [ints, decis] = String(value).split(".").concat("");
        decis = decis.padEnd(BigDecimal.decimals, "0");
        this.bigint = BigInt(ints + decis);
    }

    static setDigit(digit) {
        BigDecimal.decimals = digit
    }

    static fromBigInt(bigint) {
        return Object.assign(Object.create(BigDecimal.prototype), { bigint });
    }
    divide(divisor) { // You would need to provide methods for other operations
        return BigDecimal.fromBigInt(this.bigint * BigInt("1" + "0".repeat(BigDecimal.decimals)) / divisor.bigint);
    }
    toString() {
        const s = this.bigint.toString().padStart(BigDecimal.decimals+1, "0");
        return s.slice(0, -BigDecimal.decimals) + "." + s.slice(-BigDecimal.decimals)
            .replace(/\.?0+$/, "");
    }
}

let decimal = null
let digit1 = null
setDecimal(4)

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
    if (digit1 < 10) {
        return Number(a * BigInt(decimal) / b) / parseInt(decimal);
    }else{
        let x = new BigDecimal((a * BigInt(decimal) / b).toString(10));
        var y = new BigDecimal(decimal);
        return x.divide(y).toString()
    }
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


function generateNumber(digit) {
    return (BigInt(10) ** BigInt(digit)).toString(10)
}

function setDecimal(digit){
    decimal = generateNumber(digit)
    digit1 = digit
    BigDecimal.setDigit(digit)
}


