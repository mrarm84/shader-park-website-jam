let audioLevel = input(0.5);
//**********
let s = getSpace()*audioLevel+vec3(-0.45,0.0,0.0);
function brot() {

let dr = 1.0;
let pos = vec3(0);
let power = 2.0;
let c = 0.0;
let h = 0.0;
let ex =0.0;
let bailout = 2.0;
let r = 0.0;
let zr = 0.0;
for (let i=0; i<20; i++) {
    let r = length(vec3(pos.x,pos.y,pos.z));
    pos = vec3(s.x,s.y,s.z);
     if (r > bailout) {
     break;
    }
    let theta = acos(pos.z/r);
    let phi = atan(pos.y, pos.x);
    dr = pow( r,power-1.0)*power*dr + 1.0;
   ///****
    let zr = pow( r,power);
    theta = theta*power;
    phi = phi*power;
     //****
    let z = zr*vec3(sin(theta)* cos(phi), sin(phi) * sin(theta), cos(theta));
    pos += z;
    ex += 0.5*log(r)*r/dr;
    c += 0.1*smoothstep(pos.x+pos.x-pos.y*pos.y,  pos.x*2.0*pos.y,   0);
    h = clamp(ex, 0.07, 0.105);

}
  //return 0.5*log(r)*r/dr;
  return c+h;
}

color(brot(s)*normal.x, normal.y*sin(0.4*time), normal.z*time);
sphere(brot(s));
