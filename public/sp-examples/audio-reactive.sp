let audioLevel = input(0.5);
// Audio reactive sphere that pulses with sound
let s = getSpace();

let pulse = 0.5 + audioLevel * 0.5;
let hue = time * 0.1 + audioLevel * 2;

color(hue, 0.8, 0.6);
sphere(pulse);
