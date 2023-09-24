
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
function calculatePercentInt(input){
    let output = input >> BigInt(32);
    output = output * BigInt(100);
    let test = (BigInt(2) << BigInt(31));
    output = output / test;
    return output;
}

/**
 * @param {BigInt} input
 * @returns {BigInt}
 */
function calculatePercent(input) {
    let output = input >> BigInt(32);
    output = output * BigInt(100);
    let test = (BigInt(2) << BigInt(31));
    //output = output / test;
    output = division(output, test);
    return output;
}

//Thanks https://stackoverflow.com/questions/54409854/how-to-divide-two-native-javascript-bigints-and-get-a-decimal-result
function division(a, b){
    return Number(a * 10000n / b) / 10000;
}

// /**
//  * @param {BigInt} input
//  * @returns {BigInt}
//  */
// function calculatePercent(input) {
//     let output = input >> BigInt(32);
//     output = output * BigInt(100);
//
//     // BigInt(2) << BigInt(31) を BigInt(2) * BigInt(2 ** 31) と同等に計算します
//     let test = BigInt(2) * BigInt(2 ** 31);
//
//     // BigInt 型の割り算の結果を文字列に変換してから小数点を挿入します
//     let result = (output / test).toString();
//
//     // 文字列を BigInt に変換して返します
//     return BigInt(result);
// }

