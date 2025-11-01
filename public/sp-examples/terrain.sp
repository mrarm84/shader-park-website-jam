let s = getSpace();

let n = noise(s * 0.5 + time * 0.1);
let h = n * 0.5 + 0.5;

color(h, h * 0.8, h * 0.6);
box(vec3(2.0, h, 2.0));
