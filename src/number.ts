/**
 * The default JS % operator returns negative results for negative inputs,
 * this function does not (unless you make `nL` negative).
 *
 * @param a The input number
 * @param n The modulo (the upper ending number for the modulo)
 * @param nL The optional lower starting number for the modulo
 * @returns `a` modulo'd to be >= `nL` and < `n`. e.g. `mod(0, 10, 1) //=== 9`
 */
export const mod = (a: number, n: number, nL = 0): number =>
  ((((a - nL) % (n - nL)) + (n - nL)) % (n - nL)) + nL;

export const howManyTimesDidModWrap = (a: number, n: number, nL = 0) =>
  (a - nL) / (n - nL);
