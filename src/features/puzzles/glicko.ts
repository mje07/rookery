// Glicko-2 (Glickman, 2012) for a single game per rating period.
export interface Rating {
  r: number;
  rd: number;
  vol: number;
}

export const DEFAULT_RATING: Rating = { r: 1500, rd: 350, vol: 0.09 };
const SCALE = 173.7178;
const TAU = 0.75;
const MIN_RD = 45;
const MAX_RD = 350;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Update `player` after one game vs `opp` with score 1 (win/solved) or 0 (loss/failed). */
export function updateRating(player: Rating, opp: { r: number; rd: number }, score: 0 | 0.5 | 1): Rating {
  const mu = (player.r - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const muJ = (opp.r - 1500) / SCALE;
  const phiJ = opp.rd / SCALE;

  const gJ = g(phiJ);
  const e = E(mu, muJ, phiJ);
  const v = 1 / (gJ * gJ * e * (1 - e));
  const delta = v * gJ * (score - e);

  // Volatility via the Illinois algorithm.
  const a = Math.log(player.vol * player.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > 1e-6; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * gJ * (score - e);
  return {
    r: Math.max(100, muNew * SCALE + 1500),
    rd: Math.min(MAX_RD, Math.max(MIN_RD, phiNew * SCALE)),
    vol: Math.min(0.1, vol),
  };
}
