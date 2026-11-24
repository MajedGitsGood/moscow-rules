// Seeded RNG (mulberry32). The whole engine draws from one of these so a seed + the same orders
// always replays the same game.
export function makeRng(seed) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.int = (n) => Math.floor(rng() * n);
  rng.pick = (arr) => arr[rng.int(arr.length)];
  rng.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  rng.state = () => s;
  rng.setState = (v) => { s = v >>> 0; };
  return rng;
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
