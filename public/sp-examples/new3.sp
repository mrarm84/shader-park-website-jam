let audioLevel = input(0.5);
let pos = getSpace() * 1;
let pose = 0.03;
let scale = 0.05;
let offset = .028;
blend(0.8);
function fbm(p) {
  return vec3(
    noise(p),
    noise(p+offset),
    noise(p+offset*1.8),
  )
}
setMaxReflections(1)
let n = vectorContourNoise(pos*.64 + vec3(0, 0, time*.1), 0.1, 1);

n *= pow(cos(24.0*pos.y),12.0);
n -= sin(fbm(fbm(fbm(fbm(pos*scale+vec3(0, pose, 0.24)))))*3)*.5+.4
n = pow(n, vec3(18));
color(n);

for(let i = 3; i < 6; i++) {

  for(let j = 1; j < 6; j++) {
    rotateX(time*0.06*j*i);
    rotateY(time*0.06*j*i);
    mirrorY()
    displace(.1*i - .25, .1*j - 0.76, 0.2);
    line(vec3(0.05, -0.003, -0.03), vec3(0.01, 0.01, 0.02), 0.02);

    reset();
  }
}
function oscillate(x) {
 return sin(nsin(time * .1) * 12 * x) * .5;
}
let s = toSpherical(getSpace());
let m = min(oscillate(s.y + s.x + 1), oscillate(s.z));

box(vec3(0.2 * m));
difference();
shell(0.02);
displace(0.2, 0.2, 0.2);
difference();
shape(() => {
  sphere(0.2);
  shell(.012);
})();
// mixGeo(abs(sin(time)));
// difference();
shine(0.2);
let color2 = vec3(0.0, 0.0, 0.0);
color(color2);
mixMat(0.5);
// blend(0.75)
displace(0, 0.5, 0);

grid(1,.5,.05);

let oscillation = abs(sin(time*0.5))*0.5;
let endSize = 0.28;
000
