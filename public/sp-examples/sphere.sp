let s = getSpace();
let r = getRayDirection();

setStepSize(0.5);
let n = noise(r * 2 + time * 0.1);

color(0.5 + 0.5 * sin(time), 0.5 + 0.5 * cos(time * 0.7), 0.5 + 0.5 * sin(time * 0.5));
sphere(0.8 + n * 0.2);