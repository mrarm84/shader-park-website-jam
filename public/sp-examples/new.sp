let audioLevel = input(0.5);
let s = getSpace();
let n = noise(s*2.5+time*0.25);

let gridFuncion = shape(() => {
  	let ray = getRayDirection();
  	rotateY(ray.x+time*-.1);
  	shine(.6);
  	metal(.6);
  	color(1, 1, .5);
	grid(3, .08, 0.01);
});

let sphereFn = shape(() => {
    let hue = abs(sin(time*.2));
    let saturation = .25;
    let value = 1;
    let col = hsv2rgb(vec3(hue, saturation, value));
    color(col);
  	occlusion(.8);
	sphere(.7+n*.5);
});

union();
gridFuncion();
sphereFn();
