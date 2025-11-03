// Audio reactive sphere that pulses with sound

// Set the maximum number of reflections for rendering
setMaxReflections(2);

// Create input sliders for adjustable parameters
let noiseScale = input(0.1, 0.01, 0.5);
let sphereSize = input(0.2, 0.1, .5);
let torusRadius = input(0.5, 0.3, 1.0);
let torusThickness = input(0.2, 0.1, 0.5);
let twistFactor = input(10, 1, 20);

// Generate noise for the sphere
let n = vectorContourNoise(
  noiseScale * getSpace() + vec3(0, 0, 3.5 + .2 * sin(.1 * time)),
  .1,
  2
);

// Set the color based on the noise
color(n = pow(.5 * sin(2 * n) + .5, vec3(4)));
reflectiveColor(n + .1);
metal(3);
occlusion(-10);

// Create a mirrored effect
mirrorN(5, .04);

// Create a sphere with size based on noise
sphere(.02 + sphereSize * n.x);
reset();

intersect();

// Calculate twist based on ray direction and time
let twist = twistFactor * getRayDirection().x * sin(.1 * time);

// Create a torus
rotateX(PI / 2 + twist);
torus(torusRadius, torusThickness);
blend(.15);
reset();

// Create a box shape with twist
shape(() => {
  rotateX(twist);
  box(vec3(4.2));
  shell(.01);
});

// Add a base
displace(0, -.8, 0);
box(0.5, .15, .4);
