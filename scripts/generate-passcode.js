import { stderr, stdout } from "node:process";

const NUM_MIN = 48;
const NUM_MAX = 57;
const ALPHA_UPPER_MIN = 65;
const ALPHA_UPPER_MAX = 90;
const ALPHA_LOWER_MIN = 97;
const ALPHA_LOWER_MAX = 122;

const points = Array.from(
  { length: NUM_MAX - NUM_MIN },
  (_value, index) => index + NUM_MIN,
)
  .concat(
    Array.from(
      { length: ALPHA_UPPER_MAX - ALPHA_UPPER_MIN },
      (_value, index) => index + ALPHA_UPPER_MIN,
    ),
  )
  .concat(
    Array.from(
      { length: ALPHA_LOWER_MAX - ALPHA_LOWER_MIN },
      (_value, index) => index + ALPHA_LOWER_MIN,
    ),
  );

const getRandomChar = () => {
  return String.fromCodePoint(
    points[Math.floor(Math.random() * points.length) - 1],
  );
};

let length = 8;
if (process.argv.length > 2) {
  length = process.argv[2];
}

stderr.write(`Generating ${length} character long passcode\n`);
stdout.write(
  Array.from({ length })
    .map((_undef) => getRandomChar())
    .join(""),
);
