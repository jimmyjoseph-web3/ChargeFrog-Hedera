//Each run yields different codes for same names.
//npx ts-node apps/chargefrog-web/src/utils/isin_generator.ts

const COUNTRY_CODE = 'MY';
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomId9(): string {
  let out = '';
  for (let i = 0; i < 9; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

function toDigitsForCheck(identifier: string): string {
  const base = COUNTRY_CODE + identifier;
  return base
    .split('')
    .map((ch) => (/\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55)))
    .join('');
}

function computeCheckDigit(digitStr: string): number {
  let sum = 0;
  const rev = digitStr.split('').reverse();
  for (let i = 0; i < rev.length; i++) {
    let n = parseInt(rev[i], 10);
    if (i % 2 === 0) n *= 2;
    if (n > 9) n = Math.floor(n / 10) + (n % 10);
    sum += n;
  }
  return (10 - (sum % 10)) % 10;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateIsin(_name: string): string {
  const id9 = randomId9();
  const digits = toDigitsForCheck(id9);
  const check = computeCheckDigit(digits);
  return COUNTRY_CODE + id9 + check;
}

const args = process.argv.slice(2);
const projects = args.length
  ? args
  : [
      'ChargeFrog-Notts',
      'ChargeFrog-MajesticLabs',
      'ChargeFrog-MountAustin',
      'ChargeFrog-EcoMajestic',
    ];

for (const p of projects) {
  console.log(`${p} -> ${generateIsin(p)}`);
}
