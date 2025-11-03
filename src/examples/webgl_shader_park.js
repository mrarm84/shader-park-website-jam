import * as THREE from 'three';
import { shaderParkMaterial } from 'shader-park-core';
/8
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Shader Park code as a string
const spCode = `
  let s = getSpace();
  color(vec3(s.x, s.y, s.z));
  sphere(0.5);
`;

const material = shaderParkMaterial(spCode);
const geometry = new THREE.SphereGeometry(1, 64, 64);
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

camera.position.z = 3;

function animate() {
	requestAnimationFrame(animate);
	material.uniforms.time.value = performance.now() / 1000;
	renderer.render(scene, camera);
}
animate();
