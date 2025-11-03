let audioLevel = input(0.5);
setMaxReflections(2);

function gyroid(scale) {
  let s = getSpace();
  s = s * scale;
  return dot(sin(s), cos(vec3(s.z, s.x, s.y) + PI)) / scale;
}

setStepSize(.4);
let noiseScale = input(15, 0, 200);

shine(.5);
metal(.7);

let gyScale = input(2.5, 0, 5*audioLevel);
let gy = gyroid(gyScale);
let n = vectorContourNoise(getSpace() + vec3(0, 0, time*audioLevel * .2), .03 + gy * .2, 1.5);
n = pow(cos(n * 3) * .5 + .5, vec3(5));
color(n);

shape(() => {
  rotateY(time * .15);
  rotateX(time * .1);
  mirrorN(8, .02);
  torus(.1, .02);
})();
difference();
setSDF(gy);
