import firebase from 'firebase/compat/app';

// These imports load individual services into the firebase namespace.
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import 'firebase/compat/app-check';

import { Scene, WebGLRenderTarget, HalfFloatType , UniformsUtils,ShaderMaterial, Color, PerspectiveCamera, Vector2, Vector3, Raycaster, HemisphereLight, TextureLoader, WebGLRenderer, FrontSide, BackSide } from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { BokehShader, BokehDepthShader } from 'three/addons/shaders/BokehShader2.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// import './registerServiceWorker';

import TWEEN from '@tweenjs/tween.js';
import Vue from 'vue';


import VModal from 'vue-js-modal';
import VueRouter from 'vue-router';
import Vuelidate from 'vuelidate';
import VueMeta from 'vue-meta'
import anime from 'animejs';
import App from './App.vue';
import {dbConfig} from './dbConfig.js';
import {routes} from './router/routes';
import {store} from './store/store';


window.anime = anime;

firebase.initializeApp(dbConfig);

Vue.use(VueRouter);
Vue.use(VueMeta);
Vue.use(VModal, { dialog: true });
Vue.use(Vuelidate);
// Vue.use(window['vue-js-modal'].default, { dialog: true });
Vue.config.devtools = true;
// Vue.config.productionTip = false;
let storageRef = firebase.storage().ref();

const appCheck = firebase.appCheck();
appCheck.activate('6LdOL7keAAAAADahgNg_e2DFCG52EFLuVVN0OTmV',true)

const router = new VueRouter({ routes: routes, mode: 'history', base: process.env.BASE_URL});

let animationPaused = false;
const virtualCursor = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
};
let clicking = false;
// console.defaultLog = //console.log.bind(console);
// //console.logs = [];
// //console.log = function () {
// 	// default &  //console.log()
// 	console.defaultLog.apply(console, arguments);
// 	// new & array data
// 	//console.logs.push(Array.from(arguments));
// }


//TRY TO CAPTURE ERRORS
/*
console.defaultError = console.error.bind(console);
console.errors = [];
console.error = function () {
	// default &  console.error()
	console.defaultError.apply(console, arguments);
	// new & array data
	console.errors.push(Array.from(arguments));
}
*/

let sculptureHasBeenSelected = false;
let sculptureHasBeenDeselected = false;
let cachedSelectedSculptureId, cachedCameraPose;
let allSculpturesOpacity = {opacity: 0.0};
let selectedSculptureOpacity = {opacity: 0.0};
let firstTimeAtRoute = true;
let mediaCap = null;
let isCapturing = false;

// Gamepad button press tracking (to prevent repeated actions)
window.gamepadButtonBPressed = false;
window.gamepadButtonXPressed = false;
window.gamepadButtonYPressed = false;
window.gamepadButtonSharePressed = false;
window.gamepadButtonStartPressed = false;
window.gamepadButtonL3Pressed = false;
window.gamepadButtonR3Pressed = false;
window.gamepadButtonLeftBumperPressed = false;
window.gamepadButtonRightBumperPressed = false;

router.beforeEach((to, from, next) => {
	const currentUser = firebase.auth().currentUser;

	const nextRoute = () => {
		store.state.selectedObject = null;
		animationPaused = true;
		allSculpturesOpacity.opacity = 0.0;
		sculptureHasBeenDeselected = false;
		sculptureHasBeenSelected = false;
		selectedSculptureOpacity.opacity = 0.0;
		store.state.selectedSculpture = null;
		cachedSelectedSculptureId = null;
		cachedCameraPose = null;
		firstTimeAtRoute = true;
		const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
		if (requiresAuth && !currentUser) {
			this.$store.commit('displayLogin', true);
			// next('/sign-in');
		} else if (requiresAuth && currentUser) {
			store.state.displayCanvas = false;
			next();
		} else {
			store.state.displayCanvas = false;
			next();
		}
		animationPaused = false;
	};
	if (store.state.selectedSculpture) { //fade single sculpture if selected
		let id = store.state.selectedSculpture.id;
		transitionSculptureOpacity(id, 0.0, 1000).then(() => {
			const nextRouteHasSculptureSelected = to.matched.some(record => record.meta.selectedSculpture);
			if (!nextRouteHasSculptureSelected) {
				store.state.selectedSculpture = null;
			}
			setTimeout(() => { //wait for the editor to close
				store.state.displayCanvas = false;
				nextRoute();
			}, 300);
		});
	} else if (store.state.sculpturesLoaded) {
		if (store.state.displayCanvas) {
			transitionAllSculpturesOpacity(0.0, 1000).then(() => {
				store.state.displayCanvas = false;
				nextRoute();
			});
		} else {
			nextRoute();
		}
	} else {
		store.state.displayCanvas = false;
		nextRoute();
	}
});

let firstInit = true;
let vueApp;
firebase.auth().onAuthStateChanged(function(user) {
	if(firstInit) {
		vueApp = new Vue({el: '#app', store: store, router: router, render: h => h(App)});
		init();

		//Detect when sculpture is saved
		vueApp.$store.subscribeAction(async (action, state) => {
			let {payload, type} = action;
			await payload;
			if ((type === 'saveNewSculpture' || type === 'saveSculpture')
				&& (payload.uid === firebase.auth().currentUser.uid || firebase.auth().currentUser.uid ==='K3lAQQTKbiTiVXlwRZouH4OrWyv1')) {
				//hide pedestal during image capture
				let pedestal = null;
				let pedestalWasVisible = false;
				if (state.selectedSculpture && state.selectedSculpture.sculpture && state.selectedSculpture.sculpture.pedestal) {
					pedestal = state.selectedSculpture.sculpture.pedestal;
					pedestalWasVisible = pedestal.visible;
					pedestal.visible = false;

				}

				setTimeout(() => { //make sure pedestal is hidden
					captureCanvasImage(async (blob) => {
						try {
							if (pedestal && pedestalWasVisible) {
								pedestal.visible = true;
							}
							//console.log('captured image', 'uploading to id', payload.id)
							let fileData = await storageRef.child(`sculptureThumbnails/${payload.id}.png`).put(blob);
							//console.log('uploaded')
							let thumbnail = await fileData.ref.getDownloadURL();
							if (thumbnail) {
								//console.log('thumbnail url', thumbnail)
								let storageLocation = 'sculptures';
								if (payload.isExample) {
									storageLocation = 'examples';
								}
								firebase.database().ref(storageLocation).child(payload.id).update({ thumbnail })
							}
						} catch(e) {
							console.error(e);
						}
					}, false);
				}, 1);
			}
		});
		firstInit = false;
	} else {
		store.dispatch('setUser');
	}
});
// const scene = store.state.scene;
const scene = new Scene();
window.scene = scene;
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.0001, 180);

window.camera = camera;

let renderer, controls, mapControls, canvas, canvasContainer, composer, rgbShiftPass;

// RGB Shift effect parameters
const params = {
    rsx: 0.01, // RGB shift amount
    rsy: 0.01  // RGB shift angle
};

// Bokeh depth-of-field effect variables
let materialDepth, bokehPass, gui;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;
let distance = 100;

// Bokeh render targets
let rtTextureDepth, rtTextureColor;

// Bokeh shader settings
const shaderSettings = {
    rings: 3,
    samples: 4
};

// Bokeh effect controller (same as the HTML example)
const effectController = {
    enabled: false,
    jsDepthCalculation: false, // Disable auto depth calculation - use manual focalDepth instead
    shaderFocus: false,

    fstop: 2.2,
    maxblur: 1.0,

    showFocus: false,
    focalDepth: 10.0, // Increased default focal depth for better visibility
    manualdof: false,
    vignetting: false,
    depthblur: false,

    threshold: 0.5,
    gain: 2.0,
    bias: 0.5,
    fringe: 10,

    focalLength: 35,
    noise: true,
    pentagon: false,

    dithering: 0.0001
};

// Make params globally accessible for dynamic tweaking
window.rgbShiftParams = params;

// Setup GUI controls for bokeh effect
function setupBokehGUI() {
    const matChanger = function () {
        for (const e in effectController) {
            if (e in bokehPass.uniforms) {
                bokehPass.uniforms[e].value = effectController[e];
            }
        }

        bokehPass.enabled = effectController.enabled;
        bokehPass.uniforms['znear'].value = camera.near;
        bokehPass.uniforms['zfar'].value = camera.far;
        camera.setFocalLength(effectController.focalLength);
    };

    const shaderUpdate = function () {
        bokehPass.material.defines.RINGS = shaderSettings.rings;
        bokehPass.material.defines.SAMPLES = shaderSettings.samples;
        bokehPass.material.needsUpdate = true;
    };

    gui = new GUI();

    gui.add(effectController, 'enabled').onChange(matChanger);
    gui.add(effectController, 'jsDepthCalculation').onChange(matChanger);
    gui.add(effectController, 'shaderFocus').onChange(matChanger);
    gui.add(effectController, 'focalDepth', 0.0, 200.0).listen().onChange(matChanger);

    gui.add(effectController, 'fstop', 0.1, 22, 0.001).onChange(matChanger);
    gui.add(effectController, 'maxblur', 0.0, 5.0, 0.025).onChange(matChanger);

    gui.add(effectController, 'showFocus').onChange(matChanger);
    gui.add(effectController, 'manualdof').onChange(matChanger);
    gui.add(effectController, 'vignetting').onChange(matChanger);

    gui.add(effectController, 'depthblur').onChange(matChanger);

    gui.add(effectController, 'threshold', 0, 1, 0.001).onChange(matChanger);
    gui.add(effectController, 'gain', 0, 100, 0.001).onChange(matChanger);
    gui.add(effectController, 'bias', 0, 3, 0.001).onChange(matChanger);
    gui.add(effectController, 'fringe', 0, 30, 0.001).onChange(matChanger);

    gui.add(effectController, 'focalLength', 16, 80, 0.001).onChange(matChanger);

    gui.add(effectController, 'noise').onChange(matChanger);

    gui.add(effectController, 'dithering', 0, 0.001, 0.0001).onChange(matChanger);

    gui.add(effectController, 'pentagon').onChange(matChanger);

    gui.add(shaderSettings, 'rings', 1, 8).step(1).onChange(shaderUpdate);
    gui.add(shaderSettings, 'samples', 1, 13).step(1).onChange(shaderUpdate);

    matChanger();
}

const mouse = new Vector2();
const raycaster = new Raycaster();
const hemisphereLight = new HemisphereLight(0xFFFFFF, 0xFFFFFF);
const startTime = Date.now();
let prevCanvasSize = window.innerWidth/2;
let tweeningSculpturesOpacity = true;
let fogDistance = 200.0;
window.fogDistance = fogDistance;


function init() {
    // handleGamepadInput()
	canvasContainer = document.querySelector('.canvas-container');
	renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: true});
	renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
	prevCanvasSize = { width: canvasContainer.clientWidth, height: canvasContainer.clientHeight };
    Object.assign(store.state.canvasSize, prevCanvasSize);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setClearColor( 0xffffff, 1 );
	canvasContainer.appendChild(renderer.domElement);

	// Setup post-processing composer
	composer = new EffectComposer(renderer);
	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);

	// Setup bokeh depth shader material
	const depthShader = BokehDepthShader;
    // depthShader.fragmentShader = /* glsl */`
    //
	// 	uniform float mNear;
	// 	uniform float mFar;
    //
	// 	varying float vViewZDepth;
    //
	// 	void main() {
    //
	// 		float color = 1.0 - smoothstep( mNear, mFar, vViewZDepth );
	// 		gl_FragColor = vec4( vec3( color ), texture2D(tDiffuse, vUv).a );
    //
	// 	}`;
	materialDepth = new ShaderMaterial({
		uniforms: depthShader.uniforms,
		vertexShader: depthShader.vertexShader,
		fragmentShader: depthShader.fragmentShader
	});
	materialDepth.uniforms['mNear'].value = camera.near;
	materialDepth.uniforms['mFar'].value = camera.far;

	// Setup bokeh pass
	const bokehShader = BokehShader;
	const bokehUniforms = UniformsUtils.clone(bokehShader.uniforms);
	bokehUniforms['textureWidth'].value = window.innerWidth;
	bokehUniforms['textureHeight'].value = window.innerHeight;

	bokehPass = new ShaderPass({
		uniforms: bokehUniforms,
		vertexShader: bokehShader.vertexShader,
		fragmentShader: bokehShader.fragmentShader,
		defines: {
			RINGS: shaderSettings.rings,
			SAMPLES: shaderSettings.samples
		}
	});


	// Add RGB Shift effect
	rgbShiftPass = new ShaderPass(RGBShiftShader);
	rgbShiftPass.uniforms.amount.value = params.rsy; // tweak strength
	rgbShiftPass.uniforms.angle.value = params.rsx; // tweak strength
	rgbShiftPass.enabled = true;
	bokehPass.renderToScreen = true;

	// Initialize bokeh render targets
	rtTextureDepth = new WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: HalfFloatType });
	rtTextureColor = new WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: HalfFloatType });

	// Set bokeh pass uniforms
	bokehPass.uniforms['tColor'].value = rtTextureColor.texture;
	bokehPass.uniforms['tDepth'].value = rtTextureDepth.texture;

	composer.addPass(rgbShiftPass);
	composer.addPass(bokehPass);

	// Setup GUI controls for bokeh effect
	setupBokehGUI();

	canvas = document.querySelector('canvas');
	canvas.setAttribute('tabindex', '0');
	canvas.setAttribute('powerPreference', 'high-performance');
	canvas.addEventListener('click', (event) => {
		event.target.focus();
	});

	// Add mouse interaction for bokeh focus
	canvas.addEventListener('pointermove', onPointerMove);

	// canvas.addEventListener('mousemove', onMouseMove, false);
    console.log("Gamepad:", navigator.getGamepads()[0]);

	mediaCap = piCreateMediaRecorder(() => console.log("capturing render"), canvas);
	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true; // Restore damping for smooth mouse controls
	controls.enablePan = true; // Enable right-click panning to move objects/camera
	controls.dampingFactor = 0.25;
	controls.zoomSpeed = 0.5;
	controls.rotateSpeed = 0.5;
	controls.keys = {
		LEFT: 65,
		UP: 87,
		RIGHT: 68,
		BOTTOM: 83
	};

	mapControls = new MapControls(camera, renderer.domElement);
	mapControls.enableDamping = true; // Restore damping for smooth mouse controls
	mapControls.dampingFactor = 0.25;
	mapControls.screenSpacePanning = false;
	mapControls.maxPolarAngle = Math.PI / 2;

	window.mapControls = mapControls;
	window.controls = controls;
	camera.position.set(6, 2.5, 4);
	// controls.target.set(6, 0, 0);

	scene.add(hemisphereLight);
    render();
}
window.addEventListener("gamepadconnected", (e) => {
	console.log("Gamepad connected:", e.gamepad);
});
window.addEventListener("gamepaddisconnected", (e) => {
	console.log("Gamepad disconnected:", e.gamepad);
});
window.addEventListener('resize', onCanvasResize, false);
// window.addEventListener('mousedown', onMouseDown, false);
// window.addEventListener('mouseup', onMouseUp, false);
document.addEventListener('keydown', keyPress.bind(null, true));
document.addEventListener('keyup', keyPress.bind(null, false));

function setInitialCameraPose() {
	if (store.state.initialCameraPose && firstTimeAtRoute) {
		firstTimeAtRoute = false;
		let pose = store.state.initialCameraPose;
		camera.position.set(pose[0], pose[1], pose[2]);
		controls.target.set(pose[0], 0, 0);
		mapControls.target.set(pose[0], 0, 0);
	}
}

// Global gamepad state object for Shader Park uniforms
window.gamepadState = {
    // Analog sticks (range: -1 to 1)
    leftStickX: 0,
    leftStickY: 0,
    rightStickX: 0,
    rightStickY: 0,

    // Face buttons (boolean)
    buttonA: false,      // Button 0 - Select/Click
    buttonB: false,      // Button 1 - Deselect
    buttonX: false,      // Button 2 - Wireframe toggle
    buttonY: false,      // Button 3 - Reset rotation

    // Shoulder buttons (boolean)
    leftBumper: false,   // Button 4 - Decrease fog
    rightBumper: false,  // Button 5 - Increase fog

    // Triggers (range: 0 to 1)
    leftTrigger: 0,      // Button 6 - Zoom out
    rightTrigger: 0,     // Button 7 - Zoom in

    // Special buttons (boolean)
    buttonShare: false,  // Button 8 - Toggle fullscreen
    buttonStart: false,  // Button 9 - Reset camera
    buttonL3: false,     // Button 10 - Camera follow mode
    buttonR3: false,     // Button 11 - Center camera

    // D-pad (boolean, if supported)
    dpadUp: false,       // Button 12
    dpadDown: false,     // Button 13
    dpadLeft: false,     // Button 14
    dpadRight: false,    // Button 15

    // Connection status
    isConnected: false,
    gamepadId: ''
};

function handleGamepadInput() {
    try {
        const gamepads = navigator.getGamepads();
        const gamepad = gamepads ? gamepads[0] : null;

        // Update connection status
        window.gamepadState.isConnected = !!gamepad;
        window.gamepadState.gamepadId = gamepad ? gamepad.id : '';

        // console.log('Gamepads detected:', gamepads ? gamepads.length : 0, gamepad ? gamepad.id : 'none');

        if (gamepad) {
            const deadzone = 0.1; // Deadzone to prevent drift

            // Update analog sticks with deadzone
            window.gamepadState.leftStickX = Math.abs(gamepad.axes[0]) > deadzone ? gamepad.axes[0] : 0;
            window.gamepadState.leftStickY = Math.abs(gamepad.axes[1]) > deadzone ? gamepad.axes[1] : 0;
            window.gamepadState.rightStickX = Math.abs(gamepad.axes[2]) > deadzone ? gamepad.axes[2] : 0;
            window.gamepadState.rightStickY = Math.abs(gamepad.axes[3]) > deadzone ? gamepad.axes[3] : 0;

            // Update button states
            if (gamepad.buttons) {
                window.gamepadState.buttonA = gamepad.buttons[0] ? gamepad.buttons[0].pressed : false;
                window.gamepadState.buttonB = gamepad.buttons[1] ? gamepad.buttons[1].pressed : false;
                window.gamepadState.buttonX = gamepad.buttons[2] ? gamepad.buttons[2].pressed : false;
                window.gamepadState.buttonY = gamepad.buttons[3] ? gamepad.buttons[3].pressed : false;
                window.gamepadState.leftBumper = gamepad.buttons[4] ? gamepad.buttons[4].pressed : false;
                window.gamepadState.rightBumper = gamepad.buttons[5] ? gamepad.buttons[5].pressed : false;

                // Triggers with analog values
                window.gamepadState.leftTrigger = gamepad.buttons[6] ?
                    (gamepad.buttons[6].value || (gamepad.buttons[6].pressed ? 1 : 0)) : 0;
                window.gamepadState.rightTrigger = gamepad.buttons[7] ?
                    (gamepad.buttons[7].value || (gamepad.buttons[7].pressed ? 1 : 0)) : 0;

                window.gamepadState.buttonShare = gamepad.buttons[8] ? gamepad.buttons[8].pressed : false;
                window.gamepadState.buttonStart = gamepad.buttons[9] ? gamepad.buttons[9].pressed : false;
                window.gamepadState.buttonL3 = gamepad.buttons[10] ? gamepad.buttons[10].pressed : false;
                window.gamepadState.buttonR3 = gamepad.buttons[11] ? gamepad.buttons[11].pressed : false;

                // D-pad (if supported)
                window.gamepadState.dpadUp = gamepad.buttons[12] ? gamepad.buttons[12].pressed : false;
                window.gamepadState.dpadDown = gamepad.buttons[13] ? gamepad.buttons[13].pressed : false;
                window.gamepadState.dpadLeft = gamepad.buttons[14] ? gamepad.buttons[14].pressed : false;
                window.gamepadState.dpadRight = gamepad.buttons[15] ? gamepad.buttons[15].pressed : false;
            }

            const rotateSpeed = 2.0; // Object rotation speed
            const moveSpeed = 0.5; // Camera movement speed

            // Get current selected object position for rotation center
            let rotationCenter = new Vector3(0, 0, 0);
            if (store.state.selectedSculpture && store.state.selectedObject) {
                rotationCenter.copy(store.state.selectedObject.position);
            }

            // Left stick: rotate around Y axis + zoom in/out
            if (Math.abs(window.gamepadState.leftStickX) > 0.01 || Math.abs(window.gamepadState.leftStickY) > 0.01) {
                // Left/right movement (leftStickX) - rotate around Y axis (yaw)
                if (Math.abs(window.gamepadState.leftStickX) > 0.01) {
                    const rotationAmount = window.gamepadState.leftStickX * rotateSpeed * 0.02;
                    if (controls.enabled) {
                        controls.rotateLeft(rotationAmount);
                    } else if (mapControls.enabled) {
                        mapControls.rotateLeft(rotationAmount);
                    }
                }

                // Up/down movement (leftStickY) - zoom in/out
                if (Math.abs(window.gamepadState.leftStickY) > 0.01) {
                    const zoomFactor = 1 + Math.abs(window.gamepadState.leftStickY) * 0.02;
                    if (window.gamepadState.leftStickY > 0) {
                        // Down on stick = zoom out (away from object)
                        if (controls.enabled) {
                            controls.dollyOut(zoomFactor);
                        } else if (mapControls.enabled) {
                            mapControls.dollyOut(zoomFactor);
                        }
                    } else {
                        // Up on stick = zoom in (towards object)
                        if (controls.enabled) {
                            controls.dollyIn(zoomFactor);
                        } else if (mapControls.enabled) {
                            mapControls.dollyIn(zoomFactor);
                        }
                    }
                }
            }

            // Right stick: horizontal movement (pan camera left/right, forward/back)
            if (Math.abs(window.gamepadState.rightStickX) > 0.01 || Math.abs(window.gamepadState.rightStickY) > 0.01) {
                // Move camera horizontally relative to its current orientation
                const forward = new Vector3();
                camera.getWorldDirection(forward);
                forward.y = 0; // Keep movement horizontal
                forward.normalize();

                const right = new Vector3(-forward.z, 0, forward.x);

                camera.position.addScaledVector(right, -window.gamepadState.rightStickX * moveSpeed);
                camera.position.addScaledVector(forward, window.gamepadState.rightStickY * moveSpeed);
            }

            // Keep old virtual cursor code for compatibility (can be removed if not needed)
            const cursorSpeed = 10; // pixels per frame
            virtualCursor.x += gamepad.axes[0] * cursorSpeed;
            virtualCursor.y += gamepad.axes[1] * cursorSpeed;
            // Clamp to canvas bounds
            virtualCursor.x = Math.max(0, Math.min(window.innerWidth, virtualCursor.x));
            virtualCursor.y = Math.max(0, Math.min(window.innerHeight, virtualCursor.y));

            // Simulate mousemove
            const fakeMoveEvent = {
                clientX: virtualCursor.x,
                clientY: virtualCursor.y
            };
            onMouseMove(fakeMoveEvent);

            // Button mappings for different actions (with safety checks)
            // Button 0 (A/Cross): Click/Select
            if (gamepad.buttons && gamepad.buttons[0] && gamepad.buttons[0].pressed && !clicking) {
                //console.log('click gamepad')
                clicking = true;
                const fakeDownEvent = {
                    clientX: virtualCursor.x,
                    clientY: virtualCursor.y
                };
                onMouseDown(fakeDownEvent);
            }

            if (gamepad.buttons && gamepad.buttons[0] && !gamepad.buttons[0].pressed && clicking) {
                clicking = false;
                const fakeUpEvent = {
                    clientX: virtualCursor.x,
                    clientY: virtualCursor.y
                };
                onMouseUp(fakeUpEvent);
            }

        // Handle button presses (only once per press)
        handleGamepadButtonPresses(gamepad);

        // Handle analog triggers for zoom
        handleGamepadTriggers(gamepad);

        // Simulate click with Button A (already handled above in mouse section)

        // Keep old virtual cursor code for compatibility (can be removed if not needed)
        const virtualCursorSpeed = 10; // pixels per frame
        virtualCursor.x += window.gamepadState.leftStickX * virtualCursorSpeed;
        virtualCursor.y += window.gamepadState.leftStickY * virtualCursorSpeed;

        // Debug logging - remove this after testing
        // console.log('🎮 GAMEPAD ACTIVE - Left:', window.gamepadState.leftStickX.toFixed(2), window.gamepadState.leftStickY.toFixed(2), 'Right:', window.gamepadState.rightStickX.toFixed(2), window.gamepadState.rightStickY.toFixed(2));

        // Visual feedback - temporarily change renderer clear color when gamepad is active
        if (Math.abs(window.gamepadState.leftStickX) > 0.1 || Math.abs(window.gamepadState.leftStickY) > 0.1 ||
            Math.abs(window.gamepadState.rightStickX) > 0.1 || Math.abs(window.gamepadState.rightStickY) > 0.1) {
            renderer.setClearColor(0xffffff, 1); // Green tint when moving
        } else {
            renderer.setClearColor(0xffffff, 1); // Green tint when moving
        }
    } else {
        console.log('No gamepad detected');
        // Reset renderer clear color when no gamepad
            renderer.setClearColor(0xffffff, 1); // Green tint when moving
    }
    } catch (error) {
        // Silently handle gamepad errors to prevent console spam
        // console.warn('Gamepad input error:', error);
    }
}

// Helper function to handle button presses (only once per press)
function handleGamepadButtonPresses(gamepad) {
    if (!gamepad || !gamepad.buttons) return;

    // Button B (Deselect current sculpture)
    if (window.gamepadState.buttonB && !window.gamepadButtonBPressed) {
        window.gamepadButtonBPressed = true;
        if (store.state.selectedSculpture) {
            store.state.selectedSculpture = null;
            store.state.selectedObject = null;
            console.log('🎮 Deselected sculpture');
        }
    }
    if (!window.gamepadState.buttonB) {
        window.gamepadButtonBPressed = false;
    }

    // Button X (Toggle wireframe mode)
    if (window.gamepadState.buttonX && !window.gamepadButtonXPressed) {
        window.gamepadButtonXPressed = true;
        if (store.state.selectedSculpture && store.state.selectedObject) {
            const material = store.state.selectedObject.material;
            if (material) {
                material.wireframe = !material.wireframe;
                console.log('🎮 Wireframe:', material.wireframe ? 'ON' : 'OFF');
            }
        }
    }
    if (!window.gamepadState.buttonX) {
        window.gamepadButtonXPressed = false;
    }

    // Button Y (Reset object rotation)
    if (window.gamepadState.buttonY && !window.gamepadButtonYPressed) {
        window.gamepadButtonYPressed = true;
        if (store.state.selectedSculpture && store.state.selectedObject) {
            store.state.selectedObject.rotation.set(0, 0, 0);
            console.log('🎮 Reset object rotation');
        }
    }
    if (!window.gamepadState.buttonY) {
        window.gamepadButtonYPressed = false;
    }

    // Button Share (Toggle fullscreen)
    if (window.gamepadState.buttonShare && !window.gamepadButtonSharePressed) {
        window.gamepadButtonSharePressed = true;
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            console.log('🎮 Entered fullscreen');
        } else {
            document.exitFullscreen();
            console.log('🎮 Exited fullscreen');
        }
    }
    if (!window.gamepadState.buttonShare) {
        window.gamepadButtonSharePressed = false;
    }

    // Button Start (Reset camera to initial position)
    if (window.gamepadState.buttonStart && !window.gamepadButtonStartPressed) {
        window.gamepadButtonStartPressed = true;
        if (store.state.initialCameraPose) {
            camera.position.set(store.state.initialCameraPose[0], store.state.initialCameraPose[1], store.state.initialCameraPose[2]);
            controls.target.set(store.state.initialCameraPose[0], 0, 0);
            mapControls.target.set(store.state.initialCameraPose[0], 0, 0);
            console.log('🎮 Reset camera position');
        }
    }
    if (!window.gamepadState.buttonStart) {
        window.gamepadButtonStartPressed = false;
    }

    // Button L3 (Toggle camera follow mode)
    if (window.gamepadState.buttonL3 && !window.gamepadButtonL3Pressed) {
        window.gamepadButtonL3Pressed = true;
        window.cameraFollowMode = !window.cameraFollowMode;
        console.log('🎮 Camera follow mode:', window.cameraFollowMode ? 'ON' : 'OFF');
    }
    if (!window.gamepadState.buttonL3) {
        window.gamepadButtonL3Pressed = false;
    }

    // Button R3 (Center camera on object)
    if (window.gamepadState.buttonR3 && !window.gamepadButtonR3Pressed) {
        window.gamepadButtonR3Pressed = true;
        if (store.state.selectedSculpture && store.state.selectedObject) {
            const objectPos = store.state.selectedObject.position;
            camera.lookAt(objectPos);
            controls.target.copy(objectPos);
            mapControls.target.copy(objectPos);
            console.log('🎮 Camera centered on object');
        }
    }
    if (!window.gamepadState.buttonR3) {
        window.gamepadButtonR3Pressed = false;
    }
}

// Helper function to handle analog triggers
function handleGamepadTriggers(gamepad) {
    if (!gamepad || !gamepad.buttons) return;

    // Left Bumper (Toggle RGB Shift effect)
    if (window.gamepadState.leftBumper && !window.gamepadButtonLeftBumperPressed) {
        window.gamepadButtonLeftBumperPressed = true;
        // toggleRGBShift();
        randomizeBokehParameters();
    }
    if (!window.gamepadState.leftBumper) {
        window.gamepadButtonLeftBumperPressed = false;
    }

    // Right Bumper (Toggle Bokeh effect and randomize parameters)
    if (window.gamepadState.rightBumper && !window.gamepadButtonRightBumperPressed) {
        window.gamepadButtonRightBumperPressed = true;
        effectController.enabled = !effectController.enabled;
        if (effectController.enabled) {
            randomizeBokehParameters();
            console.log('🎮 Bokeh effect ENABLED with randomized parameters');
        } else {
            console.log('🎮 Bokeh effect DISABLED');
        }
        // Update the GUI to reflect the change
        if (gui) {
            gui.controllers.forEach(controller => {
                if (controller.property === 'enabled') {
                    controller.setValue(effectController.enabled);
                }
            });
        }
    }
    if (!window.gamepadState.rightBumper) {
        window.gamepadButtonRightBumperPressed = false;
    }

    // Left Trigger (Zoom out - analog)
    if (window.gamepadState.leftTrigger > 0.1) {
        const zoomFactor = 1 + window.gamepadState.leftTrigger * 0.02;
        if (controls.enabled) {
            controls.dollyOut(zoomFactor);
        } else if (mapControls.enabled) {
            mapControls.dollyOut(zoomFactor);
        }
    }

    // Right Trigger (Zoom in - analog)
    if (window.gamepadState.rightTrigger > 0.1) {
        const zoomFactor = 1 + window.gamepadState.rightTrigger * 0.02;
        if (controls.enabled) {
            controls.dollyIn(zoomFactor);
        } else if (mapControls.enabled) {
            mapControls.dollyIn(zoomFactor);
        }
    }

    // Update RGB shift uniforms with gamepad d-pad
    updateRGBShiftWithGamepad();
}

// Randomize bokeh parameters for creative effects
function randomizeBokehParameters() {
    // Randomize various bokeh parameters for interesting effects
    effectController.fstop = 0.5 + Math.random() * 20; // 0.5-20.5
    effectController.maxblur = Math.random() * 5; // 0-5
    effectController.focalDepth = Math.random() * 50 + 5; // 5-55
    effectController.threshold = Math.random() * 0.5 + 0.25; // 0.25-0.75
    effectController.gain = Math.random() * 95 + 5; // 5-100
    effectController.bias = Math.random() * 2.5 + 0.25; // 0.25-2.75
    effectController.fringe = Math.random() * 29.75 + 0.25; // 0.25-6.75
    effectController.focalLength = Math.random() * 60 + 10; // 10-70

    // Randomly enable/disable some effects
    effectController.showFocus = Math.random() > 0.7;
    effectController.manualdof = Math.random() > 0.8;
    effectController.vignetting = Math.random() > 0.6;
    effectController.depthblur = Math.random() > 0.7;
    effectController.noise = Math.random() > 0.8;
    effectController.pentagon = Math.random() > 0.9;

    // Update the shader with new values
    const matChanger = function () {
        for (const e in effectController) {
            if (e in bokehPass.uniforms) {
                bokehPass.uniforms[e].value = effectController[e];
            }
        }
        bokehPass.enabled = effectController.enabled;
        bokehPass.uniforms['znear'].value = camera.near;
        bokehPass.uniforms['zfar'].value = camera.far;
        camera.setFocalLength(effectController.focalLength);
    };

    matChanger();

    // Update GUI to reflect new values
    if (gui) {
        gui.controllers.forEach(controller => {
            if (controller.property in effectController) {
                controller.setValue(effectController[controller.property]);
            }
        });
    }

    console.log('🎲 Bokeh parameters randomized!');
}

// Toggle RGB shift effect
function toggleRGBShift() {
    if (rgbShiftPass) {
        rgbShiftPass.enabled = !rgbShiftPass.enabled;
        console.log('🎨 RGB Shift effect:', rgbShiftPass.enabled ? 'ENABLED' : 'DISABLED');
    }
}

// Update RGB shift effect with gamepad d-pad controls
function updateRGBShiftWithGamepad() {
    if (!rgbShiftPass) return;

    let updated = false;

    // D-pad controls for RGB shift
    if (window.gamepadState.dpadLeft) {
        params.rsx = Math.max(0, params.rsx - 0.001);
        updated = true;
        console.log('🎮 RGB Shift Amount:', params.rsx);
    }
    if (window.gamepadState.dpadRight) {
        params.rsx = Math.min(1, params.rsx + 0.001);
        updated = true;
        console.log('🎮 RGB Shift Amount:', params.rsx);
    }
    if (window.gamepadState.dpadUp) {
        params.rsy = Math.max(0, params.rsy - 0.01);
        updated = true;
        console.log('🎮 RGB Shift Angle:', params.rsy);
    }
    if (window.gamepadState.dpadDown) {
        params.rsy = Math.min(1, params.rsy + 0.01);
        updated = true;
        console.log('🎮 RGB Shift Angle:', params.rsy);
    }

    if (updated) {
        rgbShiftPass.uniforms['amount'].value = params.rsx;
        rgbShiftPass.uniforms['angle'].value = params.rsy;
        rgbShiftPass.uniforms.amount.value = params.rsx;
    }
}

function render(time) {
	if (!animationPaused) {
		requestAnimationFrame(render);
	}

    handleGamepadInput();

	const t = (Date.now() - startTime) % 600000.0;

	if (store.state.canvasSize.width !== prevCanvasSize.width || store.state.canvasSize.height !== prevCanvasSize.height) {
		Object.assign(prevCanvasSize, store.state.canvasSize);
		onCanvasResize();
	}

	if(store.state.objectsToUpdate.length == 1) {
		controls.enabled = true;
		mapControls.enabled = false;
	}

    if (store.state.selectedSculpture) {
		if (!sculptureHasBeenSelected) {
			setInitialCameraPose()
			transitionAllSculpturesOpacity(0.0, 1000, store.state.selectedSculpture.id);
			transitionSculptureOpacity(store.state.selectedSculpture.id, 1.0, 1000);
			let selectedSculpturePose = new Vector3();

			selectedSculpturePose.setFromMatrixPosition(store.state.selectedObject.matrixWorld);
			cachedCameraPose = camera.position;
			tweenCameraToSculpturePosition(selectedSculpturePose);

			sculptureHasBeenSelected = true;
			mapControls.enabled = false;
			controls.enabled = true;
			cachedSelectedSculptureId = store.state.selectedSculpture.id;
		}
		sculptureHasBeenDeselected = false;
	} else {
		if (!sculptureHasBeenDeselected && store.state.sculpturesLoaded) {
			sculptureHasBeenDeselected = true;
			mapControls.enabled = true;
			controls.enabled = false;
			setInitialCameraPose();



            // if(store.state.initialCameraPose && firstTimeAtRoute) {
			// 	firstTimeAtRoute = false;
			// 	let pose = store.state.initialCameraPose;
			// 	camera.position.set(pose[0], pose[1],pose[2]);
			// 	controls.target.set(pose[0], 0, 0);
			// }
			transitionAllSculpturesOpacity(1.0, 1000, cachedSelectedSculptureId);
		} else if (sculptureHasBeenDeselected && cachedCameraPose) {
			// camera.position.y = 2;
			tweenObjectToValue(camera.position.y, store.state.initialCameraPose[1], (val) => camera.position.y = val);
			cachedCameraPose = null;
			// if(cachedSelectedSculpturePose){
				// tweenCameraToSculpturePosition(cachedSelectedSculpturePose);
			// }
		}
		sculptureHasBeenSelected = false;
	}

	let currTime = t * 0.001;
	store.state.objectsToUpdate.forEach(sculpture => {
		if (!store.state.selectedSculpture && !tweeningSculpturesOpacity && store.state.sculpturesLoaded){
			let fadeOpacity = calcSculptureOpacityForCameraDistance(sculpture);
			sculpture.setOpacity(fadeOpacity);
		}
		let uniforms = [];
		uniforms.push({ name: 'time', value: currTime, type: 'float' },
		{ name: 'resolution', value: new Vector2(canvasContainer.clientWidth, canvasContainer.clientHeight), type: 'vec2' });
		if (store.state.selectedSculpture && store.state.selectedSculpture.sculpture === sculpture) {
			if(sculpture && sculpture.uniforms) {
				window.uniforms = sculpture.uniforms;
				uniforms = uniforms.concat(sculpture.uniforms);
			}

		}
		sculpture.update(uniforms);
	});

	const objectsToRaycast = store.state.objectsToRaycast;
	if (objectsToRaycast.length > 0) {
		raycaster.setFromCamera(mouse, camera);
		const intersects = raycaster.intersectObjects(objectsToRaycast);
		if(intersects.length > 0) {
			const firstIntersect = intersects[0].object;
			firstIntersect.material.side = FrontSide;
			const frontSideIntersection = raycaster.intersectObjects(objectsToRaycast);
			if (frontSideIntersection.length > 0) {
				if(firstIntersect.material.uniforms) {
					firstIntersect.material.uniforms['mouse'].value = frontSideIntersection[0].point.sub(firstIntersect.position);
				}
			} else {
				if(firstIntersect.material.uniforms) {
					// firstIntersect.material.uniforms['mouse'].value = camera.position.clone().sub(firstIntersect.position);
				}
			}
			firstIntersect.material.side = BackSide;
			if (store.state.selectedSculpture === null && store.state.clickEnabled) {
				canvas.style.cursor = 'pointer';
				store.state.intersectedObject = firstIntersect;
			}
		} else {
			if (store.state.selectedSculpture === null) {
				canvas.style.cursor = 'auto';
				store.state.intersectedObject = null;
			}
		}
	}
	TWEEN.update(time);
	// if(player) player.update();
	// updateRemotePlayers();
	let enableKeys = store.state.selectedSculpture ? false : true;
	mapControls.enableKeys = true;
	controls.enableKeys = enableKeys;
    const speed = 0.05;
    // //console.log(gamepad)

    // controls.target.x += virtualCursor.x ;
    // controls.target.y += virtualCursor.y;
    // camera.position.x += virtualCursor.x;
    // camera.position.y += virtualCursor.y;
    // camera.position.x += virtualCursor.x;
    // camera.position.y += 23;
	if(controls.enabled) {

		controls.update();
	}
	if(mapControls.enabled) {
		mapControls.update();
	}

	// Handle bokeh depth-of-field rendering
	if (effectController.enabled) {
		// Handle depth calculation if enabled
		if (effectController.jsDepthCalculation) {
			raycaster.setFromCamera(mouse, camera);
			const intersects = raycaster.intersectObjects(scene.children, true);
			const targetDistance = (intersects.length > 0) ? intersects[0].distance : 1000;

			distance += (targetDistance - distance) * 0.03;
			const sdistance = smoothstep(camera.near, camera.far, distance);
			const ldistance = linearize(1 - sdistance);

			bokehPass.uniforms['focalDepth'].value = ldistance;
			effectController.focalDepth = ldistance;
		}

		renderer.clear();

		// Render scene into color texture
		renderer.setRenderTarget(rtTextureColor);
		renderer.clear();
		renderer.render(scene, camera);

		// Render depth into texture
		scene.overrideMaterial = materialDepth;
		renderer.setRenderTarget(rtTextureDepth);
		renderer.clear();
		renderer.render(scene, camera);
		scene.overrideMaterial = null;

		// Apply post-processing with bokeh
		composer.render();
	} else {
		// Normal rendering without bokeh
		composer.render();
	}

}

function piCreateMediaRecorder(isRecordingCallback, canvas)
{
	/*
    if (piCanMediaRecorded(canvas) == false)
    {
        return null;
    }
    */

    let options = {
		videoBitsPerSecond: 2500000,
		mimeType: 'video/webm;'
    };
	if (typeof MediaRecorder === 'undefined' || !navigator.getUserMedia) {
		console.error('recorder unsupported');
		return
	}
    var mediaRecorder = new MediaRecorder(canvas.captureStream(), options);
    // //console.log("videoBitsPerSecond: ", mediaRecorder.videoBitsPerSecond);
    var chunks = [];

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
            chunks.push(e.data);
        }
    };

    mediaRecorder.onstart = () => {
        isRecordingCallback( true );
    };

	mediaRecorder.onstop = (download) => {
		isRecordingCallback(false);
		let blob = new Blob(chunks, options);

		chunks = [];
		if (download) {
			let videoURL = window.URL.createObjectURL(blob);
			let url = window.URL.createObjectURL(blob);
			let a = document.createElement("a");
			document.body.appendChild(a);
			a.style = "display: none";
			a.href = url;
			a.download = "capture.webm";
			a.click();
			window.URL.revokeObjectURL(url);
		}
		return blob;
	};

    return mediaRecorder;
}

function captureCanvasImage(callback, download) {
	return canvas.toBlob((blob) => {
		if(download) {
			let url = window.URL.createObjectURL(blob);
			let a = document.createElement("a");
			document.body.appendChild(a);
			a.style = "display: none";
			a.href = url;
			a.download = "capture.png";
			a.click();
			window.URL.revokeObjectURL(url);
		}
		callback(blob);
	}, 'image/png', 1.0);
}

function toggleScreenCapture(download) {
	if (!isCapturing) {
		mediaCap.start();
		isCapturing = true;
	} else {
		isCapturing = false;
		return mediaCap.stop(download);
	}
}

function keyPress(down, e) {
    //console.log("Key event:", event.key, "isTrusted:", event.isTrusted);

    if (e.target.nodeName === 'BODY') {
		// player.keyEvent(down, e);
	}
	if (e.altKey && down) {
		if (e.key === 'r' || e.key === '®') {
			toggleScreenCapture(true);
		}
	}

}

// Raycast to sculptures
function onMouseMove(event) {

	if(canvasContainer) {
		// mouse.x = ((event.clientX - canvasContainer.offsetLeft)  / canvasContainer.clientWidth) * 2 - 1;
		// mouse.y = -((event.clientY - canvasContainer.offsetTop) / canvasContainer.clientHeight ) * 2 + 1;
	}
}

// Handle mouse interaction for bokeh focus
function onPointerMove(event) {
	if (event.isPrimary === false || !bokehPass) return;

	const rect = canvas.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;

	if (bokehPass.uniforms['focusCoords']) {
		bokehPass.uniforms['focusCoords'].value.set(x / canvasContainer.clientWidth, 1 - (y / canvasContainer.clientHeight));
	}
}

// Utility functions for depth calculation
function linearize(depth) {
	const zfar = camera.far;
	const znear = camera.near;
	return -zfar * znear / (depth * (zfar - znear) - zfar);
}

function smoothstep(near, far, depth) {
	const x = saturate((depth - near) / (far - near));
	return x * x * (3 - 2 * x);
}

function saturate(x) {
	return Math.max(0, Math.min(1, x));
}

let tempIntersectedObject;
let mouseDownTime = 0;
function onMouseDown(event) {

	if(store.state.intersectedObject) {
		// tempIntersectedObject = store.state.intersectedObject;
		mouseDownTime = Date.now();
	} else {
		// store.state.selectedObject = null;
	}
}

function onMouseUp(event) {
	if (store.state.selectedObject || !store.state.clickEnabled) return;
	if (store.state.intersectedObject && store.state.intersectedObject === tempIntersectedObject) {
		mouseDownTime = Date.now() - mouseDownTime;
		if(mouseDownTime < 400) {
			if(router.currentRoute.name === 'examples' || router.currentRoute.name === 'gallery' ) {
				store.state.selectedObject = store.state.intersectedObject;
				selectedSculptureOpacity.opacity = 1.0;
				canvas.style.cursor = 'auto';
			}


		}
	} else {
		store.state.selectedObject = null;
	}
	tempIntersectedObject = null;
}

function tweenCameraToSculpturePosition(endTargetPos, duration=1000) {
	let camTarget;
	if (controls.enabled) {
		camTarget = new Vector3().copy(controls.target);
		mapControls.target = new Vector3().copy(controls.target);
	} else {
		camTarget = new Vector3().copy(mapControls.target);
		controls.target = new Vector3().copy(mapControls.target);
	}
	let tweenControlsTarget = new TWEEN.Tween(camTarget)
		.to(endTargetPos, duration)
		.easing(TWEEN.Easing.Quadratic.InOut)
		.onUpdate(function () {
			controls.target.set(camTarget.x, camTarget.y, camTarget.z);
			mapControls.target.set(camTarget.x, camTarget.y, camTarget.z);
		});
	let camPos = new Vector3().copy(camera.position);
	let endCamPos = new Vector3().copy(endTargetPos);
	endCamPos.z += 2;
	let tweenCamera = new TWEEN.Tween(camPos)
		.to(endCamPos, duration)
		.easing(TWEEN.Easing.Quadratic.InOut)
		.onUpdate(function () {
			camera.position.set(camPos.x, camPos.y, camPos.z);
		});
	tweenCamera.start();
	tweenControlsTarget.start();
}

function transitionSculptureOpacity(sculptureId, opacity, duration = 2000) {
	tweeningSculpturesOpacity = true;
	return new Promise(function(resolve, reject) {
		let sculp = store.state.objectsToUpdate.filter(obj => obj.mesh.name === sculptureId);
		if(sculp.length == 0) {
			reject();
		} else {
			sculp = sculp[0];
		}
		let fadeSculpture = new TWEEN.Tween(selectedSculptureOpacity)
			.to({opacity}, duration)
			.easing(TWEEN.Easing.Quadratic.InOut)
			.onUpdate(function() {
				sculp.setOpacity(selectedSculptureOpacity.opacity);
			})
			.onComplete(function() {
				tweeningSculpturesOpacity = false;
				resolve();
			});
		fadeSculpture.start();
	});
}

function tweenObjectToValue(obj, endValue, updateCallback, time = 1000) {
	return new Promise(function (resolve, reject) {
		let currState = { state: obj };
		let tween = new TWEEN.Tween(currState)
			.to({ 'state': endValue }, time)
			.easing(TWEEN.Easing.Quadratic.InOut)
			.onUpdate(() => {
				updateCallback(currState.state);
			})
			.onComplete(() => resolve());
		tween.start();
	});
}

function transitionAllSculpturesOpacity(opacity, duration = 2000, excludedSculptureId = null) {
	tweeningSculpturesOpacity = true;

	let objectsToFade = store.state.objectsToUpdate.filter(obj => calcSculptureOpacityForCameraDistance(obj) > 0);
	return new Promise(function(resolve, reject) {
		let fadeSculptures = new TWEEN.Tween(allSculpturesOpacity)
			.to({ opacity }, duration)
			.easing(TWEEN.Easing.Quadratic.InOut)
			.onUpdate(function () {
				objectsToFade.forEach(obj => {
					let fadeOpacity = calcSculptureOpacityForCameraDistance(obj);
					if(!(obj.opacity == 0 && opacity == 0)) {
						if (!excludedSculptureId && fadeOpacity) {
							obj.setOpacity(Math.min(allSculpturesOpacity.opacity, fadeOpacity));
						} else if (obj.mesh.name !== excludedSculptureId) {
							obj.setOpacity(Math.min(allSculpturesOpacity.opacity, fadeOpacity));
						}
					}
				});
			})
			.onComplete(function () {
				tweeningSculpturesOpacity = false;
				resolve();

			});
		fadeSculptures.start();
	});
}

function calcSculptureOpacityForCameraDistance(sculp) {
  let dist = sculp.mesh.position.distanceTo(camera.position);
  return Math.min(Math.max(0.0, window.fogDistance - dist * 0.5), 1.0);
}

function onCanvasResize() {
	if (canvasContainer) {
		const width = canvasContainer.clientWidth;
		const height = canvasContainer.clientHeight;

		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		composer.setSize(width, height);

		// Update bokeh render targets
		if (rtTextureDepth) rtTextureDepth.setSize(width, height);
		if (rtTextureColor) rtTextureColor.setSize(width, height);

		// Update bokeh uniforms
		if (bokehPass) {
			bokehPass.uniforms['textureWidth'].value = width;
			bokehPass.uniforms['textureHeight'].value = height;
		}

		windowHalfX = width / 2;
		windowHalfY = height / 2;
	}
}
window.onCanvasResize = onCanvasResize;
