// Audio reactive sphere that pulses with sound
let s = getSpace();
let audioLevel = input();;

let pulse = 0.5 + audio * 0.5;
let hue = time * 0.1 + audio * 2;

color(hue, 0.8, 0.6);
sphere(pulse);
