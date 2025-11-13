/// <reference types="vite-plugin-glsl/ext" />.

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'

import { OrbExample } from './Orb Tunneler/OrbTunneler';
import { EelExample } from './Electric Eel Universe/ElectricEelUniverse';
import { MojExample } from './Moj/Moj';
import { MojBExample } from './MojB/MojB';
import { OceanExample } from './Ocean/Ocean';
import { ShadertoyTexture } from "three-shadertoy-texture";

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

/**
 * Base
 */
// Debug
const gui = new dat.GUI()
gui.title("Examples")

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
directionalLight.position.set(1, 1, 1)
scene.add(directionalLight)

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
scene.add(ambientLight)

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(74, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 0
camera.position.y = 1
camera.position.z = 2
scene.add(camera)


window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1))
})


// Controls
const controls = new OrbitControls(camera, canvas as HTMLElement)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas!, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: true
})

renderer.clearColor(0, 1)
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))


// Test cube params
const icosahedronParams = {
  radius: 1,
  detail: 2
};

// Test cube:
const cube = new THREE.Mesh(
  new THREE.IcosahedronGeometry(icosahedronParams.radius, icosahedronParams.detail),
  new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.5, // Adjust between 0 (fully transparent) and 1 (fully opaque)
      depthWrite: false, // Optional: helps with rendering order issues
      metalness: 0.8,
      roughness: 0.2
  })
);

// Function to update icosahedron geometry
const updateIcosahedron = () => {
  cube.geometry.dispose();
  cube.geometry = new THREE.IcosahedronGeometry(icosahedronParams.radius, icosahedronParams.detail);
};

scene.add(cube);

const creditBox = document.querySelector("#credit-text")!;
let activeTexture : ShadertoyTexture;

const examples = [EelExample, MojExample, MojBExample,  OceanExample];
const setExample = (example: ExampleShader) => {
  activeTexture = example.texture;
  cube.material.map = example.texture.texture;
  creditBox.innerHTML = `
    <a href='${example.link}'>${example.title}</a> by <b>${example.author}</b>"`;
}

setExample(MojExample);

examples.forEach((ex) => {
  gui.add({do: () => setExample(ex)}, "do").name(ex.button);
})

const tick = () =>
{
    // Update controls
    controls.update()

    // Update texture:
    activeTexture.render(renderer);

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()

export type ExampleShader = {
  author: string;
  link: string;
  title: string;
  button: string;
  texture: ShadertoyTexture
}
