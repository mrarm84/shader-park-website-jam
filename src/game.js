import firebase from 'firebase/compat/app';

// These imports load individual services into the firebase namespace.
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import 'firebase/compat/app-check';
import * as THREE from 'three/webgpu';

import { MeshStandardMaterial, Scene, Inspector, Quaternion, WebGLRenderTarget, HalfFloatType , UniformsUtils,ShaderMaterial, Color, PerspectiveCamera, Vector2, Vector3, Raycaster, HemisphereLight, TextureLoader, WebGLRenderer, FrontSide, BackSide, BufferGeometry, Line, LineDashedMaterial, CatmullRomCurve3, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, IcosahedronGeometry, PlaneGeometry, CapsuleGeometry, SphereGeometry, AdditiveBlending, SubtractiveBlending, MultiplyBlending } from 'three';
import { pass, texture, uniform, output, mrt, velocity, uv, screenUV } from 'three/tsl';

// import { MeshStandardMaterial, Scene, Quaternion, WebGLRenderTarget, HalfFloatType , UniformsUtils,ShaderMaterial, Color, PerspectiveCamera, Vector2, Vector3, Raycaster, HemisphereLight, TextureLoader, WebGLRenderer, FrontSide, BackSide, BufferGeometry, Line, LineDashedMaterial, CatmullRomCurve3, Group, Mesh, MeshBasicMaterial, IcosahedronGeometry, AdditiveBlending, SubtractiveBlending, MultiplyBlending } from 'three/webgpu';
// import * as THREE from 'three';
import { motionBlur } from 'three/addons/tsl/display/MotionBlur.js';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';



import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import * as GeometryUtils from 'three/addons/utils/GeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { BokehShader, BokehDepthShader } from 'three/addons/shaders/BokehShader2.js';
import { DotScreenShader } from 'three/addons/shaders/DotScreenShader.js';
import { FilmShader } from 'three/addons/shaders/FilmShader.js';
import { HalftoneShader } from 'three/addons/shaders/HalftoneShader.js';
import { BleachBypassShader } from 'three/addons/shaders/BleachBypassShader.js';
import { ColorifyShader } from 'three/addons/shaders/ColorifyShader.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';
import { KaleidoShader } from 'three/addons/shaders/KaleidoShader.js';
import { LuminosityShader } from 'three/addons/shaders/LuminosityShader.js';
import { MirrorShader } from 'three/addons/shaders/MirrorShader.js';
import { PixelShader } from 'three/addons/shaders/PixelShader.js';
import { RGBShiftShader2 } from 'three/addons/shaders/RGBShiftShader2.js';
import { SepiaShader } from 'three/addons/shaders/SepiaShader.js';
import { SobelOperatorShader } from 'three/addons/shaders/SobelOperatorShader.js';
import { TriangleBlurShader } from 'three/addons/shaders/TriangleBlurShader.js';
import { UnpackDepthRGBAShader } from 'three/addons/shaders/UnpackDepthRGBAShader.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SSAARenderPass } from 'three/addons/postprocessing/SSAARenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { TAARenderPass } from 'three/addons/postprocessing/TAARenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ===== GAME VARIABLES =====
let gamePlayer = null;
let gameTerrain = null;
let gameKeys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false
};
let gamePlayerVelocity = new Vector3();
let gamePlayerSpeed = 0.1;
let gameJumpForce = 0.3;
let gameGravity = -0.01;
let gameIsGrounded = true;



console.log('GAME HI');
console.log('GAME HI');
console.log('GAME HI');
console.log('GAME HI');
// ===== END GAME VARIABLES =====

// ===== FIREBASE CONFIG =====
const dbConfig = {
  apiKey: "AIzaSyC2hH8ZGp6b2Cf5f8znw3Z7q7g7g7g7g7",
  authDomain: "shader-park.firebaseapp.com",
  databaseURL: "https://shader-park.firebaseio.com",
  projectId: "shader-park",
  storageBucket: "shader-park.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456",
  measurementId: "G-ABCDEFGHIJ"
};

let firebaseApp = null;
let store = null;
let vueApp = null;
let canvasContainer = null;
let renderer = null;
let scene = null;
let camera = null;
let composer = null;
let renderPass = null;
let controls = null;
let prevCanvasSize = {width: 0, height: 0};
let windowHalfX = 0;
let windowHalfY = 0;
let animationFrameId = null; // Added to store animation frame ID for cancellation

// Post-processing passes
let bokehPass = null;
let rgbShiftPass = null;
let dotPass = null;
let filmPass = null;
let halftonePass = null;
let afterimagePass = null;

// Lights
let hemisphereLight = null;
let redLight = null;
let blueLight = null;
let greenLight = null;
let purpleLight = null;
let orangeLight = null;

// Audio
let audioContext = null;
let analyser = null;
let microphone = null;
let audioLevel = 0.5;

// Gamepad
let gamepadState = {
  leftStick: {x: 0, y: 0},
  rightStick: {x: 0, y: 0},
  leftTrigger: 0,
  rightTrigger: 0,
  leftBumper: false,
  rightBumper: false,
  a: false, b: false, x: false, y: false,
  start: false, select: false,
  dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false
};

// ===== GAME FUNCTIONS =====
function initGameSystem() {
    console.log('🎮 Game system initialized');

    // Set up game event listeners
    window.addEventListener('keydown', onGameKeyDown);
    window.addEventListener('keyup', onGameKeyUp);

    // Expose game functions globally
    window.createGamePlayer = createGamePlayer;
    window.createGameTerrain = createGameTerrain;
    window.updateGamePlayer = updateGamePlayer;
    window.removeGameObjects = removeGameObjects;
    window.resetGamePlayer = resetGamePlayer;

    console.log('🎮 Game functions exposed globally');
}

function onGameKeyDown(event) {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            gameKeys.forward = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            gameKeys.backward = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            gameKeys.left = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            gameKeys.right = true;
            break;
        case 'Space':
            event.preventDefault();
            gameKeys.jump = true;
            break;
    }
}

function onGameKeyUp(event) {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            gameKeys.forward = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            gameKeys.backward = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            gameKeys.left = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            gameKeys.right = false;
            break;
        case 'Space':
            gameKeys.jump = false;
            break;
    }
}

function createGamePlayer() {
    if (gamePlayer) {
        console.log('🎮 Player already exists');
        return gamePlayer;
    }

    console.log('🎮 Creating game player...');

    // Create player as a group of meshes
    gamePlayer = new Group();
    gamePlayer.name = 'gamePlayer';

    // Create body (capsule-like shape)
    const bodyGeometry = new CapsuleGeometry(0.5, 1.5, 4, 8);
    const bodyMaterial = new MeshLambertMaterial({ color: 0xff6b6b });
    const body = new Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1;
    gamePlayer.add(body);

    // Create head
    const headGeometry = new SphereGeometry(0.4, 8, 6);
    const headMaterial = new MeshLambertMaterial({ color: 0xffdbac });
    const head = new Mesh(headGeometry, headMaterial);
    head.position.y = 2.2;
    gamePlayer.add(head);

    // Position player above terrain
    gamePlayer.position.set(0, 3, 0);

    scene.add(gamePlayer);
    console.log('🎮 Player created and added to scene');
    return gamePlayer;
}

function createGameTerrain(terrainSize = 100, terrainHeight = 2) {
    if (gameTerrain) {
        console.log('🎮 Terrain already exists');
        return gameTerrain;
    }

    console.log('🎮 Creating game terrain...');

    // Create a large plane for terrain
    const terrainGeometry = new PlaneGeometry(terrainSize, terrainSize, 64, 64);
    const terrainMaterial = new MeshLambertMaterial({
        color: 0x4a7c59,
        transparent: false
    });

    gameTerrain = new Mesh(terrainGeometry, terrainMaterial);
    gameTerrain.rotation.x = -Math.PI / 2; // Rotate to horizontal
    gameTerrain.position.y = 0;
    gameTerrain.name = 'gameTerrain';

    // Add height variation
    generateTerrainHeight(terrainGeometry, terrainHeight);

    scene.add(gameTerrain);
    console.log('🎮 Terrain created and added to scene');
    return gameTerrain;
}

function generateTerrainHeight(geometry, maxHeight) {
    const vertices = geometry.attributes.position.array;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];

        // Create hills and valleys using sine waves
        const height = Math.sin(x * 0.1) * Math.cos(z * 0.1) * maxHeight +
                      Math.sin(x * 0.05 + z * 0.03) * maxHeight * 0.5;

        vertices[i + 1] = height; // Y coordinate
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
}

function updateGamePlayer() {
    if (!gamePlayer) return;

    // Handle movement
    const moveVector = new Vector3();

    if (gameKeys.forward) moveVector.z -= 1;
    if (gameKeys.backward) moveVector.z += 1;
    if (gameKeys.left) moveVector.x -= 1;
    if (gameKeys.right) moveVector.x += 1;

    // Normalize and apply speed
    if (moveVector.length() > 0) {
        moveVector.normalize();
        moveVector.multiplyScalar(gamePlayerSpeed);

        // Apply camera rotation to movement
        if (camera) {
            const cameraDirection = new Vector3();
            camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0; // Keep movement horizontal
            cameraDirection.normalize();

            const right = new Vector3().crossVectors(cameraDirection, camera.up).normalize();

            const finalMove = new Vector3()
                .addScaledVector(cameraDirection, -moveVector.z)
                .addScaledVector(right, moveVector.x);

            gamePlayer.position.add(finalMove);
        }
    }

    // Handle jumping
    if (gameKeys.jump && gameIsGrounded) {
        gamePlayerVelocity.y = gameJumpForce;
        gameIsGrounded = false;
    }

    // Apply gravity
    gamePlayerVelocity.y += gameGravity;
    gamePlayer.position.add(gamePlayerVelocity);

    // Ground collision
    const groundHeight = getTerrainHeightAt(gamePlayer.position.x, gamePlayer.position.z);
    if (gamePlayer.position.y <= groundHeight + 2) {
        gamePlayer.position.y = groundHeight + 2;
        gamePlayerVelocity.y = 0;
        gameIsGrounded = true;
    }
}

function getTerrainHeightAt(x, z) {
    // Match the terrain generation algorithm
    return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2 +
           Math.sin(x * 0.05 + z * 0.03) * 2 * 0.5;
}

function resetGamePlayer() {
    if (gamePlayer) {
        gamePlayer.position.set(0, 3, 0);
        gamePlayerVelocity.set(0, 0, 0);
        gameIsGrounded = false;
        console.log('🎮 Player reset to starting position');
    }
}

function removeGameObjects() {
    if (gamePlayer && scene) {
        scene.remove(gamePlayer);
        gamePlayer = null;
        console.log('🎮 Player removed');
    }

    if (gameTerrain && scene) {
        scene.remove(gameTerrain);
        gameTerrain = null;
        console.log('🎮 Terrain removed');
    }
}

// ===== END GAME FUNCTIONS =====

export function init(container) { // Export init and accept a container element    // handleGamepadInput()
    if (!container) {
        console.error('Container not provided for game initialization');
        return;
    }

    canvasContainer = container; // Use the provided container
    renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: true});
	renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
	prevCanvasSize = { width: canvasContainer.clientWidth, height: canvasContainer.clientHeight };
	renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearAlpha(1);
renderer.setClearColor(0xffffff, 1);
	canvasContainer.appendChild(renderer.domElement);

	// Auto-focus canvas by simulating a click shortly after load
	// try { setTimeout(() => { try { sendCanvasClick(); } catch(e){} }, 500); } catch(e){}

	// Setup post-processing composer
	composer = new EffectComposer(renderer);
	renderPass = new RenderPass(scene, camera);
	// Attach params to renderPass for blending/blendingMode control via keyboard (key '4')
	renderPass.params = renderPass.params || {};
	if (typeof renderPass.params.blending !== 'number') renderPass.params.blending = 1;
	if (typeof renderPass.params.blendingMode !== 'number') renderPass.params.blendingMode = 1;
	composer.addPass(renderPass);

	// Setup bokeh depth shader material
	const depthShader = BokehDepthShader;
    // depthShader.fragmentShader = /* glsl */`
    //
	// 	uniform float mNear;
	// 	uniform float mFar;

	// 	uniform float mNear;
	// 	uniform float mFar;

	// 	varying vec2 vUv;

	// 	void main() {

	// 		vUv = uv;

	// 		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

	// 	}
	// `;

	// depthShader.fragmentShader = /* glsl */`

	// 	uniform float mNear;
	// 	uniform float mFar;

	// 	varying vec2 vUv;

	// 	void main() {

	// 		gl_FragColor = vec4( vec3( 1.0 ), 1.0 );

	// 	}
	// `;

	// Setup scene, camera, controls
	setupScene();

	// Setup lighting
	setupLights();

	// Setup camera and controls
	setupCamera();

	// Load and setup audio
	initAudio();

	// Setup post-processing effects
	setupPostProcessing();

	// Start animation loop
	animate();

	// Initialize game system
	initGameSystem();

	// Create game objects automatically
	setTimeout(() => {
		createGameTerrain();
		createGamePlayer();
		console.log('🎮 Game objects created automatically');
	}, 1000);

	console.log('🎮 Game main.js initialized with player and terrain support');
}

function setupScene() {
    scene = new Scene();
    scene.background = new Color(0xffffff);
    window.scene = scene;
}

function setupCamera() {
    camera = new PerspectiveCamera(75, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 1000);
    camera.position.set(10, 5, 10);
    camera.lookAt(0, 0, 0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;

    window.camera = camera;
    window.controls = controls;
}

function setupLights() {
    // Hemisphere light
    hemisphereLight = new HemisphereLight(0xffffff, 0x444444, 0.6);
    hemisphereLight.position.set(0, 20, 0);
    scene.add(hemisphereLight);

    // Colored directional lights
    redLight = new THREE.DirectionalLight(0xff0000, 0.3);
    redLight.position.set(10, 10, 5);
    scene.add(redLight);

    blueLight = new THREE.DirectionalLight(0x0000ff, 0.3);
    blueLight.position.set(-10, 10, 5);
    scene.add(blueLight);

    greenLight = new THREE.DirectionalLight(0x00ff00, 0.3);
    greenLight.position.set(0, 10, -10);
    scene.add(greenLight);

    purpleLight = new THREE.DirectionalLight(0xff00ff, 0.3);
    purpleLight.position.set(5, 10, 10);
    scene.add(purpleLight);

    orangeLight = new THREE.DirectionalLight(0xff6600, 0.3);
    orangeLight.position.set(-5, 10, -5);
    scene.add(orangeLight);
}

function setupPostProcessing() {
    // Bokeh pass for depth of field
    bokehPass = new BokehPass(scene, camera, {
        focus: 1.0,
        aperture: 0.025,
        maxblur: 1.0,
        width: canvasContainer.clientWidth,
        height: canvasContainer.clientHeight
    });
    composer.addPass(bokehPass);

    // RGB shift pass
    rgbShiftPass = new RGBShiftPass(new Vector2(0.02, 0.02));
    composer.addPass(rgbShiftPass);

    // Dot screen pass
    dotPass = new DotScreenPass(new Vector2(0.5, 0.5), 0.5, 0.8);
    composer.addPass(dotPass);

    // Film pass
    filmPass = new FilmPass(0.35, 0.025, 648, false);
    composer.addPass(filmPass);

    // Halftone pass
    halftonePass = new HalftonePass(canvasContainer.clientWidth, canvasContainer.clientHeight, {
        shape: 1,
        radius: 4,
        rotateR: Math.PI / 12,
        rotateB: Math.PI / 12 * 2,
        rotateG: Math.PI / 12 * 3,
        scatter: 0,
        blending: 1,
        blendingMode: 1,
        greyscale: false,
        disable: false
    });
    composer.addPass(halftonePass);

    // Afterimage pass for motion blur
    afterimagePass = new AfterimagePass(0.96);
    composer.addPass(afterimagePass);
}

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                microphone = audioContext.createMediaStreamSource(stream);
                microphone.connect(analyser);
            })
            .catch(err => console.log('Audio not available:', err));
    } catch(e) {
        console.log('Web Audio API not supported');
    }
}

function animate() {
    requestAnimationFrame(animate);

    // Update controls
    if (controls) controls.update();

    // Update audio level
    if (analyser) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        audioLevel = dataArray.reduce((a, b) => a + b) / bufferLength / 255;
    }

    // Update game player if exists
    updateGamePlayer();

    // Render scene
    composer.render();
}

export function cleanup() { // Export cleanup function
    console.log('🎮 Cleaning up game scene...');
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // Stop the animation loop
    }

    // Dispose of Three.js objects and remove from scene
    removeGameObjects(); // Call the existing function to remove game-specific objects

    if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentElement) {
            renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
        renderer = null;
    }
    scene = null;
    camera = null;
    controls = null;
    composer = null;
    // Reset other global variables if necessary
}

function sendCanvasClick() {
    const event = new MouseEvent('mousedown', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: canvasContainer.clientWidth / 2,
        clientY: canvasContainer.clientHeight / 2
    });
    renderer.domElement.dispatchEvent(event);
}

function onCanvasResize() {
    if (!canvasContainer) return;

    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    if (width === prevCanvasSize.width && height === prevCanvasSize.height) return;

    prevCanvasSize = { width, height };

    // Update camera
    if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    // Update renderer
    if (renderer) {
        renderer.setSize(width, height);
    }

    // Update composer
    if (composer) {
        composer.setSize(width, height);
    }

    // Update post-processing passes
    if (bokehPass) {
        bokehPass.uniforms['textureWidth'].value = width;
        bokehPass.uniforms['textureHeight'].value = height;
    }

    // Update blur pass uniforms
    if (blurPass) {
        blurPass.uniforms.resolution.value.set(width, height);
    }

    windowHalfX = width / 2;
    windowHalfY = height / 2;
}

window.onCanvasResize = onCanvasResize;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
