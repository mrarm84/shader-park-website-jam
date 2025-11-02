import firebase from 'firebase/compat/app';

// These imports load individual services into the firebase namespace.
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import 'firebase/compat/app-check';

import { Scene, Quaternion, WebGLRenderTarget, HalfFloatType , UniformsUtils,ShaderMaterial, Color, PerspectiveCamera, Vector2, Vector3, Raycaster, HemisphereLight, TextureLoader, WebGLRenderer, FrontSide, BackSide, BufferGeometry, Line, LineDashedMaterial, CatmullRomCurve3, Group, Mesh, MeshBasicMaterial, IcosahedronGeometry, AdditiveBlending, SubtractiveBlending, MultiplyBlending } from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import * as GeometryUtils from 'three/addons/utils/GeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { BokehShader, BokehDepthShader } from 'three/addons/shaders/BokehShader2.js';
import { HalftoneShader } from 'three/addons/shaders/HalftoneShader.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { HueSaturationShader } from 'three/addons/shaders/HueSaturationShader.js';
import { BrightnessContrastShader } from 'three/addons/shaders/BrightnessContrastShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { CubeTexturePass } from 'three/addons/postprocessing/CubeTexturePass.js';
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
import {parseNumber} from "vue-js-modal/src/parser";
window.$store = store;


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
let audioEnabled = false;



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
window.gamepadButtonTouchPressed = false;
window.spinL2Triggered = false;
window.spinR2Triggered = false;
window.fractalL2Active = false;

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
const camera = new PerspectiveCamera(25, window.innerWidth / window.innerHeight, 0.5, 500);

window.camera = camera;

let renderer, controls, mapControls, canvas, canvasContainer, composer, renderPass, rgbShiftPass, filmPass, halftonePass, dotPass, afterimagePass;
// Camera mode params
window.icosaViewEnabled = false;
window.icosaVertices = null;
window.icosaIndex = 0;
window.normalCameraPose = null; // { position: Vector3, up: Vector3 }
window.normalCameraParams = null; // { fov, near, far }
window.icosaCameraParams = null; // { fov, near, far }
window.icosaHelper = null; // Mesh helper for icosahedron

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

// Expose bokeh controller globally for UI hooks
window.effectController = effectController;

// Make params globally accessible for dynamic tweaking
window.rgbShiftParams = params;

function enableAudio() {
    audioEnabled = true;
    // start audio context, analyser, etc.
}


// Blend options for halftone GUI and keyboard controls
const blendOptions = {
    'AdditiveBlending': AdditiveBlending,
    'MultiplyBlending': MultiplyBlending,
    'SubtractiveBlending': SubtractiveBlending
};

// Loading text display
let loadingTextVisible = false;


// Setup GUI controls for halftone blending
let halftoneGUI;
let halftoneController; // Make accessible for external sync

// Function to sync GUI controller with current halftonePass state
function syncHalftoneGUI() {
    if (!halftoneGUI || !halftoneController || !halftonePass) return;

    // Update enabled state
    halftoneController.enabled = halftonePass.enabled;

    // Update uniforms from current halftonePass
    if (halftonePass.uniforms) {
        if (halftonePass.uniforms['blending']) {
            halftoneController.shaderBlending = halftonePass.uniforms['blending'].value;
        }
        if (halftonePass.uniforms['radius']) {
            halftoneController.radius = halftonePass.uniforms['radius'].value;
        }
        if (halftonePass.uniforms['scatter']) {
            halftoneController.scatter = halftonePass.uniforms['scatter'].value;
        }
    }

    // Update GUI display
    halftoneGUI.controllers.forEach(controller => {
        if (controller.property === 'enabled') {
            controller.setValue(halftonePass.enabled);
        }
        if (controller.property === 'shaderBlending' && halftonePass.uniforms && halftonePass.uniforms['blending']) {
            controller.setValue(halftonePass.uniforms['blending'].value);
        }
        if (controller.property === 'radius' && halftonePass.uniforms && halftonePass.uniforms['radius']) {
            controller.setValue(halftonePass.uniforms['radius'].value);
        }
        if (controller.property === 'scatter' && halftonePass.uniforms && halftonePass.uniforms['scatter']) {
            controller.setValue(halftonePass.uniforms['scatter'].value);
        }
    });
}

function setupHalftoneGUI() {
    if (halftoneGUI) halftoneGUI.destroy();

    halftoneGUI = new GUI({
        title: 'BlendModes',
        // autoPlace: false
    });
    halftoneGUI.domElement.style.left = '1380px'; // Position to the right of halftone GUI

    // Position halftone GUI to the left of bokeh GUI
    halftoneGUI.domElement.style.position = 'absolute';
    halftoneGUI.domElement.style.top = '10px';

    halftoneController = {
        blendIndex: window.halftoneBlendIndex || 0,
        materialBlending: AdditiveBlending,
        blendMode: MultiplyBlending,
        shaderBlendingMode: 1,
        shaderBlending: halftonePass && halftonePass.uniforms && halftonePass.uniforms['blending'] ? halftonePass.uniforms['blending'].value : 1.0,
        radius: halftonePass && halftonePass.uniforms && halftonePass.uniforms['radius'] ? halftonePass.uniforms['radius'].value : 4,
        scatter: halftonePass && halftonePass.uniforms && halftonePass.uniforms['scatter'] ? halftonePass.uniforms['scatter'].value : 0,
        enabled: halftonePass ? halftonePass.enabled : false
    };

    const shaderBlendOptions = {
        'Linear (1)': 1,
        'Multiply (2)': 2,
        'Add (3)': 3,
        'Lighter (4)': 4,
        'Darker (5)': 5
    };

    const updateHalftoneBlending = function() {
        if (!halftonePass || !halftonePass.uniforms) return;

        // Create new ShaderMaterial with updated blending properties
        const newMaterial = new ShaderMaterial( {
            uniforms: halftonePass.uniforms,
            fragmentShader: HalftoneShader.fragmentShader,
            vertexShader: HalftoneShader.vertexShader,
            blending: halftoneController.materialBlending,
            blendMode: halftoneController.blendMode
        } );

        // Update halftonePass with new material
        halftonePass.material = newMaterial;

        // Update shader uniforms
        halftonePass.uniforms['blendingMode'].value = halftoneController.shaderBlendingMode;
        halftonePass.uniforms['blending'].value = halftoneController.shaderBlending;
        halftonePass.uniforms['radius'].value = halftoneController.radius;
        halftonePass.uniforms['scatter'].value = halftoneController.scatter;

        halftonePass.enabled = halftoneController.enabled;

        console.log(`GUI: Halftone - materialBlending: ${halftoneController.materialBlending}, blendMode: ${halftoneController.blendMode}, shaderBlending: ${halftoneController.shaderBlending}, shaderMode: ${halftoneController.shaderBlendingMode}`);
    };

    halftoneGUI.add(halftoneController, 'enabled').onChange(updateHalftoneBlending);
    halftoneGUI.add(halftoneController, 'materialBlending', blendOptions).onChange(updateHalftoneBlending);
    halftoneGUI.add(halftoneController, 'blendMode', blendOptions).onChange(updateHalftoneBlending);
    halftoneGUI.add(halftoneController, 'shaderBlendingMode', shaderBlendOptions).onChange(updateHalftoneBlending);

    // Add shader blending slider (controls the 'blending' uniform)
    halftoneGUI.add(halftoneController, 'shaderBlending', 0.0, 1.0, 0.01).onChange(updateHalftoneBlending);

    // Add radius and scatter controls
    halftoneGUI.add(halftoneController, 'radius', 0.1, 20.0, 0.1).onChange(updateHalftoneBlending);
    halftoneGUI.add(halftoneController, 'scatter', 0.0, 1.0, 0.01).onChange(updateHalftoneBlending);

    // Quick preset buttons
    halftoneGUI.add({ 'Additive+Additive': () => {
        halftoneController.materialBlending = AdditiveBlending;
        halftoneController.blendMode = AdditiveBlending;
        halftoneController.shaderBlending = 1.0;
        halftoneController.shaderBlendingMode = 1;
        updateHalftoneBlending();
        halftoneGUI.controllers.forEach(c => c.updateDisplay());
    }}, 'Additive+Additive');

    halftoneGUI.add({ 'Multiply+Multiply': () => {
        halftoneController.materialBlending = MultiplyBlending;
        halftoneController.blendMode = MultiplyBlending;
        halftoneController.shaderBlending = 1.0;
        halftoneController.shaderBlendingMode = 1;
        updateHalftoneBlending();
        halftoneGUI.controllers.forEach(c => c.updateDisplay());
    }}, 'Multiply+Multiply');

    updateHalftoneBlending();
}

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

    gui = new GUI({
        // autoPlace: false
    });

    // Position bokeh GUI to the right of halftone GUI
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '350px';
    gui.domElement.style.left = '1380px'; // Position to the right of halftone GUI

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

// Color-preserving dot shader
const DotColorShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'center': { value: new Vector2(0.5, 0.5) },
        'angle': { value: 0.0 },
        'scale': { value: 1.0 },
        'strength': { value: 0.8 }
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec2 center;
        uniform float angle;
        uniform float scale;
        uniform float strength;
        varying vec2 vUv;

        float pattern() {
            float s = sin( angle ), c = cos( angle );
            vec2 tex = vUv * scale - center;
            vec2 point = vec2( c * tex.x - s * tex.y, s * tex.x + c * tex.y ) * scale;
            return ( sin( point.x ) * sin( point.y ) ) * 0.5 + 0.5; // 0..1
        }

        void main() {
            vec4 color = texture2D( tDiffuse, vUv );
            float dots = pattern();
            vec3 shaded = color.rgb * (0.6 + 0.4 * dots);
            vec3 outColor = mix( color.rgb, shaded, clamp(strength, 0.0, 1.0) );
            gl_FragColor = vec4( outColor, color.a );
        }
    `
};

// Mirror shader (screen-space flip)
const MirrorAxisShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'mirrorX': { value: 0 },
        'mirrorY': { value: 0 }
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform int mirrorX;
        uniform int mirrorY;
        varying vec2 vUv;
        void main(){
            vec2 uv = vUv;
            if(mirrorX==1) uv.x = 1.0 - uv.x;
            if(mirrorY==1) uv.y = 1.0 - uv.y;
            gl_FragColor = texture2D(tDiffuse, uv);
        }
    `
};

const mouse = new Vector2();
const raycaster = new Raycaster();
const hemisphereLight = new HemisphereLight(0x000000, 0xFFFFFF);
const startTime = Date.now();
let prevCanvasSize = window.innerWidth/2;
let tweeningSculpturesOpacity = true;
let fogDistance = 200.0;
window.fogDistance = fogDistance;

// Audio reactivity state
let audioContext = null;
let analyser = null;
let microphone = null;
let dataArray = null;
let audioLevel = 0.0;
let audioInitialized = false;
let audioPhase = 0.0;
let audioAttack = 0.35; // faster attack
let audioDecay = 0.08;  // slower decay
let hueSatPass = null; // palette hue/saturation pass
let brightnessPass = null; // brightness/contrast pass
window.paletteState = { hue: 0.0, saturation: 0.0, brightness: 0.0, contrast: 0.0, hsvMode: false, rsBoost: 0.0 };
window.halftoneBlendIndex = 0; // cycle through blend modes on key presses
window.halftoneParams = {
    shape: 1,
    radius: 4,
    rotateR: Math.PI / 12,
    rotateB: Math.PI / 12 * 2,
    rotateG: Math.PI / 12 * 3,
    scatter: 0,
    greyscale: false,
    disable: false
};
let vignettePass = null; // vignette pass
let bloomPass = null; // bloom pass (third row)
let saoPass = null; // SAO pass (third row)
let cubeTexturePass = null; // CubeTexture pass (third row)
let dotColorPass = null; // Color-preserving dot pass
let mirrorPass = null; // Mirror pass
let mirrorState = { x: false, y: false };
window.audioModulationEnabled = false; // toggled via DS PS/Home button (16)
window.audioLevel = 0.0; // expose for shaders
window.audioGain = 2.0; // boost for audioLevel (adjustable)
window.rotateXEnabled = false; // toggle sculpture rotation on X
window.rotXAngle = 0.0;       // accumulated X rotation
window.prevR2Bin = -1;       // discrete bin for R2-driven bokeh randomization
window.bgMode = 1; // 0=black, 1=white (default), 2=random
// Keyboard state flags
window.keyboard = {
    pressed: new Set(),
    holdQ: false, holdW: false,
    paletteActive: new Set(),
    bokehBackup: null,
    focalBackup: null,
    lastFractalTime: 0
};

// Per-key palette constants (hue in -1..1, saturation in -1..1)
// Second row palette keys (A..;'")
window.paletteMap = {
    'a': { h: 0.33, s: 0.28, seed: 11 }, // greenish
    's': { h: 0.50, s: 0.26, seed: 13 }, // cyan
    'd': { h: 0.70, s: 0.24, seed: 17 }, // blue
    'f': { h: -0.33, s: 0.27, seed: 19 }, // magenta
    'g': { h: -0.18, s: 0.25, seed: 23 }, // purple
    // 'h' reserved for vignette toggle
    'j': { h: 0.16, s: 0.26, seed: 31 }, // yellow-green
    'k': { h: -0.70, s: 0.23, seed: 37 }, // red-magenta
    'l': { h: 0.70, s: 0.24, seed: 17  },
    ';': { h: -10.10, s: 0.24, seed: 43 },
    "'": { h: 20.00, s: 0.20, seed: 47 }
};

function _randFromSeed(seed) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function createAudioUI() {
    // Tiny preset button (top-left)
    if (!window.topControls) window.topControls = [];

    const btn = document.createElement('button');
    btn.textContent = '🎵';
    btn.title = 'Enable Audio Reactivity';
    btn.style.position = 'fixed';
    btn.style.top = '8px';
    btn.style.left = '8px';
    btn.style.width = '24px';
    btn.style.height = '24px';
    btn.style.fontSize = '14px';
    btn.style.lineHeight = '24px';
    btn.style.padding = '0';
    btn.style.border = '1px solid #ddd';
    btn.style.borderRadius = '6px';
    btn.style.background = '#fff';
    btn.style.cursor = 'pointer';
    btn.style.zIndex = '10010';
    btn.addEventListener('click', () => showAudioOverlay());
    document.body.appendChild(btn);
    // Auto-click the note icon after 1 second
    try { setTimeout(() => { try { btn.click(); } catch(e){} }, 1000); } catch(e){}
    window.topControls.push(btn);

    // 🔊 Volume Indicator
    const indicator = document.createElement('div');
    Object.assign(indicator.style, {
        position: 'fixed',
        top: '8px',
        left: '38px', // right of the button
        width: '6px',
        height: '24px',
        background: '#ccc',
        borderRadius: '3px',
        zIndex: '10010',
        transition: 'height 0.1s ease, background 0.1s ease'
    });
    document.body.appendChild(indicator);
    window.topControls.push(indicator);

    // Store reference globally or in a closure
    window.audioVolumeIndicator = indicator;

    // Rotate X toggle button next to indicator
    const rotBtn = document.createElement('button');
    rotBtn.textContent = 'rotX';
    rotBtn.title = 'Rotate sculpture on X';
    rotBtn.style.position = 'fixed';
    rotBtn.style.top = '8px';
    rotBtn.style.left = '52px';
    rotBtn.style.height = '24px';
    rotBtn.style.padding = '0 6px';
    rotBtn.style.border = '1px solid #ddd';
    rotBtn.style.borderRadius = '6px';
    rotBtn.style.background = window.rotateXEnabled ? '#43a047' : '#fff';
    rotBtn.style.color = window.rotateXEnabled ? '#fff' : '#333';
    rotBtn.style.cursor = 'pointer';
    rotBtn.style.zIndex = '10010';
    rotBtn.style.fontSize = '12px';
    rotBtn.addEventListener('click', () => {
        window.rotateXEnabled = !window.rotateXEnabled;
        rotBtn.style.background = window.rotateXEnabled ? '#43a047' : '#fff';
        rotBtn.style.color = window.rotateXEnabled ? '#fff' : '#333';
    });
    document.body.appendChild(rotBtn);
    window.topControls.push(rotBtn);

    // Free blur button: trigger delayed 1s blur immediately
    const blurBtn = document.createElement('button');
    blurBtn.textContent = 'blur';
    blurBtn.title = '1s blur pulse';
    blurBtn.style.position = 'fixed';
    blurBtn.style.top = '8px';
    blurBtn.style.left = '96px';
    blurBtn.style.height = '24px';
    blurBtn.style.padding = '0 6px';
    blurBtn.style.border = '1px solid #ddd';
    blurBtn.style.borderRadius = '6px';
    blurBtn.style.background = '#fff';
    blurBtn.style.color = '#333';
    blurBtn.style.cursor = 'pointer';
    blurBtn.style.zIndex = '10010';
    blurBtn.style.fontSize = '12px';
    blurBtn.addEventListener('click', () => triggerDelayedBlur(0, 1000));
    document.body.appendChild(blurBtn);
    window.topControls.push(blurBtn);

    // Header toggle button (hide/show site header)
    const hdrBtn = document.createElement('button');
    hdrBtn.textContent = 'hide';
    hdrBtn.title = 'Hide UI';
    hdrBtn.style.position = 'fixed';
    hdrBtn.style.top = '8px';
    hdrBtn.style.left = '142px';
    hdrBtn.style.height = '24px';
    hdrBtn.style.padding = '0 6px';
    hdrBtn.style.border = '1px solid #ddd';
    hdrBtn.style.borderRadius = '6px';
    hdrBtn.style.background = '#fff';
    hdrBtn.style.color = '#333';
    hdrBtn.style.cursor = 'pointer';
    hdrBtn.style.zIndex = '10010';
    hdrBtn.style.fontSize = '12px';
    hdrBtn.addEventListener('click', () => toggleAllUI());
    document.body.appendChild(hdrBtn);
    window.topControls.push(hdrBtn);

    // Edit Code button (top)
    // const editBtn = document.createElement('button');
    // editBtn.textContent = 'Edit';
    // editBtn.title = 'Edit Code';
    // editBtn.style.position = 'fixed';
    // editBtn.style.top = '8px';
    // editBtn.style.left = '184px';
    // editBtn.style.height = '24px';
    // editBtn.style.padding = '0 6px';
    // editBtn.style.border = '1px solid #ddd';
    // editBtn.style.borderRadius = '6px';
    // editBtn.style.background = '#fff';
    // editBtn.style.color = '#333';
    // editBtn.style.cursor = 'pointer';
    // editBtn.style.zIndex = '10010';
    // editBtn.style.fontSize = '12px';
    // editBtn.addEventListener('click', triggerTopEditCode);
    // document.body.appendChild(editBtn);

    // Hide header by default
    setHeaderVisible(false);
    window.uiHidden = true;

    // Random sculpture button
    // Add random sculpture button
    const rndBtn = document.createElement('button');
    rndBtn.textContent = 'rnd';
    rndBtn.title = 'Load random sculpture';
    rndBtn.style.position = 'fixed';
    rndBtn.style.top = '8px';
    rndBtn.style.left = '184px';
    rndBtn.style.height = '24px';
    rndBtn.style.padding = '0 6px';
    rndBtn.style.border = '1px solid #ddd';
    rndBtn.style.borderRadius = '6px';
    rndBtn.style.background = '#fff';
    rndBtn.style.color = '#333';
    rndBtn.style.cursor = 'pointer';
    rndBtn.style.zIndex = '10010';
    rndBtn.style.fontSize = '12px';
    rndBtn.addEventListener('click', () => window.loadRandomSculpture && window.loadRandomSculpture());
    document.body.appendChild(rndBtn);
    window.topControls.push(rndBtn);

    // Help icon button (top)
    const helpBtn = document.createElement('button');
    helpBtn.textContent = '?';
    helpBtn.title = 'Show keyboard/gamepad help';
    helpBtn.style.position = 'fixed';
    helpBtn.style.top = '8px';
    helpBtn.style.left = '226px';
    helpBtn.style.height = '24px';
    helpBtn.style.width = '24px';
    helpBtn.style.padding = '0';
    helpBtn.style.border = '1px solid #ddd';
    helpBtn.style.borderRadius = '6px';
    helpBtn.style.background = '#fff';
    helpBtn.style.color = '#333';
    helpBtn.style.cursor = 'pointer';
    helpBtn.style.zIndex = '10010';
    helpBtn.style.fontSize = '14px';
    helpBtn.addEventListener('click', () => showHelpModal());
    document.body.appendChild(helpBtn);
    window.topControls.push(helpBtn);

    // Background cycle button (black → white → random)
    const bgBtn = document.createElement('button');
    bgBtn.textContent = 'bg';
    bgBtn.title = 'Background: black → white → random';
    bgBtn.style.position = 'fixed';
    bgBtn.style.top = '8px';
    bgBtn.style.left = '252px';
    bgBtn.style.height = '24px';
    bgBtn.style.padding = '0 6px';
    bgBtn.style.border = '1px solid #ddd';
    bgBtn.style.borderRadius = '6px';
    bgBtn.style.background = '#fff';
    bgBtn.style.color = '#333';
    bgBtn.style.cursor = 'pointer';
    bgBtn.style.zIndex = '10010';
    bgBtn.style.fontSize = '12px';
    bgBtn.addEventListener('click', () => {
        try {
            window.bgMode = (typeof window.bgMode === 'number' ? window.bgMode : 1);
            window.bgMode = (window.bgMode + 1) % 3;
            applyBackground(window.bgMode);
        } catch(e) { console.error(e); }
    });
    document.body.appendChild(bgBtn);
    window.topControls.push(bgBtn);

	// Randomize Params button
	const rndPBtn = document.createElement('button');
	rndPBtn.textContent = 'rndP';
	rndPBtn.title = 'Randomize color/effect parameters';
	rndPBtn.style.position = 'fixed';
	rndPBtn.style.top = '8px';
	rndPBtn.style.left = '284px';
	rndPBtn.style.height = '24px';
	rndPBtn.style.padding = '0 6px';
	rndPBtn.style.border = '1px solid #ddd';
	rndPBtn.style.borderRadius = '6px';
	rndPBtn.style.background = '#fff';
	rndPBtn.style.color = '#333';
	rndPBtn.style.cursor = 'pointer';
	rndPBtn.style.zIndex = '10010';
	rndPBtn.style.fontSize = '12px';
	rndPBtn.addEventListener('click', () => { try { randomizeAllParams(); } catch(e) { console.error(e); } });
	document.body.appendChild(rndPBtn);
	window.topControls.push(rndPBtn);

    // Palette button (Photoshop-like controls)
    const palBtn = document.createElement('button');
    palBtn.textContent = '🎨';
    palBtn.title = 'Palette / Color Grading';
    palBtn.style.position = 'fixed';
    palBtn.style.top = '8px';
    palBtn.style.left = '330px';
    palBtn.style.height = '24px';
    palBtn.style.width = '28px';
    palBtn.style.padding = '0';
    palBtn.style.border = '1px solid #ddd';
    palBtn.style.borderRadius = '6px';
    palBtn.style.background = '#fff';
    palBtn.style.color = '#333';
    palBtn.style.cursor = 'pointer';
    palBtn.style.zIndex = '10010';
    palBtn.style.fontSize = '14px';
    palBtn.addEventListener('click', () => showPalettePanel());
    document.body.appendChild(palBtn);
    window.topControls.push(palBtn);
}
function updateAudioIndicator(level) {
    const indicator = window.audioVolumeIndicator;
    if (!indicator) return;

    const height = Math.min(24, Math.max(2, level * 24)); // scale to 2–24px
    indicator.style.height = `${height}px`;
    indicator.style.background = `rgb(${Math.floor(level * 255)}, 100, 150)`; // dynamic color
}

// Toggle header visibility (hide Shader Park header/nav)
function setHeaderVisible(visible) {
    const bars = document.querySelectorAll('.nav-bar, .nav-spacer');
    bars.forEach(el => { if (el) el.style.display = visible ? '' : 'none'; });
    window.headerHidden = !visible;
}

function applyBackground(mode) {
    try {
        if (!renderer) return;
        renderer.setClearAlpha(1);

        // Decide color
        let numeric = 0x000000; // default black
        if (mode === 0) {
            numeric = 0x000000; // black
        } else if (mode === 1) {
            numeric = 0xffffff; // white
        } else {
            numeric = randomBrightColor(); // random bright
        }
        const hex = '#' + ('000000' + numeric.toString(16)).slice(-6);

        // Renderer and canvas
        renderer.setClearColor(numeric, 1);
        if (renderer.domElement) renderer.domElement.style.backgroundColor = hex;

        // Page background
        try {
            document.documentElement.style.backgroundColor = hex;
            document.body.style.backgroundColor = hex;
        } catch(e) {}

        // Action bar background
        try {
            const actionBar = document.querySelector('.action-bar');
            if (actionBar) actionBar.style.background = hex;
        } catch(e) {}

        if (scene) scene.background = null;
    } catch(e) { console.error('applyBackground failed', e); }
}

function randomBrightColor() {
    const r = 64 + Math.floor(Math.random() * 192);
    const g = 64 + Math.floor(Math.random() * 192);
    const b = 64 + Math.floor(Math.random() * 192);
    return (r << 16) | (g << 8) | b;
}

// Smooth 180° camera spin around controls.target
function spinCamera180(clockwise = true, duration = 450, spin = 1) {
    if (!controls) return;
    const target = controls.target.clone();
    const startVec = camera.position.clone().sub(target);
    const axis = new Vector3(0, 1, 0);
    const delta = (clockwise ? -1*spin : spin) * Math.PI; // clockwise negative yaw
    const state = { t: 0 };
    new TWEEN.Tween(state)
        .to({ t: 1 }, duration)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
            const q = new Quaternion().setFromAxisAngle(axis, delta * state.t);
            const rotated = startVec.clone().applyQuaternion(q);
            camera.position.copy(target.clone().add(rotated));
            camera.lookAt(target);
        })
        .start();
}

// Compute icosahedron vertices on unit sphere
function computeIcosahedronVertices(scale = 1.0) {
    const t = (1 + Math.sqrt(5)) / 2; // golden ratio
    const verts = [
        new Vector3(-1,  t,  0), new Vector3( 1,  t,  0), new Vector3(-1, -t,  0), new Vector3( 1, -t,  0),
        new Vector3( 0, -1,  t), new Vector3( 0,  1,  t), new Vector3( 0, -1, -t), new Vector3( 0,  1, -t),
        new Vector3( t,  0, -1), new Vector3( t,  0,  1), new Vector3(-t,  0, -1), new Vector3(-t,  0,  1)
    ];
    // normalize and scale
    verts.forEach(v => v.normalize().multiplyScalar(scale));
    return verts;
}

// Smoothly tween camera position and perspective parameters
let _cameraTween = null;
function tweenCameraToConfig(targetPos, lookTarget, targetFov, targetNear, durationMs = 900) {
    try {
        if (_cameraTween) { try { _cameraTween.stop(); } catch(e){} _cameraTween = null; }
        const start = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            fov: camera.fov,
            near: camera.near
        };
        const end = {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            fov: targetFov,
            near: targetNear
        };
        _cameraTween = new TWEEN.Tween(start)
            .to(end, Math.max(100, durationMs))
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(() => {
                camera.position.set(start.x, start.y, start.z);
                camera.fov = start.fov;
                camera.near = start.near;
                camera.updateProjectionMatrix();
                camera.lookAt(lookTarget);
            })
            .onComplete(() => {
                camera.position.copy(targetPos);
                camera.fov = targetFov;
                camera.near = targetNear;
                camera.updateProjectionMatrix();
                camera.lookAt(lookTarget);
                _cameraTween = null;
            })
            .start();
    } catch(e) { console.error('tweenCameraToConfig failed', e); }
}

function ensureIcosaHelper(radius, target) {
    try {
        if (!window.icosaHelper) {
            const geo = new IcosahedronGeometry(radius, 0);
            const mat = new MeshBasicMaterial({ color: 0x88ccff, wireframe: true, transparent: true, opacity: 0.35 });
            const mesh = new Mesh(geo, mat);
            mesh.name = 'icosaHelper';
            mesh.position.copy(target);
            window.icosaHelper = mesh;
            scene.add(mesh);
        } else {
            // update existing
            const geo = new IcosahedronGeometry(radius, 0);
            window.icosaHelper.geometry.dispose();
            window.icosaHelper.geometry = geo;
            window.icosaHelper.position.copy(target);
        }
    } catch(e) { console.error('icosa helper failed', e); }
}

function removeIcosaHelper() {
    try {
        if (window.icosaHelper && window.icosaHelper.parent) {
            window.icosaHelper.parent.remove(window.icosaHelper);
        }
        window.icosaHelper = null;
    } catch(e) {}
}

// Roll camera around view axis while keeping target
function rollCamera(deltaRoll) {
    try {
        if (!controls) return;
        const target = controls.target.clone();
        const view = target.clone().sub(camera.position).normalize();
        const q = new Quaternion().setFromAxisAngle(view, deltaRoll);
        camera.up.applyQuaternion(q).normalize();
        camera.lookAt(target);
    } catch(e) { /* noop */ }
}

// Fractalize RGB aberration briefly (multi-iteration pulsing of amount/angle)
function fractalizeAberration(iterations = 5, stepMs = 60) {
    if (!rgbShiftPass || !rgbShiftPass.uniforms) return;
    const baseAmt = params.rsx;
    const baseAng = params.rsy;
    let i = 0;
    function step() {
        if (i >= iterations) {
            // restore
            try {
                params.rsx = baseAmt;
                params.rsy = baseAng;
                rgbShiftPass.uniforms['amount'].value = baseAmt;
                rgbShiftPass.uniforms.amount.value = baseAmt;
                rgbShiftPass.uniforms['angle'].value = baseAng;
            } catch(e) {}
            window.fractalL2Active = false;
            return;
        }
        const scale = Math.pow(0.5, i); // 1, 0.5, 0.25...
        const amt = baseAmt + baseAmt * 0.6 * scale;
        const ang = baseAng + (i * Math.PI / 6); // +30° per step
        try {
            params.rsx = amt;
            params.rsy = ang;
            rgbShiftPass.enabled = true;
            rgbShiftPass.uniforms['amount'].value = amt;
            rgbShiftPass.uniforms.amount.value = amt;
            rgbShiftPass.uniforms['angle'].value = ang;
        } catch(e) {}
        i++;
        setTimeout(step, stepMs);
    }
    step();
}

// Keyboard controls: momentary Q/W, toggles for A/S/D/F/G/H
function setupKeyboardControls() {
    if (window._keyboardSetup) return;
    window._keyboardSetup = true;
    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('keyup', handleKeyUp, { passive: true });
}

function handleKeyDown(e) {
    const key = normalizeKey(e);
    if (!key) return;
    if (window.keyboard.pressed.has(key)) return; // prevent repeats
    window.keyboard.pressed.add(key);

    const a = (window.audioModulationEnabled && audioInitialized) ? Math.max(0, Math.min(1, window.audioLevel || 0)) : 0.7;

    switch (key) {
        // Momentary holds
        case 'q': // Halftone hold
            if (halftonePass && halftonePass.uniforms) {
                window.keyboard.holdQ = true;
                halftonePass.enabled = true;
                if (halftonePass.uniforms['radius']) halftonePass.uniforms['radius'].value = 20.5 + a * 2.5;
                // setHalftoneScatter(10.5 + a);
                syncHalftoneGUI();
            }
            break;
        case 'w': // Film hold
            if (filmPass && filmPass.uniforms) {
                window.keyboard.holdW = true;
                filmPass.enabled = true;
                filmPass.uniforms['nIntensity'].value = 0.2 + 0.8 * a;
                filmPass.uniforms['sIntensity'].value = 0.05 + 0.25 * a;
                filmPass.uniforms['sCount'].value = 1024 + Math.floor(3072 * a);
                filmPass.uniforms['grayscale'].value = false;
            }
            break;
        case 'e': // RGB shift hold
            if (rgbShiftPass && rgbShiftPass.uniforms) {
                window.keyboard.holdE = true;
                rgbShiftPass.enabled = true;
                rgbShiftPass.uniforms['amount'].value = 0.02 + 0.12 * a;
                rgbShiftPass.uniforms.amount.value = 0.02 + 0.12 * a;
                rgbShiftPass.uniforms['angle'].value = audioPhase * 0.33;
            }
            break;
        case 'r': // Dot color hold
            if (dotColorPass && dotColorPass.uniforms) {
                window.keyboard.holdR = true;
                dotColorPass.enabled = true;
                dotColorPass.uniforms['angle'].value = a * Math.PI;
                dotColorPass.uniforms['scale'].value = 1.0 - 0.8 * a;
                dotColorPass.uniforms['strength'].value = 0.6 + 0.4 * a;
            }
            break;
        case 't': // Afterimage damp hold
            if (afterimagePass && afterimagePass.uniforms) {
                window.keyboard.holdT = true;
                afterimagePass.enabled = true;
                afterimagePass.uniforms['damp'].value = 2.94 - 0.12 * a;
            }
            break;
        case 'y': // Vignette hold
            if (vignettePass && vignettePass.uniforms) {
                window.keyboard.holdY = true;
                vignettePass.enabled = true;
                vignettePass.uniforms['offset'].value = 1.2;
                vignettePass.uniforms['darkness'].value = 3.2 + 0.6 * a;
            }
            break;
        case 'u': // Halftone hold (color)
            if (halftonePass && halftonePass.uniforms) {
                window.keyboard.holdU = true;
                halftonePass.enabled = true;

                // setHalftoneScatter(15.2 + 0.8 * a);
                syncHalftoneGUI();
            }
            break;
        case 'i': // Film hold (color)
            if (hueSatPass && hueSatPass.uniforms) {
                hueSatPass.enabled = true;
            }
            if (filmPass && filmPass.uniforms) {
                window.keyboard.holdI = true;
                filmPass.enabled = true;
                filmPass.uniforms['nIntensity'].value = 5.1 + 0.9 * a;
                filmPass.uniforms['sIntensity'].value = 5.55 + 0.35 * a;
                filmPass.uniforms['sCount'].value = 512 + Math.floor(4096 * a);
                filmPass.uniforms['grayscale'].value = false;
            }
            break;
        case 'o': // Hue/Sat wobble hold
            window.keyboard.holdO = true;
            if (hueSatPass && hueSatPass.uniforms) {
                hueSatPass.enabled = true;
            }
            break;
        case 'p': // Fractalize aberration burst once
            window.keyboard.holdP = true;
            {
                const now = performance.now();
                if (!window.keyboard.lastFractalTime || now - window.keyboard.lastFractalTime > 250) {
                    window.keyboard.lastFractalTime = now;
                    fractalizeAberration(6, 55);
                }
            }
            break;
        case '[': // quick CCW micro-spin + short blur
            niceBlurPulse(300, 150);
            spinCamera180(false, 250, 0.5);
            break;
        case ']': // quick CW micro-spin + short blur
            niceBlurPulse(300, 150);
            spinCamera180(true, 250, 0.5);
            break;
        case '\\': // combo glitch hold
            window.keyboard.holdBackslash = true;
            if (rgbShiftPass && rgbShiftPass.uniforms) rgbShiftPass.enabled = true;
            if (dotPass && dotPass.uniforms) dotPass.enabled = true;


            // setHalftoneScatter(5.5);

            break;

        // Second row: one-way enables (no toggle off)
        case 'a':
            if (halftonePass && halftonePass.uniforms) {
                halftonePass.enabled = true;
                if (halftonePass.uniforms['radius']) halftonePass.uniforms['radius'].value = 20.5 + a * 2.5;
                // setHalftoneScatter(10.5 + a);
                syncHalftoneGUI();
            }
        case 's':
            if (filmPass && filmPass.uniforms) {
                filmPass.enabled = true;
                filmPass.uniforms['nIntensity'].value = 0.35;
                filmPass.uniforms['sIntensity'].value = 0.08;
                filmPass.uniforms['sCount'].value = 2048;
                filmPass.uniforms['grayscale'].value = false;
            }
            break;
        case 'd':
            if (rgbShiftPass && rgbShiftPass.uniforms) {
                rgbShiftPass.enabled = true;
                rgbShiftPass.uniforms['amount'].value = 0.035;
                rgbShiftPass.uniforms.amount.value = 0.035;
                rgbShiftPass.uniforms['angle'].value = Math.PI * 0.1;
            }
            break;
        case 'f':
            if (dotPass && dotPass.uniforms) {
                dotPass.enabled = true;
                dotPass.uniforms['angle'].value = Math.PI / 6;
                dotPass.uniforms['scale'].value = 0.6;
            }
            break;
        case 'g':
            if (afterimagePass) afterimagePass.enabled = true;
            break;
        case 'h':
            // Do not enable bokeh from keyboard; reserved for R1 only
            // Optional: enable vignette instead for a subtle effect
            if (vignettePass && vignettePass.uniforms) {
                vignettePass.enabled = true;
                vignettePass.uniforms['offset'].value = 1.2;
                vignettePass.uniforms['darkness'].value = 1.35;
            }

            break;
        case 'k':
            // Afterimage only; do not touch bokeh
            if (halftonePass && halftonePass.uniforms) {
                window.keyboard.holdU = true;
                halftonePass.enabled = true;
                syncHalftoneGUI();

                // setHalftoneScatter(15.2 + 0.8 * a);
            }



            if (afterimagePass && afterimagePass.uniforms) afterimagePass.enabled = true;
            break;
        case '4': {
            // Cycle through blending and blendMode properties
            halftonePass.enabled = true;
            if (halftonePass && halftonePass.material && halftonePass.uniforms && halftonePass.uniforms['blendingMode']) {
                window.halftoneBlendIndex = (window.halftoneBlendIndex + 1) % 8;

                // Define different combinations of blending and blendMode properties
                const blendingCombos = [
                    { blending: AdditiveBlending, blendMode: AdditiveBlending, shaderMode: 1, desc: "Add+Add+Linear" },
                    { blending: AdditiveBlending, blendMode: MultiplyBlending, shaderMode: 2, desc: "Add+Mult+Multiply" },
                    { blending: MultiplyBlending, blendMode: AdditiveBlending, shaderMode: 3, desc: "Mult+Add+Add" },
                    { blending: MultiplyBlending, blendMode: MultiplyBlending, shaderMode: 4, desc: "Mult+Mult+Lighter" },
                    { blending: SubtractiveBlending, blendMode: AdditiveBlending, shaderMode: 5, desc: "Sub+Add+Darker" },
                    { blending: SubtractiveBlending, blendMode: MultiplyBlending, shaderMode: 1, desc: "Sub+Mult+Linear" },
                    { blending: AdditiveBlending, blendMode: SubtractiveBlending, shaderMode: 2, desc: "Add+Sub+Multiply" },
                    { blending: MultiplyBlending, blendMode: SubtractiveBlending, shaderMode: 3, desc: "Mult+Sub+Add" }
                ];

                const currentCombo = blendingCombos[window.halftoneBlendIndex];

                // Create new ShaderMaterial with updated blending properties
                const newMaterial = new ShaderMaterial( {
                    uniforms: halftonePass.uniforms,
                    fragmentShader: HalftoneShader.fragmentShader,
                    vertexShader: HalftoneShader.vertexShader,
                    blending: currentCombo.blending,
                    blendMode: currentCombo.blendMode
                } );

                // Update halftonePass with new material
                halftonePass.material = newMaterial;

                // Then update halftonePass object shader uniforms
                halftonePass.uniforms['blendingMode'].value = currentCombo.shaderMode;
                halftonePass.uniforms['blending'].value = 1.0;

                // Sync GUI controllers if they exist
                if (halftoneGUI && halftoneGUI.controllers) {
                    halftoneGUI.controllers.forEach(controller => {
                        if (controller.property === 'blending') {
                            controller.setValue(currentCombo.blending);
                        }
                        if (controller.property === 'blendMode') {
                            controller.setValue(currentCombo.blendMode);
                        }
                        if (controller.property === 'shaderBlendingMode') {
                            controller.setValue(currentCombo.shaderMode);
                        }
                    });
                }

                console.log(`Blend combo ${window.halftoneBlendIndex}: ${currentCombo.desc}`);
            }
            break;
        }
        case '5': {
            // Toggle loading text display

            break;
        }
        // Third row: content
        case 'z':
            // Generate lines set A (Hilbert dashed)
            try { generateLinesSetA(0xffffff, 0xff00ff); } catch(err) { console.error(err); }
            break;
        case 'x':
            // With Shift: mirror X, without: generate lines set B
            if (e.shiftKey) {
                mirrorState.x = true;
                if (mirrorPass && mirrorPass.uniforms) {
                    mirrorPass.enabled = true;
                    mirrorPass.uniforms['mirrorX'].value = mirrorState.x ? 1 : 0;
                    mirrorPass.uniforms['mirrorY'].value = mirrorState.y ? 1 : 0;
                }
            } else {
                try { generateLinesSetB(); } catch(err) { console.error(err); }
                // Add aggressive halftone/dot trails
                if (halftonePass && halftonePass.uniforms) {
                    halftonePass.enabled = true;
                    if (halftonePass.uniforms['greyscale']) halftonePass.uniforms['greyscale'].value = false;
                if (halftonePass.uniforms['radius']) halftonePass.uniforms['radius'].value = 2.4;
                    syncHalftoneGUI();
                    if (halftonePass.uniforms['blending']) halftonePass.uniforms['blending'].value = 1.0;
                }
                if (dotPass && dotPass.uniforms) {
                    dotPass.enabled = true;
                    dotPass.uniforms['angle'].value = Math.PI * 0.33;
                    dotPass.uniforms['scale'].value = 0.3;
                }
                if (afterimagePass && afterimagePass.uniforms) {
                    afterimagePass.enabled = true;
                    afterimagePass.uniforms['damp'].value = 0.78;
                }
            }
            break;
        case 'c':
            // With Shift: mirror Y, without: clear generated lines
            if (e.shiftKey) {
                mirrorState.y = true;
                if (mirrorPass && mirrorPass.uniforms) {
                    mirrorPass.enabled = true;
                    mirrorPass.uniforms['mirrorX'].value = mirrorState.x ? 1 : 0;
                    mirrorPass.uniforms['mirrorY'].value = mirrorState.y ? 1 : 0;
                }
            } else {
                try { clearGeneratedLines(); } catch(err) { console.error(err); }
                // Another "wtf" combo: strong RGB shift + rotated dots
                if (rgbShiftPass && rgbShiftPass.uniforms) {
                    rgbShiftPass.enabled = true;
                    rgbShiftPass.uniforms['amount'].value = 0.22;
                    if (rgbShiftPass.uniforms.amount) rgbShiftPass.uniforms.amount.value = 0.22;
                    rgbShiftPass.uniforms['angle'].value = Math.PI * 0.5;
                }
                if (dotPass && dotPass.uniforms) {
                    dotPass.enabled = true;
                    dotPass.uniforms['angle'].value = Math.PI * 0.5;
                    dotPass.uniforms['scale'].value = 0.25;
                }
                if (filmPass && filmPass.uniforms) {
                    filmPass.enabled = true;
                    filmPass.uniforms['nIntensity'].value = 0.6;
                    filmPass.uniforms['sIntensity'].value = 0.12;
                    filmPass.uniforms['sCount'].value = 3072;
                    filmPass.uniforms['grayscale'].value = false;
                }
            }
            break;
        case '1': {
            // Toggle icosahedron perspective positions around target
            const target = controls && controls.target ? controls.target.clone() : new Vector3(0,0,0);
            if (!window.normalCameraParams) {
                window.normalCameraParams = { fov: camera.fov, near: camera.near, far: camera.far };
            }
            if (!window.icosaCameraParams) {
                window.icosaCameraParams = { fov: 10, near: 0.1, far: camera.far };
            }
            if (!window.icosaVertices) {
                window.icosaVertices = computeIcosahedronVertices(1.0);
                window.icosaIndex = 0;
            }
            if (!window.icosaViewEnabled) {
                // enable: store pose and snap to nearest icosa vertex at current radius
                window.normalCameraPose = { position: camera.position.clone(), up: camera.up.clone() };
                const radius = camera.position.clone().sub(target).length();
                // choose next vertex
                const v = window.icosaVertices[window.icosaIndex % window.icosaVertices.length].clone().normalize().multiplyScalar(radius);
                window.icosaIndex++;
                camera.position.copy(target.clone().add(v));
                camera.up.set(0,1,0);
                camera.lookAt(target);
                // apply icosa camera params
                camera.fov = window.icosaCameraParams.fov;
                camera.near = window.icosaCameraParams.near;
                camera.updateProjectionMatrix();
                // helper mesh around target
                ensureIcosaHelper(radius, target);
                window.icosaViewEnabled = true;
            } else {
                // disable: restore
                if (window.normalCameraPose) {
                    camera.position.copy(window.normalCameraPose.position);
                    camera.up.copy(window.normalCameraPose.up);
                    camera.lookAt(target);
                }
                if (window.normalCameraParams) {
                    camera.fov = window.normalCameraParams.fov;
                    camera.near = window.normalCameraParams.near;
                    camera.updateProjectionMatrix();
                }
                removeIcosaHelper();
                window.icosaViewEnabled = false;
            }
            break;
        }
        case '2': {
            // Randomize FOV/near for both normal and icosa presets; apply active
            const randIn = (min, max) => min + Math.random() * (max - min);
            // randomize normal
            const nfov = Math.max(20, Math.min(100, randIn(30, 90)));
            const nnear = Math.max(0.02, Math.min(2.0, randIn(0.05, 1.0)));
            // randomize icosa
            const ifov = Math.max(25, Math.min(110, randIn(35, 100)));
            const inear = Math.max(0.02, Math.min(1.0, randIn(0.05, 0.5)));
            window.normalCameraParams = window.normalCameraParams || { fov: camera.fov, near: camera.near, far: camera.far };
            window.icosaCameraParams = window.icosaCameraParams || { fov: camera.fov, near: camera.near, far: camera.far };
            window.normalCameraParams.fov = nfov;
            window.normalCameraParams.near = nnear;
            window.icosaCameraParams.fov = ifov;
            window.icosaCameraParams.near = inear;
            if (window.icosaViewEnabled) {
                camera.fov = window.icosaCameraParams.fov;
                camera.near = window.icosaCameraParams.near;
            } else {
                camera.fov = window.normalCameraParams.fov;
                camera.near = window.normalCameraParams.near;
            }
            camera.updateProjectionMatrix();
                syncHalftoneGUI();
            break;
        }
        case 'v':
            // Shift+Z emulation: toggle both X and Y mirrors
            if (e.shiftKey) {
                mirrorState.x = true; mirrorState.y = true;
                if (mirrorPass && mirrorPass.uniforms) {
                    mirrorPass.enabled = true;
                    mirrorPass.uniforms['mirrorX'].value = mirrorState.x ? 1 : 0;
                    mirrorPass.uniforms['mirrorY'].value = mirrorState.y ? 1 : 0;
                }
            } else {
                if (afterimagePass) afterimagePass.enabled = true;
            }
            break;
        case 'b':
            halftonePulse(2.0, 0.7, 350, 350, 120);
            break;
        case 'n':
            dotPulse(Math.PI / 4, 0.5, 250, 250, 80);
            break;
        case 'm':
            filmPulse(0.5, 0.12, 2200, 220);
            break;
        case ',':
            halftonePulse(1.0, 0.9, 180, 420, 60);
            break;
        case '.':
            halftonePulse(0.8, 0.3, 240, 240, 0);
            break;
        case '/':
            // cinematic combo: Bloom + SAO (one-way enable)
            if (bloomPass) bloomPass.enabled = true;
            if (saoPass) saoPass.enabled = true;
            break;
        default: break;
    }
}

function handleKeyUp(e) {
    const key = normalizeKey(e);
    window.keyboard.pressed.delete(key);
    switch (key) {
        case 'q':
            if (window.keyboard.holdQ && halftonePass) {
                window.keyboard.holdQ = false;
                halftonePass.enabled = false;
                syncHalftoneGUI();

            }
            break;
        case 'w':
            if (window.keyboard.holdW && filmPass) {
                window.keyboard.holdW = false;
                filmPass.enabled = false;
            }
            break;
        case 'e':
            if (window.keyboard.holdE && rgbShiftPass && rgbShiftPass.uniforms) {
                window.keyboard.holdE = false;
                rgbShiftPass.uniforms['amount'].value = params.rsx;
                rgbShiftPass.uniforms.amount.value = params.rsx;
                rgbShiftPass.uniforms['angle'].value = params.rsy;
            }
            break;
        case 'r':
            if (window.keyboard.holdR && dotPass) {
                window.keyboard.holdR = false;
                dotPass.enabled = false;
            }
            break;
        case 't':
            if (window.keyboard.holdT && afterimagePass && afterimagePass.uniforms) {
                window.keyboard.holdT = false;
                afterimagePass.uniforms['damp'].value = 0.94;
                afterimagePass.enabled = false;
            }
            break;
        case 'y':
            if (window.keyboard.holdY && vignettePass) {
                window.keyboard.holdY = false;
                vignettePass.enabled = false;
            }
            break;
        case 'u':
            if (window.keyboard.holdU && halftonePass) {
                window.keyboard.holdU = false;
                // halftonePass.enabled = false;
            }
            break;
        case 'i':
            if (window.keyboard.holdI && filmPass) {
                window.keyboard.holdI = false;
                filmPass.enabled = false;
            }
            break;
        case 'o':
            if (window.keyboard.holdO) {
                window.keyboard.holdO = false;
                // disable hueSat only if no palettes active
                if (!(window.keyboard.paletteActive && window.keyboard.paletteActive.size > 0) && hueSatPass) {
                    hueSatPass.enabled = false;
                }
            }
            break;
        case '\\':
            if (window.keyboard.holdBackslash) {
                window.keyboard.holdBackslash = false;
                if (dotPass) dotPass.enabled = false;
                if (halftonePass) halftonePass.enabled = false;
            }
            break;
        default: break;
    }
}

function applyHeldKeyEffects() {
    const a = (window.audioModulationEnabled && audioInitialized) ? Math.max(0, Math.min(1, window.audioLevel || 0)) : 0.7;
    if (window.keyboard.holdQ && halftonePass && halftonePass.uniforms) {

        halftonePass.enabled = true;
        // if (halftonePass.uniforms['radius']) halftonePass.uniforms['radius'].value = 0.5 + a * 2.5;
        syncHalftoneGUI();
    }
    if (window.keyboard.holdW && filmPass && filmPass.uniforms) {
        filmPass.enabled = true;
        filmPass.uniforms['nIntensity'].value = 0.2 + 0.8 * a;
        filmPass.uniforms['sIntensity'].value = 0.05 + 0.25 * a;
        filmPass.uniforms['sCount'].value = 1024 + Math.floor(3072 * a);
        filmPass.uniforms['grayscale'].value = false;
    }
    if (window.keyboard.holdE && rgbShiftPass && rgbShiftPass.uniforms) {
        const amt = 0.02 + 0.12 * a * (0.7 + 0.3 * Math.abs(Math.sin(audioPhase * 1.7)));
        rgbShiftPass.enabled = true;
        rgbShiftPass.uniforms['amount'].value = amt;
        rgbShiftPass.uniforms.amount.value = amt;
        rgbShiftPass.uniforms['angle'].value = 0.3 + 0.7 * Math.sin(audioPhase * 0.5);
    }
    if (window.keyboard.holdR && dotPass && dotPass.uniforms) {
        dotPass.enabled = true;
        dotPass.uniforms['angle'].value = (Math.PI / 4) * (1 + Math.sin(audioPhase));
        dotPass.uniforms['scale'].value = 0.3 + 0.7 * (1 - a);
    }
    if (window.keyboard.holdT && afterimagePass && afterimagePass.uniforms) {
        afterimagePass.enabled = true;
        afterimagePass.uniforms['damp'].value = 0.94 - 0.12 * a;
    }
    if (window.keyboard.holdY && vignettePass && vignettePass.uniforms) {
        vignettePass.enabled = true;
        vignettePass.uniforms['offset'].value = 1.2;
        vignettePass.uniforms['darkness'].value = 1.0 + 0.7 * a;
    }
    if (window.keyboard.holdU && halftonePass && halftonePass.uniforms) {
        halftonePass.enabled = true;
        // if (halftonePass.uniforms['greyscale']) halftonePass.uniforms['greyscale'].value = false;
        // if (halftonePass.uniforms['radius']) halftonePass.uniforms['radius'].value = 0.2 + 2.8 * a;
        syncHalftoneGUI();
    }
    if (window.keyboard.holdI && filmPass && filmPass.uniforms) {
        filmPass.enabled = true;
        filmPass.uniforms['nIntensity'].value = 0.1 + 0.9 * a;
        filmPass.uniforms['sIntensity'].value = 0.05 + 0.35 * a;
        filmPass.uniforms['sCount'].value = 1024 + Math.floor(4096 * a);
        filmPass.uniforms['grayscale'].value = false;
    }
    if (window.keyboard.holdO && hueSatPass && hueSatPass.uniforms) {
        hueSatPass.enabled = true;
        const wobble = 0.08 * Math.sin(audioPhase * 0.6);
        hueSatPass.uniforms['hue'].value = wobble;
        hueSatPass.uniforms['saturation'].value = 0.08 * a;
    }
    if (window.keyboard.holdBackslash) {
        if (rgbShiftPass && rgbShiftPass.uniforms) {
            rgbShiftPass.enabled = true;
            const amt = 0.02 + 0.06 * a;
            rgbShiftPass.uniforms['amount'].value = amt;
            rgbShiftPass.uniforms.amount.value = amt;
            rgbShiftPass.uniforms['angle'].value = 0.2 + 0.8 * Math.sin(audioPhase * 0.4);
        }
        if (dotPass && dotPass.uniforms) {
            dotPass.enabled = true;
            dotPass.uniforms['angle'].value = (Math.PI / 6) * (1 + Math.sin(audioPhase * 1.3));
            dotPass.uniforms['scale'].value = 0.5 + 0.5 * (1 - a);
        }
        if (halftonePass && halftonePass.uniforms) {
            halftonePass.enabled = true;
            if (halftonePass.uniforms['greyscale']) halftonePass.uniforms['greyscale'].value = false;
            if (halftonePass.uniforms['radius']) halftonePass.uniforms['radius'].value = 0.6 + 1.8 * a;
        }
    }
}

function applyPaletteToggles() {
    if (!hueSatPass || !hueSatPass.uniforms) return;
    const active = window.keyboard.paletteActive ? Array.from(window.keyboard.paletteActive) : [];
    if (active.length === 0) {
        // If palette UI is driving hue/sat, keep it enabled
        const ps = window.paletteState || { hue: 0, saturation: 0, hsvMode: false };
        const uiActive = Math.abs(ps.hue) > 1e-4 || Math.abs(ps.saturation) > 1e-4 || ps.hsvMode;
        if (uiActive) {
            hueSatPass.enabled = true;
            const satMul = ps.hsvMode ? 1.35 : 1.0;
            hueSatPass.uniforms['hue'].value = ps.hue;
            hueSatPass.uniforms['saturation'].value = ps.saturation * satMul;
            return;
        } else {
            hueSatPass.enabled = false;
            // reset to neutral when disabled
            hueSatPass.uniforms['hue'].value = 0.0;
            hueSatPass.uniforms['saturation'].value = 0.0;
            return;
        }
    }
    let hue = 0.0;
    let sat = 0.0;
    for (let k of active) {
        const spec = window.paletteMap[k];
        if (!spec) continue;
        const baseJitter = (_randFromSeed(spec.seed) - 0.5) * 0.12; // +/-0.06 jitter
        const timeJitter = 0.02 * Math.sin(audioPhase * (0.5 + 0.07 * spec.seed));
        hue += (spec.h + baseJitter + timeJitter);
        // small audio influence on saturation
        const a = (window.audioModulationEnabled && audioInitialized) ? Math.max(0, Math.min(1, window.audioLevel || 0)) : 0.0;
        sat += (spec.s + 0.15 * a);
    }
    hue /= active.length;
    sat /= active.length;
    hue = Math.max(-1.0, Math.min(1.0, hue));
    sat = Math.max(-1.0, Math.min(1.0, sat));
    hueSatPass.enabled = true;
    hueSatPass.uniforms['hue'].value = hue;
    hueSatPass.uniforms['saturation'].value = sat;
    // light RGB shift blend to emphasize palette
    if (rgbShiftPass && rgbShiftPass.uniforms) {
        const add = Math.min(0.02, Math.abs(sat) * 0.02);
        const curr = rgbShiftPass.uniforms['amount'].value;
        rgbShiftPass.uniforms['amount'].value = Math.min(0.2, curr + add);
        rgbShiftPass.uniforms.amount.value = Math.min(0.2, curr + add);
    }
}

// removed halftone scatter helpers and blend cycling per latest request

function normalizeKey(e) {
    const raw = (e.key || '').toLowerCase();
    if (raw && raw !== 'dead') return raw;
    const code = e.code || '';
    switch (code) {
        case 'BracketLeft': return '[';
        case 'BracketRight': return ']';
        case 'Backslash': return '\\';
        default: return raw;
    }
}

// Small effect pulses (tween helpers)
function halftonePulse(targetRadius = 2.5, _ignored = 0.0, upMs = 300, downMs = 300, delayMs = 0) {
    if (!halftonePass || !halftonePass.uniforms) return;
    const hasR = !!halftonePass.uniforms['radius'];
    if (!hasR) return;
    halftonePass.enabled = true;
    const start = { r: halftonePass.uniforms['radius'].value };
    const peak = { r: targetRadius };
    const back = { r: start.r };
    const doDown = () => new TWEEN.Tween(peak).to(back, downMs).easing(TWEEN.Easing.Quadratic.InOut).onUpdate(() => {
        halftonePass.uniforms['radius'].value = peak.r;
    }).start();
    setTimeout(() => {
        new TWEEN.Tween(start).to(peak, upMs).easing(TWEEN.Easing.Quadratic.Out).onUpdate(() => {
            halftonePass.uniforms['radius'].value = start.r;
        }).onComplete(doDown).start();
    }, Math.max(0, delayMs));
}

function dotPulse(angleTarget = Math.PI / 3, scaleTarget = 0.5, upMs = 250, downMs = 250, delayMs = 0) {
    if (!dotColorPass || !dotColorPass.uniforms) return;
    dotColorPass.enabled = true;
    const start = {
        a: dotColorPass.uniforms['angle'].value,
        s: dotColorPass.uniforms['scale'].value
    };
    const peak = { a: angleTarget, s: scaleTarget };
    const back = { a: start.a, s: start.s };
    const doDown = () => new TWEEN.Tween(peak).to(back, downMs).easing(TWEEN.Easing.Quadratic.InOut).onUpdate(() => {
        dotColorPass.uniforms['angle'].value = peak.a;
        dotColorPass.uniforms['scale'].value = peak.s;
    }).start();
    setTimeout(() => {
        new TWEEN.Tween(start).to(peak, upMs).easing(TWEEN.Easing.Quadratic.Out).onUpdate(() => {
            dotColorPass.uniforms['angle'].value = start.a;
            dotColorPass.uniforms['scale'].value = start.s;
        }).onComplete(doDown).start();
    }, Math.max(0, delayMs));
}

function filmPulse(nIntensity = 0.45, sIntensity = 0.1, sCount = 2400, holdMs = 200) {
    if (!filmPass || !filmPass.uniforms) return;
    filmPass.enabled = true;
    const n0 = filmPass.uniforms['nIntensity'].value;
    const s0 = filmPass.uniforms['sIntensity'].value;
    const c0 = filmPass.uniforms['sCount'].value;
    filmPass.uniforms['nIntensity'].value = nIntensity;
    filmPass.uniforms['sIntensity'].value = sIntensity;
    filmPass.uniforms['sCount'].value = sCount;
    setTimeout(() => {
        filmPass.uniforms['nIntensity'].value = n0;
        filmPass.uniforms['sIntensity'].value = s0;
        filmPass.uniforms['sCount'].value = c0;
    }, Math.max(0, holdMs));
}

function showHelpModal() {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
        background: 'rgba(0,0,0,0.45)', zIndex: '10020', display: 'flex',
        alignItems: 'center', justifyContent: 'center'
    });
    const panel = document.createElement('div');
    panel.className = 'custom-modal-panel';
    Object.assign(panel.style, {
        background: '#fff', color: '#222', padding: '16px 18px', borderRadius: '8px',
        minWidth: '280px', maxWidth: '520px', boxShadow: '0 8px 22px rgba(0,0,0,0.25)'
    });
    panel.innerHTML = (
        '<div style="font-weight:600;margin-bottom:8px;">Controls</div>'+
        '<div style="font-size:13px;line-height:1.45">'+
        '<div><b>Q</b> — Halftone (hold, audio-reactive)</div>'+
        '<div><b>W</b> — Film grain (hold, audio-reactive)</div>'+
        '<div style="margin-top:6px"><b>A</b> — Toggle Halftone</div>'+
        '<div><b>S</b> — Toggle Film</div>'+
        '<div><b>D</b> — Toggle RGB Shift</div>'+
        '<div><b>F</b> — Toggle DotScreen</div>'+
        '<div><b>G</b> — Toggle Motion Blur (Afterimage)</div>'+
        '<div><b>H</b> — Toggle Bokeh</div>'+
        '<div style="margin-top:6px">Audio-reactivity affects Q/W intensity when enabled (🎵).</div>'+
        '</div>'
    );
    const close = document.createElement('button');
    close.textContent = 'Close';
    Object.assign(close.style, { marginTop: '10px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer' });
    close.addEventListener('click', () => document.body.removeChild(overlay));
    panel.appendChild(close);
    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
    document.body.appendChild(overlay);
}

function sendEnterKey() {
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    try {
        document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keydown', opts));
        document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent('keyup', opts));
        // Fallback: try document
        document.dispatchEvent(new KeyboardEvent('keydown', opts));
        document.dispatchEvent(new KeyboardEvent('keyup', opts));
        // Last resort: click a visible button labeled OK/Enter
        const btn = Array.from(document.querySelectorAll('button')).find(b => /^(ok|enter|confirm|start)$/i.test(b.textContent || ''));
        if (btn) btn.click();
    } catch(e) { /* noop */ }
}

function sendCanvasClick() {
    try {
        const el = (renderer && renderer.domElement) ? renderer.domElement : document.body;
        if (!el) return;
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const evtInit = { clientX: cx, clientY: cy, bubbles: true, cancelable: true, view: window };
        el.dispatchEvent(new PointerEvent('pointerdown', evtInit));
        el.dispatchEvent(new MouseEvent('mousedown', evtInit));
        if (el.focus) try { el.focus(); } catch(e){}
        el.dispatchEvent(new PointerEvent('pointerup', evtInit));
        el.dispatchEvent(new MouseEvent('mouseup', evtInit));
        el.dispatchEvent(new MouseEvent('click', evtInit));
    } catch(e) { /* noop */ }
}

function showPalettePanel() {
    try {
        const existing = document.querySelector('#palette-panel');
        if (existing) { existing.remove(); }
        const panel = document.createElement('div');
        panel.id = 'palette-panel';
        panel.className = 'custom-modal-panel';
        Object.assign(panel.style, {
            position: 'fixed', top: '40px', left: '8px', zIndex: '10020',
            background: '#fff', color: '#222', padding: '10px 12px', border: '1px solid #ddd',
            borderRadius: '8px', boxShadow: '0 8px 22px rgba(0,0,0,0.18)', width: '220px'
        });
        panel.innerHTML = `
            <div style="font-weight:600;margin-bottom:6px">Palette</div>
            <label style="display:block;font-size:12px;margin:6px 0 2px">Hue (-1..1)</label>
            <input id="pal-hue" type="range" min="-1" max="1" step="0.01" value="${window.paletteState.hue}">
            <label style="display:block;font-size:12px;margin:6px 0 2px">Saturation (-1..1)</label>
            <input id="pal-sat" type="range" min="-1" max="1" step="0.01" value="${window.paletteState.saturation}">
            <label style="display:block;font-size:12px;margin:6px 0 2px">Brightness (-1..1)</label>
            <input id="pal-bri" type="range" min="-1" max="1" step="0.01" value="${window.paletteState.brightness}">
            <label style="display:block;font-size:12px;margin:6px 0 2px">Contrast (-1..1)</label>
            <input id="pal-con" type="range" min="-1" max="1" step="0.01" value="${window.paletteState.contrast}">
            <div style="margin-top:6px;font-size:12px">
              <label><input id="pal-hsv" type="checkbox" ${window.paletteState.hsvMode ? 'checked' : ''}> HSV mode (stronger sat)</label>
            </div>
            <label style="display:block;font-size:12px;margin:6px 0 2px">RGB Shift boost (0..0.3)</label>
            <input id="pal-rs" type="range" min="0" max="0.3" step="0.005" value="${window.paletteState.rsBoost}">
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
                <button id="pal-close" style="border:1px solid #ddd;border-radius:6px;padding:4px 8px;cursor:pointer;background:#f7f7f7">Close</button>
            </div>
        `;
        document.body.appendChild(panel);
        const hue = panel.querySelector('#pal-hue');
        const sat = panel.querySelector('#pal-sat');
        const bri = panel.querySelector('#pal-bri');
        const con = panel.querySelector('#pal-con');
        const hsv = panel.querySelector('#pal-hsv');
        const rsb = panel.querySelector('#pal-rs');
        const apply = () => {
            window.paletteState.hue = parseFloat(hue.value);
            window.paletteState.saturation = parseFloat(sat.value);
            window.paletteState.brightness = parseFloat(bri.value);
            window.paletteState.contrast = parseFloat(con.value);
            window.paletteState.hsvMode = !!hsv.checked;
            window.paletteState.rsBoost = parseFloat(rsb.value);
            applyPaletteState();
        };
        [hue, sat, bri, con, hsv, rsb].forEach(el => el.addEventListener('input', apply));
        panel.querySelector('#pal-close').addEventListener('click', () => panel.remove());
    } catch(e) { console.error('palette UI failed', e); }
}

function applyPaletteState() {
    try {
        if (hueSatPass && hueSatPass.uniforms) {
            hueSatPass.enabled = true;
            // HSV mode exaggerates saturation a bit
            const satMul = window.paletteState.hsvMode ? 1.35 : 1.0;
            hueSatPass.uniforms['hue'].value = window.paletteState.hue;
            hueSatPass.uniforms['saturation'].value = window.paletteState.saturation * satMul;
        }
        if (brightnessPass && brightnessPass.uniforms) {
            brightnessPass.enabled = true;
            brightnessPass.uniforms['brightness'].value = window.paletteState.brightness;
            brightnessPass.uniforms['contrast'].value = window.paletteState.contrast;
        }
        if (rgbShiftPass && rgbShiftPass.uniforms) {
            const current = rgbShiftPass.uniforms['amount'].value;
            const boosted = Math.min(0.8, current + window.paletteState.rsBoost);
            rgbShiftPass.uniforms['amount'].value = boosted;
            if (rgbShiftPass.uniforms.amount) rgbShiftPass.uniforms.amount.value = boosted;
        }
    } catch(e) { console.error('applyPaletteState failed', e); }
}

function randomizeAllParams() {
    const rIn = (a, b) => a + Math.random() * (b - a);
    const rBool = (p = 0.5) => Math.random() < p;
    try {
        // Palette (Hue/Sat/Bri/Con + optional HSV)
        window.paletteState.hue = rIn(-1.0, 1.0);
        window.paletteState.saturation = rIn(-1.0, 1.0);
        window.paletteState.brightness = rIn(-0.4, 0.4);
        window.paletteState.contrast = rIn(-0.4, 0.4);
        window.paletteState.hsvMode = rBool(0.5);
        window.paletteState.rsBoost = rIn(0.0, 0.25);
        applyPaletteState();
        // Update palette UI sliders if open
        const ph = document.querySelector('#pal-hue');
        const ps = document.querySelector('#pal-sat');
        const pb = document.querySelector('#pal-bri');
        const pc = document.querySelector('#pal-con');
        const pm = document.querySelector('#pal-hsv');
        const pr = document.querySelector('#pal-rs');
        if (ph) ph.value = String(window.paletteState.hue);
        if (ps) ps.value = String(window.paletteState.saturation);
        if (pb) pb.value = String(window.paletteState.brightness);
        if (pc) pc.value = String(window.paletteState.contrast);
        if (pm) pm.checked = !!window.paletteState.hsvMode;
        if (pr) pr.value = String(window.paletteState.rsBoost);

        // RGB Shift
        if (rgbShiftPass && rgbShiftPass.uniforms) {
            rgbShiftPass.enabled = true;
            const amt = rIn(0.0, 0.35);
            rgbShiftPass.uniforms['amount'].value = amt;
            if (rgbShiftPass.uniforms.amount) rgbShiftPass.uniforms.amount.value = amt;
            rgbShiftPass.uniforms['angle'].value = rIn(0, Math.PI * 2);
        }
        // DotScreen
        if (dotPass && dotPass.uniforms) {
            dotPass.enabled = rBool(0.7);
            dotPass.uniforms['angle'].value = rIn(0, Math.PI);
            dotPass.uniforms['scale'].value = rIn(0.2, 1.0);
        }
        // Halftone
        if (halftonePass && halftonePass.uniforms) {
            halftonePass.enabled = true;
            if (halftonePass.uniforms['radius']) halftonePass.uniforms['radius'].value = rIn(0.2, 3.0);
            setHalftoneScatter(rIn(0.0, 0.1));

        }
        // Film
        if (filmPass && filmPass.uniforms) {
            filmPass.enabled = rBool(0.7);
            filmPass.uniforms['nIntensity'].value = rIn(0.0, 0.8);
            filmPass.uniforms['sIntensity'].value = rIn(0.0, 0.2);
            filmPass.uniforms['sCount'].value = Math.floor(rIn(512, 4096));
            filmPass.uniforms['grayscale'].value = false;
        }
        // Afterimage
        if (afterimagePass && afterimagePass.uniforms) {
            afterimagePass.enabled = rBool(0.8);
            afterimagePass.uniforms['damp'].value = rIn(0.7, 0.97);
        }
        // Vignette
        if (vignettePass && vignettePass.uniforms) {
            vignettePass.enabled = rBool(0.6);
            vignettePass.uniforms['offset'].value = rIn(1.0, 1.6);
            vignettePass.uniforms['darkness'].value = rIn(0.8, 2.0);
        }
        // SAO
        if (saoPass && saoPass.params) {
            saoPass.enabled = rBool(0.5);
            saoPass.params.saoBias = rIn(0.0, 1.0);
            saoPass.params.saoIntensity = rIn(0.0, 0.05);
            saoPass.params.saoScale = rIn(0.5, 2.0);
            saoPass.params.saoKernelRadius = Math.floor(rIn(8, 32));
            saoPass.params.saoMinResolution = 0;
        }
        // Bloom (toggle only; underlying params set at init)
        if (bloomPass) {
            bloomPass.enabled = rBool(0.5);
        }
        // Background
        if (rBool(0.6)) {
            applyBackground(2); // random bg
        }
        // Bokeh: randomize only if currently enabled; do not force enable to respect bumper-only rule
        try {
            if (effectController && effectController.enabled) {
                const prev = { enabled: effectController.enabled };
                effectController.fstop = rIn(0.5, 5.0);
                effectController.maxblur = rIn(0.0, 5.0);
                effectController.focalDepth = rIn(10.0, 100.0);
                applyBokehToShaderAndGUI();
                effectController.enabled = prev.enabled;
                if (bokehPass) bokehPass.enabled = prev.enabled;
            }
        } catch(e){}
    } catch(e) { console.error('randomizeAllParams failed', e); }
}

// Hide/show all UI controls (buttons, GUI panels, inputs, action bar)
function setControlsVisible(visible) {
    try {
        // Our top-left controls
        if (window.topControls) {
            window.topControls.forEach(el => {
                if (!el) return;
                // Keep the toggle button visible so user can restore
                if (el.textContent === 'hide' || el.textContent === 'show') return;
                el.style.display = visible ? '' : 'none';
            });
        }
        // lil-gui panels
        document.querySelectorAll('.lil-gui').forEach(el => el.style.display = visible ? '' : 'none');
        // Hide/show halftone GUI specifically
        if (halftoneGUI) {
            halftoneGUI.domElement.style.display = visible ? '' : 'none';
        }
        // Hide/show custom modal panels (palette, audio help, etc.)
        document.querySelectorAll('.custom-modal-panel').forEach(el => el.style.display = visible ? '' : 'none');
        // Inputs (sliders)
        document.querySelectorAll('input[type="range"]').forEach(el => el.style.display = visible ? '' : 'none');
        // Bottom action bar
        const actionBar = document.querySelector('.action-bar');
        if (actionBar) actionBar.style.display = visible ? '' : 'none';

        // Canvas container adjustments so no top gap remains
        const cc = document.querySelector('.canvas-container');
        if (cc) {
            if (!visible) {
                // Hiding UI: stretch canvas container to full viewport
                cc.style.setProperty('position', 'fixed', 'important');
                cc.style.setProperty('top', '0', 'important');
                cc.style.setProperty('left', '0', 'important');
                cc.style.setProperty('right', '0', 'important');
                cc.style.setProperty('bottom', '0', 'important');
                cc.style.setProperty('height', '100vh', 'important');
                cc.style.setProperty('width', '100%', 'important');
                cc.style.setProperty('margin', '0', 'important');
                cc.style.setProperty('padding', '0', 'important');
                document.documentElement.style.setProperty('margin', '0', 'important');
                document.documentElement.style.setProperty('padding', '0', 'important');
                document.body.style.setProperty('margin', '0', 'important');
                document.body.style.setProperty('padding', '0', 'important');
                document.documentElement.style.setProperty('overflow', 'hidden', 'important');
                document.body.style.setProperty('overflow', 'hidden', 'important');
                try { window.scrollTo(0, 0); } catch(e){}
            } else {
                // Showing UI: restore minimal constraints
                cc.style.setProperty('position', 'relative', 'important');
                cc.style.setProperty('height', '100%', 'important');
                cc.style.removeProperty('top');
                cc.style.removeProperty('left');
                cc.style.removeProperty('right');
                cc.style.removeProperty('bottom');
                cc.style.removeProperty('width');
                cc.style.removeProperty('margin');
                cc.style.removeProperty('padding');
                document.documentElement.style.removeProperty('overflow');
                document.body.style.removeProperty('overflow');
                document.documentElement.style.removeProperty('margin');
                document.documentElement.style.removeProperty('padding');
                document.body.style.removeProperty('margin');
                document.body.style.removeProperty('padding');
                // Enforce full-height chain and resize renderer/composer
                try { enforceCanvasFullHeight(); } catch(e){}
                try { onCanvasResize(); } catch(e){}
                try { window.dispatchEvent(new Event('resize')); } catch(e){}
            }
        }

    } catch(e) {
        console.error(e);
    }
}

function toggleAllUI() {
    const hide = !(window.uiHidden === true);
    // Only hide/show action bars
    // Header
    setHeaderVisible(!hide);
    // Other controls
    setControlsVisible(!hide);
    try {
        document.querySelectorAll('.action-bar, .actions-bar').forEach(el => {
            if (el) el.style.display = hide ? 'none' : '';
        });
    } catch(e) { console.error(e); }
    // Update toggle button text
    const toggleBtn = window.topControls && window.topControls.find(el => el && (el.textContent === 'hide' || el.textContent === 'show'));
    if (toggleBtn) {
        toggleBtn.textContent = hide ? 'show' : 'hide';
        toggleBtn.title = hide ? 'Show UI' : 'Hide UI';
    }
    window.uiHidden = hide;
}

// Trigger the same behavior as ActionBar's "Edit Code" button
function triggerTopEditCode() {
    try {
        // Prefer current sculpture by id
        const curr = store.state.currSculpture;
        if (curr && curr.id) {
            const match = store.state.objectsToUpdate.find(o => o && o.mesh && o.mesh.name === curr.id);
            if (match && match.mesh) {
                store.state.selectedObject = match.mesh;
                return;
            }
        }
        // Fallback: first object to update
        if (store.state.objectsToUpdate && store.state.objectsToUpdate.length > 0) {
            store.state.selectedObject = store.state.objectsToUpdate[0].mesh;
            return;
        }
        // Last resort: any mesh in scene
        const meshes = window.scene ? window.scene.children.filter(obj => obj.type === 'Mesh') : [];
        if (meshes && meshes.length > 0) store.state.selectedObject = meshes[0];
    } catch(e) {
        console.error('Failed to open editor from top button', e);
    }
}

function showAudioOverlay() {
    if (audioInitialized) return;
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10009';

    const panel = document.createElement('div');
    panel.style.background = '#fff';
    panel.style.borderRadius = '10px';
    panel.style.padding = '16px 18px';
    panel.style.minWidth = '260px';
    panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
    panel.innerHTML = '<div style="font-weight:600;margin-bottom:8px;">Enable Audio?</div><div style="font-size:13px;color:#555;margin-bottom:12px;">We\'ll use your mic for audio-reactive modulation.</div>';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.justifyContent = 'flex-end';

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.padding = '6px 10px';
    cancel.style.border = '1px solid #ddd';
    cancel.style.borderRadius = '6px';
    cancel.style.background = '#f7f7f7';
    cancel.addEventListener('click', () => document.body.removeChild(overlay));

    const enable = document.createElement('button');
    enable.textContent = 'OK';
    enable.style.padding = '6px 10px';
    enable.style.border = '1px solid #2e7d32';
    enable.style.borderRadius = '6px';
    enable.style.background = '#43a047';
    enable.style.color = '#fff';
    enable.addEventListener('click', async () => {
        try {
            await initAudio();
            document.removeEventListener('keydown', handleEnterKey);
            document.body.removeChild(overlay);
        } catch (e) {
            console.error('Audio init failed:', e);
            alert('Microphone access denied.');
        }
    });

    row.appendChild(cancel);
    row.appendChild(enable);
    panel.appendChild(row);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Focus OK button and allow pressing Enter to confirm
    try { enable.focus(); } catch(e){}
    function handleEnterKey(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            enable.click();
        }
    }
    document.addEventListener('keydown', handleEnterKey);
    // Ensure cleanup on cancel
    cancel.addEventListener('click', () => {
        document.removeEventListener('keydown', handleEnterKey);
    });
}
async function initAudio() {
    if (audioInitialized) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    microphone = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    microphone.connect(analyser);
    audioInitialized = true;

    // Start volume indicator loop
    function audioLoop() {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const level = sum / dataArray.length / 255; // normalize to 0.0–1.0

        updateAudioIndicator(level); // 🔊 update visual
        // 🔁 Pass to Shader Park


        requestAnimationFrame(audioLoop);

    }

    audioLoop();
}


function updateAudioLevel() {
    if (!audioInitialized || !analyser) return;
    analyser.getByteFrequencyData(dataArray);
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 255; // 0..1
        sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length); // 0..1
    // normalize + envelope (attack/decay)
    const gain = Math.max(0.1, Math.min(10, window.audioGain || 1));
    const target = Math.min(1, rms * gain);
    if (target > audioLevel) {
        audioLevel = audioLevel + (target - audioLevel) * audioAttack;
    } else {
        audioLevel = audioLevel + (target - audioLevel) * audioDecay;
    }
    window.audioLevel = audioLevel;
}

function getAudioModulation(multiplier = 0.5, useSin = true) {
    if (!window.audioModulationEnabled || !audioInitialized) return 1.0;
    const osc = useSin ? Math.sin(audioPhase) : Math.cos(audioPhase);
    return 1.0 + (osc * audioLevel * multiplier);
}


function init() {
    // handleGamepadInput()
	canvasContainer = document.querySelector('.canvas-container');
	renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: true});
	renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
	prevCanvasSize = { width: canvasContainer.clientWidth, height: canvasContainer.clientHeight };
    Object.assign(store.state.canvasSize, prevCanvasSize);
	renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearAlpha(1);
renderer.setClearColor(0xffffff, 1);
	canvasContainer.appendChild(renderer.domElement);

	// Auto-focus canvas by simulating a click shortly after load
	try { setTimeout(() => { try { sendCanvasClick(); } catch(e){} }, 500); } catch(e){}

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
	// bokehPass.renderToScreen = true; // Removed to allow proper composer chain with brightness/contrast

	// Film pass (grain/scanlines), initially disabled
	filmPass = new FilmPass(0.0, 0.0, 2048, false);
	filmPass.enabled = false;

	// Halftone pass (dots), initially disabled
	halftonePass = new HalftonePass(window.innerWidth, window.innerHeight, {
		radius: 12.0,
		scatter: 0.0,
		shape: 1,
		greyscale: false,

	});
    halftonePass.material = new ShaderMaterial( {
        blending: 0.5,
        blendMode: MultiplyBlending
    } );
    halftonePass.uniforms['greyscale'].value = false;

	halftonePass.enabled = false;

	// Dot screen pass, initially disabled
	dotPass = new DotScreenPass(new Vector2(0, 0), 0.0, 2.0);
	dotPass.enabled = false;

	// Color-preserving Dot pass (disabled by default)
	dotColorPass = new ShaderPass(DotColorShader);
	dotColorPass.enabled = false;

	// Afterimage (motion blur) pass, initially disabled; default damp 0.94
	afterimagePass = new AfterimagePass(0.94);
	afterimagePass.enabled = false;

	// Initialize bokeh render targets
	rtTextureDepth = new WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: HalfFloatType });
	rtTextureColor = new WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: HalfFloatType });

	// Set bokeh pass uniforms
	bokehPass.uniforms['tColor'].value = rtTextureColor.texture;
	bokehPass.uniforms['tDepth'].value = rtTextureDepth.texture;

	composer.addPass(rgbShiftPass);
	// Hue/Saturation pass for palette toggles
	hueSatPass = new ShaderPass(HueSaturationShader);
	hueSatPass.enabled = false;
	composer.addPass(hueSatPass);
	// Brightness/Contrast pass for final grading
	brightnessPass = new ShaderPass(BrightnessContrastShader);
	brightnessPass.enabled = false;
	if (brightnessPass.uniforms) {
		brightnessPass.uniforms['brightness'].value = 0.0;
		brightnessPass.uniforms['contrast'].value = 0.0;
	}
	composer.addPass(brightnessPass);
	// Mirror pass (screen-space flips)
	mirrorPass = new ShaderPass(MirrorAxisShader);
	mirrorPass.enabled = false;
	composer.addPass(mirrorPass);
	// Vignette pass (disabled by default)
	vignettePass = new ShaderPass(VignetteShader);
	vignettePass.enabled = false;
	if (vignettePass.uniforms) {
		vignettePass.uniforms['offset'].value = 1.2; // 1.0 is center
		vignettePass.uniforms['darkness'].value = 1.35; // >1 darkens edges
	}
	composer.addPass(vignettePass);

	// Third-row exclusive passes
	// Bloom
	bloomPass = new BloomPass(0.8, 25, 4.0, 256);
	bloomPass.enabled = false;
	composer.addPass(bloomPass);
	// SAO (ambient occlusion)
	saoPass = new SAOPass(scene, camera, false, true);
	saoPass.enabled = false;
	if (saoPass.params) {
		saoPass.params.saoBias = 0.5;
		saoPass.params.saoIntensity = 0.015;
		saoPass.params.saoScale = 1.0;
		saoPass.params.saoKernelRadius = 16;
		saoPass.params.saoMinResolution = 0;
	}
	composer.addPass(saoPass);
	// CubeTexture pass (only effective if a cube background exists)
	cubeTexturePass = new CubeTexturePass(camera, scene);
	cubeTexturePass.enabled = false;
	composer.addPass(cubeTexturePass);
	composer.addPass(filmPass);
	composer.addPass(halftonePass);
	composer.addPass(dotColorPass);
	composer.addPass(afterimagePass);
	composer.addPass(bokehPass);

	// Setup GUI controls for bokeh effect
	setupBokehGUI();

	// Setup GUI controls for halftone blending
	setupHalftoneGUI();


	// Apply initial background according to bgMode
	try { applyBackground(window.bgMode || 1); } catch(e){}

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

	// Audio UI (small button top-left)
	createAudioUI();
	setupKeyboardControls();

    // Helper globals
    window.headerHidden = true;
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
    buttonCircle: false,      // Button 1 - Deselect
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
        const activeGamepad = Array.from(gamepads).find(gp => gp);
        if (activeGamepad) {
            // console.log("Gamepad detected 2:", activeGamepad.id);
        } else {
            // console.log("No gamepad detected 2");
        }

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
                window.gamepadState.buttonCircle = gamepad.buttons[1] ? gamepad.buttons[1].pressed : false;
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
                window.gamepadState.buttonPs = gamepad.buttons[16] ? gamepad.buttons[16].pressed : false;



            }

            const rotateSpeed = 2.0; // Object rotation speed
            const moveSpeed = 0.5; // Camera movement speed

            // Get current selected object position for rotation center
            let rotationCenter = new Vector3(0, 0, 0);
            if (store.state.selectedSculpture && store.state.selectedObject) {
                rotationCenter.copy(store.state.selectedObject.position);
            }

            // Left stick: translate camera (strafe and forward/back) + map to color palette uniquely by (lx, ly)
            if (Math.abs(window.gamepadState.leftStickX) > 0.01 || Math.abs(window.gamepadState.leftStickY) > 0.01) {


                const forward = new Vector3();
                camera.getWorldDirection(forward);
                forward.y = 0; // horizontal plane for consistent motion
                forward.normalize();
                const right = new Vector3(-forward.z, 0, forward.x);
                const moveMod = getAudioModulation();
                const lsSpeed = moveSpeed / 80;
                const lx = window.gamepadState.leftStickX;
                const ly = window.gamepadState.leftStickY;


                console.log('🎮 GAMEPAD ACTIVE - Left:', params.rsy, window.gamepadState.leftStickX.toFixed(2), window.gamepadState.leftStickY.toFixed(2));

                camera.position.addScaledVector(right, -lx * lsSpeed * moveMod);
                camera.position.addScaledVector(forward, ly * lsSpeed * moveMod);

                // Unique color mapping from (lx, ly): hue from angle, saturation from radius, with audio wobble
                const r = Math.min(1, Math.sqrt(lx * lx + ly * ly));
                const ang = Math.atan2(ly, lx);
                let hue = ang / Math.PI; // -1..1
                const audioAmt = (window.audioModulationEnabled && audioInitialized) ? Math.max(0, Math.min(1, window.audioLevel || 0)) : 0.0;
                // wobble ensures distinctiveness across the disc
                const wobble = Math.sin((lx * 13.37 + ly * 9.91) + audioPhase * 0.4) * 0.18 * r;
                hue = Math.max(-1.0, Math.min(1.0, hue - wobble));
                let sat = Math.max(0.0, Math.min(0.4, r * (0.25 + 0.25 * audioAmt)));
                hueSatPass.enabled = true;
                if (hueSatPass && hueSatPass.uniforms) {
                    hueSatPass.enabled = true;
                    hueSatPass.uniforms['hue'].value =-hue;
                    hueSatPass.uniforms['saturation'].value = sat;
                }





                halftonePass.enabled = true;
                if (halftonePass && halftonePass.uniforms) {
                    halftonePass.enabled = true;
                    halftonePass.uniforms['blendingMode'].value = currentCombo.shaderMode;
                    halftonePass.uniforms['blending'].value = ly;

                    // Control radius via left stick X (lx)
                    const radiusValue = Math.max(1, Math.abs(lx) * 20.0); // 1 to 20.0 based on |lx|
                    halftonePass.uniforms['radius'].value = 12*LX;
syncHalftoneGUI()
                    // Update GUI radius controller to reflect the change
                    if (halftoneGUI && halftoneGUI.controllers) {
                        halftoneGUI.controllers.forEach(controller => {
                            if (controller.property === 'radius') {
                                controller.setValue(radiusValue);
                            }
                        });
                    }
                }
                if (rgbShiftPass && rgbShiftPass.uniforms) {
					const amt = 0.02 + r * 0.06;
                    rgbShiftPass.enabled = true;
					// base amount
					rgbShiftPass.uniforms['amount'].value = amt;
					if (rgbShiftPass.uniforms.amount) rgbShiftPass.uniforms.amount.value = amt;
					// add huge shift near edge without altering previous logic
					const huge = Math.max(0, r - 0.7) * 0.6; // ramps up strongly from 0.7..1.0
					const newAmt = Math.min(0.6, (rgbShiftPass.uniforms['amount'].value || amt) + huge);
					rgbShiftPass.uniforms['amount'].value = newAmt;
					if (rgbShiftPass.uniforms.amount) rgbShiftPass.uniforms.amount.value = newAmt;
                    rgbShiftPass.uniforms['angle'].value = ang;
                }
            }

            // Right stick: hold R3 to orbit yaw/pitch; otherwise strafe/forward
            if (Math.abs(window.gamepadState.rightStickX) > 0.01 || Math.abs(window.gamepadState.rightStickY) > 0.01) {
                if (window.gamepadState.buttonR3) {
                    // Custom orbit around controls.target for more predictable motion
                    const yaw = window.gamepadState.rightStickX * rotateSpeed * 0.03 * getAudioModulation();
                    const pitch = -window.gamepadState.rightStickY * rotateSpeed * 0.03 * getAudioModulation();
                    const target = (controls && controls.target) ? controls.target.clone() : new Vector3(0,0,0);
                    const offset = camera.position.clone().sub(target);
                    // Yaw around world up
                    const qYaw = new Quaternion().setFromAxisAngle(new Vector3(0,1,0), yaw);
                    offset.applyQuaternion(qYaw);
                    // Pitch around right axis derived from current offset
                    const rightAxis = new Vector3().crossVectors(new Vector3(0,1,0), offset).normalize();
                    if (rightAxis.lengthSq() > 1e-6) {
                        const qPitch = new Quaternion().setFromAxisAngle(rightAxis, pitch);
                        offset.applyQuaternion(qPitch);
                    }
                    camera.position.copy(target.clone().add(offset));
                    camera.lookAt(target);
                } else {
                    // Move camera horizontally and forward/back
                    const forward = new Vector3();
                    camera.getWorldDirection(forward);
                    forward.y = 0; // Keep movement horizontal
                    forward.normalize();
                    const right = new Vector3(-forward.z, 0, forward.x);
                    const moveMod = getAudioModulation();
                    camera.position.addScaledVector(right, -window.gamepadState.rightStickX * moveSpeed/10 * moveMod);
                    camera.position.addScaledVector(forward, window.gamepadState.rightStickY * moveSpeed/10 * moveMod);

                }
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


        // console.log('🎮 GAMEPAD ACTIVE - Left:', window.gamepadState.leftStickX.toFixed(2), window.gamepadState.leftStickY.toFixed(2), 'Right:', window.gamepadState.rightStickX.toFixed(2), window.gamepadState.rightStickY.toFixed(2));

    } else {
        // console.log('No gamepad detected');
        // Reset renderer clear color when no gamepad
            // renderer.setClearColor(0x000000, 1); // Green tint when moving
    }
    } catch (error) {
        // Silently handle gamepad errors to prevent console spam
        // console.warn('Gamepad input error:', error);
    }
}

// Helper function to handle button presses (only once per press)
function handleGamepadButtonPresses(gamepad) {
    if (!gamepad || !gamepad.buttons) return;

    // Button B/Circle (also send Enter key to the page)
    if (window.gamepadState.buttonCircle && !window.gamepadButtonBPressed) {
        window.gamepadButtonBPressed = true;
        // if (store.state.selectedSculpture) {
        //     store.state.selectedSculpture = null;
        //     store.state.selectedObject = null;
        //     console.log('🎮 Deselected sculpture');
        // }
        // First, synthesize a click on the canvas to ensure focus
        try { sendCanvasClick(); } catch(e) { console.error('Canvas click synth failed', e); }
        // Then send an Enter key press to activate focused UI
        try { sendEnterKey(); } catch(e) { console.error('Enter synth failed', e); }
    }
    if (!window.gamepadState.buttonCircle) {
        window.gamepadButtonBPressed = false;
    }

    // Button X (Square): Create dashed Hilbert spline lines
    if (window.gamepadState.buttonX && !window.gamepadButtonXPressed) {
        window.gamepadButtonXPressed = true;
        try { generateLinesSetA(); } catch(e) { console.error(e); }
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

    // Button Share → Trigger prolonged (5s) nice blur pulse instead of fullscreen
    if (window.gamepadState.buttonShare && !window.gamepadButtonSharePressed) {
        window.gamepadButtonSharePressed = true;
        niceBlurPulse(5000, 700);
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
        const objectPos = new Vector3();
        let haveTarget = false;

        // Prefer explicitly selected object (editor mode)
        if (store.state.selectedObject && typeof store.state.selectedObject.getWorldPosition === 'function') {
            store.state.selectedObject.getWorldPosition(objectPos);
            haveTarget = true;
        } else {
            // Fallback to current sculpture's mesh (viewer mode)
            const curr = store.state.currSculpture && store.state.currSculpture.sculpture && store.state.currSculpture.sculpture.mesh;
            if (curr && typeof curr.getWorldPosition === 'function') {
                curr.getWorldPosition(objectPos);
                haveTarget = true;
            } else if (controls && controls.target) {
                // Final fallback: current controls target
                objectPos.copy(controls.target);
                haveTarget = true;
            }
        }

        if (haveTarget) {
            camera.lookAt(objectPos);
            if (controls && controls.target) controls.target.copy(objectPos);
            if (mapControls && mapControls.target) mapControls.target.copy(objectPos);
            console.log('🎮 Camera centered on object');
        }
    }
    if (!window.gamepadState.buttonR3) {
        window.gamepadButtonR3Pressed = false;
    }

    // Button 16 (PS/Home) - Toggle audio modulation enable/disable
    const homePressed = gamepad.buttons[16] ? gamepad.buttons[16].pressed : false;
    if (homePressed && !window.gamepadButtonHomePressed) {
        window.gamepadButtonHomePressed = true;
        window.audioModulationEnabled = !window.audioModulationEnabled;
        console.log('🎵 Audio modulation:', window.audioModulationEnabled ? 'ENABLED' : 'DISABLED');
        try { randomizeAllParams(); } catch(e) { console.error(e); }
    }
    if (!homePressed) {
        window.gamepadButtonHomePressed = false;
    }

    // Button 17 (Touchpad) - Load random sculpture
    const touchPressed = gamepad.buttons[17] ? gamepad.buttons[17].pressed : false;
    if (touchPressed && !window.gamepadButtonTouchPressed) {
        window.gamepadButtonTouchPressed = true;
        // Invoke directly so it works outside the editor too
        loadRandomSculpture();
    }
    if (!touchPressed) {
        window.gamepadButtonTouchPressed = false;
    }
}

// Lines generation helpers
function clearGeneratedLines() {
    try {
        if (window.generatedLines && window.generatedLines.parent) {
            window.generatedLines.parent.remove(window.generatedLines);
            window.generatedLines = null;
        }
    } catch(e) {}
}

function ensureLinesParent() {
    const parent = (store.state.selectedObject)
        || (store.state.currSculpture && store.state.currSculpture.sculpture && store.state.currSculpture.sculpture.mesh)
        || scene;
    return parent || scene;
}

function generateLinesSetA(color = 0xffffff, color2 = 0xff00ff) {
    clearGeneratedLines();
    const parent = ensureLinesParent();
    const group = new Group();
    window.generatedLines = group;
    parent.add(group);

    // Parameters
    const recursion = 1;
    const subdivisions = 5;
    const lineCount = 4; // reduced ~3x
    const spread = 0.5;    // spacing between lines
    const kaleidoscope = true;

    // Generate base Hilbert curve with randomness
    const basePoints = GeometryUtils.hilbert3D(new Vector3(0, 0, 0), 25.0, recursion, 0, 1, 2, 3, 4, 5, 6, 7);
    const spline = new CatmullRomCurve3(basePoints);
    const samples = spline.getPoints(basePoints.length * subdivisions);

    // Add noise and wave offset
    samples.forEach((p, i) => {
        const t = i / samples.length;
        const offset = Math.sin(t * Math.PI * 4) * 0.3 * (params?.rsx ?? 1);
        p.x += (Math.random() - 0.5) * 2 + offset;
        p.y += (Math.random() - 0.5) * 2 + offset * (params?.rsy ?? 1);
        p.z += (Math.random() - 0.5) * 2;
    });

    // Create base geometry
    const geometrySpline = new BufferGeometry().setFromPoints(samples);
    const baseMaterial = new LineDashedMaterial({
        scale: 2,
        color: color,
        dashSize: 1,
        gapSize: 0.5
    });

    // Add original line
    const originalLine = new Line(geometrySpline, baseMaterial);
    originalLine.computeLineDistances();
    group.add(originalLine);

    // Clone and style lines
    for (let i = 1; i < lineCount; i++) {
        const clone = originalLine.clone();
        clone.material = baseMaterial.clone();

        // Positioning
        // const angle = (Math.PI * 2 * i) / lineCount;
        // clone.position.x = Math.cos(angle) * spread * i;
        // clone.position.y = Math.sin(angle) * spread * i;

        // Kaleidoscopic mirroring
        if (kaleidoscope && i % 2 === 0) {
            clone.scale.x *= -1;
            clone.scale.y *= -1;
        }

        // Color shift
        const hueShift = (i * 30) % 360;
        clone.material.color.setHSL(hueShift / 360, 1, 0.5);

        group.add(clone);
    }

}

function generateLinesSetB() {
    clearGeneratedLines();
    const parent = ensureLinesParent();
    const group = new Group();
    window.generatedLines = group;
    parent.add(group);

    // Lissajous-style curve set
    const curves = 1; // reduced ~3x
    for (let k = 0; k < curves; k++) {
        const pts = [];
        const a = 2 + k;
        const b = 3 + k;
        const delta = Math.PI / (k + 2);
        for (let i = 0; i <= 400; i++) {
            const t = i / 400 * Math.PI * 2;
            const x = Math.sin(a * t + delta) * 2.5 + k * 0.3;
            const y = Math.sin(b * t) * 2.5 + k * 0.2;
            const z = Math.cos((a + b) * t) * 2.5;
            pts.push(new Vector3(x, y, z));
        }
        const g = new BufferGeometry().setFromPoints(pts);
        const m = new LineDashedMaterial({ color: 0x88ccff, dashSize: 0.6, gapSize: 0.35 });
        const l = new Line(g, m);
        l.computeLineDistances();
        group.add(l);
    }
}

// Trail line generator (Hilbert-based with clones and color shifts)
function generateLinesTrail() {
    try {
        const recursion = 1;
        const subdivisions = 5;
        const lineCount = 4; // reduced ~3x
        const spread = 0.5;
        const kaleidoscope = true;
        const baseColor = new Color(0xff00ff);

        const parent = ensureLinesParent();
        if (!window.generatedLines) {
            window.generatedLines = new Group();
            parent.add(window.generatedLines);
        } else if (!window.generatedLines.parent) {
            parent.add(window.generatedLines);
        }

        const basePoints = GeometryUtils.hilbert3D(new Vector3(0, 0, 0), 25.0, recursion, 0, 1, 2, 3, 4, 5, 6, 7);
        const spline = new CatmullRomCurve3(basePoints);
        const samples = spline.getPoints(basePoints.length * subdivisions);

        const rsx = (typeof params !== 'undefined' && params && params.rsx) ? params.rsx : 1;
        const rsy = (typeof params !== 'undefined' && params && params.rsy) ? params.rsy : 1;
        samples.forEach((p, i) => {
            const t = i / samples.length;
            const offset = Math.sin(t * Math.PI * 4) * 0.3 * rsx;
            p.x += (Math.random() - 0.5) * 2 + offset;
            p.y += (Math.random() - 0.5) * 2 + offset * rsy;
            p.z += (Math.random() - 0.5) * 2;
        });

        const geometrySpline = new BufferGeometry().setFromPoints(samples);
        const baseMaterial = new LineDashedMaterial({
            scale: 2,
            color: baseColor,
            dashSize: 1,
            gapSize: 0.5,
            transparent: true,
            opacity: 1
        });

        const originalLine = new Line(geometrySpline, baseMaterial);
        originalLine.computeLineDistances();
        window.generatedLines.add(originalLine);

        for (let i = 1; i < lineCount; i++) {
            const clone = originalLine.clone();
            clone.material = baseMaterial.clone();
            const angle = (Math.PI * 2 * i) / lineCount;
            clone.position.x = Math.cos(angle) * spread * i;
            clone.position.y = Math.sin(angle) * spread * i;
            if (kaleidoscope && i % 2 === 0) {
                clone.scale.x *= -1;
                clone.scale.y *= -1;
            }
            const hueShift = (i * 30) % 360;
            clone.material.color.setHSL(hueShift / 360, 1, 0.5);
            window.generatedLines.add(clone);
        }
    } catch(e) { console.error('generateLinesTrail failed', e); }
}

function fetchSculpture(id) {
    return fetch(`/api/sculptures/${id}`)
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch sculpture');
            return res.json();
        });
}


function enableBokehFlash() {
    // Example: add a blur effect or overlay
    document.body.classList.add('bokeh-flash');
}

function disableBokehFlash() {
    document.body.classList.remove('bokeh-flash');
}

function applyShaderToScene(shaderSource) {
    // Replace this with your actual shader application logic
    const material = new ShaderMaterial({
        vertexShader: shaderSource.vertex,
        fragmentShader: shaderSource.fragment,
        uniforms: shaderSource.uniforms || {}
    });

    const mesh = scene.getObjectByName('mainMesh');
    if (mesh) mesh.material = material;
}
// Helper function to handle analog triggers
function handleGamepadTriggers(gamepad) {
    if (!gamepad || !gamepad.buttons) return;

    // Left Bumper (always disable bokeh, enable RGB shift)
    if (window.gamepadState.leftBumper && !window.gamepadButtonLeftBumperPressed) {
        window.gamepadButtonLeftBumperPressed = true;

        // Disable bokeh
        effectController.enabled = false;
        if (bokehPass) bokehPass.enabled = false;
        if (gui && gui.controllers) {
            gui.controllers.forEach(c => {
                if (c.property === 'enabled') c.setValue(false);
            });
        }

        // Enable RGB aberration with amount > 0
        if (rgbShiftPass) {
            rgbShiftPass.enabled = true;
            params.rsx = Math.max(params.rsx, 0.02);
            rgbShiftPass.uniforms['amount'].value = params.rsx;
            rgbShiftPass.uniforms.amount.value = params.rsx;
            rgbShiftPass.uniforms['angle'].value = params.rsy;

        }

        // Also enable AfterimagePass (motion blur) on L1
        if (afterimagePass) afterimagePass.enabled = true;
    }
    if (!window.gamepadState.leftBumper) {
        window.gamepadButtonLeftBumperPressed = false;
    }

    // Right Bumper (Toggle Bokeh effect and smooth-randomize parameters)
    if (window.gamepadState.rightBumper && !window.gamepadButtonRightBumperPressed) {
        window.gamepadButtonRightBumperPressed = true;
        effectController.enabled = !effectController.enabled;
        if (effectController.enabled) {
            smoothRandomizeBokeh(1000);
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

    // Left Trigger (L2): Film grain + RGB shift + bokeh focal (40-50)
    {
        const l2 = Math.max(0, Math.min(1, window.gamepadState.leftTrigger || 0));


        if (l2 > 0.05) {
            // Film grain
            if (filmPass && filmPass.uniforms) {
                filmPass.enabled = true;
                // Map l2 to noise intensity 0..0.8 and subtle scanlines 0..0.15
                filmPass.uniforms['nIntensity'].value = 1.8 * l2;
                filmPass.uniforms['sIntensity'].value = 1.15 * l2;
                filmPass.uniforms['sCount'].value = 1024 + Math.floor(l2 * 3072);
                filmPass.uniforms['grayscale'].value = false;
            }

            // Add DotScreen trail flavor on L2 as well
            if (dotPass && dotPass.uniforms) {
                dotPass.enabled = true;
                dotPass.uniforms['angle'].value = l2 * Math.PI; // 0..PI
                dotPass.uniforms['scale'].value = Math.max(10.2, 1.0 - l2 * 0.8); // 1..0.2
            }
            // RGB shift
            if (rgbShiftPass) {
                const amt = 0.02 + l2 * 0.08;
                params.rsx = amt;
                rgbShiftPass.enabled = true;
                rgbShiftPass.uniforms['amount'].value = amt;
                rgbShiftPass.uniforms.amount.value = amt;
                // keep current angle
            }
            // Trails: strengthen Afterimage "motion blur" with L2
            if (afterimagePass && afterimagePass.uniforms) {
                afterimagePass.enabled = true;
                const base = 0.94;
                const strong = Math.max(0.6, base - l2 * 0.5);
                afterimagePass.uniforms['damp'].value = strong;
            }
            // Bokeh focal depth 40..50
            effectController.focalDepth = 40 + l2 * 10;
            if (bokehPass && bokehPass.uniforms && bokehPass.uniforms['focalDepth']) {
                bokehPass.uniforms['focalDepth'].value = effectController.focalDepth;
            }

            // Edge-trigger fractal aberration on L2 press-in
            if (!window.fractalL2Active && l2 > 0.2) {
                window.fractalL2Active = true;
                fractalizeAberration(6, 55);
            }

            // Hard press triggers fast 180° rotation (counter-clockwise), with blur pulse
            if (l2 > 0.95 && !window.spinL2Triggered) {
                window.spinL2Triggered = true;
                niceBlurPulse(600, 300);
                if (afterimagePass && afterimagePass.uniforms) {
                    afterimagePass.enabled = true;
                    const prev = afterimagePass.uniforms['damp'].value;
                    afterimagePass.uniforms['damp'].value = 0.85;
                    setTimeout(() => { try { afterimagePass.uniforms['damp'].value = 0.94; } catch(e){} }, 500);
                }
                spinCamera180(false, 400, 1);
            }
        } else {
            if (filmPass) filmPass.enabled = false;
            if (halftonePass) halftonePass.enabled = false;
            window.spinL2Triggered = false;
        }
    }

    // Right Trigger (R2): toggle Bokeh on/off and reflect in GUI
    {
        const r2 = Math.max(0, Math.min(1, window.gamepadState.rightTrigger || 0));
        const pressed = r2 > 0.85;
        if (pressed && !window.gamepadR2TogglePressed) {
            window.gamepadR2TogglePressed = true;
            effectController.enabled = !effectController.enabled;
            if (bokehPass) bokehPass.enabled = effectController.enabled;
            if (gui && gui.controllers) {
                try {
                    gui.controllers.forEach(c => { if (c.property === 'enabled') c.setValue(effectController.enabled); });
                } catch(e){}
            }
            try { applyBokehToShaderAndGUI(); } catch(e){}
        }
        if (!pressed) window.gamepadR2TogglePressed = false;
    }

    // Update RGB shift uniforms with gamepad d-pad
    updateRGBShiftWithGamepad();
}

// Expose handlers globally so they are always invokable
window.handleGamepadInput = handleGamepadInput;
window.handleGamepadButtonPresses = handleGamepadButtonPresses;
window.handleGamepadTriggers = handleGamepadTriggers;

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

// Smoothly tween bokeh parameters to random targets over durationMs
function smoothRandomizeBokeh(durationMs = 1000) {
    // Generate target params (reuse ranges from randomizeBokehParameters)
    const target = {
        fstop: 0.5 + Math.random() * 20,
        maxblur: Math.random() * 5,
        focalDepth: Math.random() * 50 + 5,
        threshold: Math.random() * 0.5 + 0.25,
        gain: Math.random() * 95 + 5,
        bias: Math.random() * 2.5 + 0.25,
        fringe: Math.random() * 29.75 + 0.25,
        focalLength: Math.random() * 60 + 10,
        showFocus: Math.random() > 0.7 ? 1 : 0,
        manualdof: Math.random() > 0.8 ? 1 : 0,
        vignetting: Math.random() > 0.6 ? 1 : 0,
        depthblur: Math.random() > 0.7 ? 1 : 0,
        noise: Math.random() > 0.8 ? 1 : 0,
        pentagon: Math.random() > 0.9 ? 1 : 0
    };

    const state = {
        fstop: effectController.fstop,
        maxblur: effectController.maxblur,
        focalDepth: effectController.focalDepth,
        threshold: effectController.threshold,
        gain: effectController.gain,
        bias: effectController.bias,
        fringe: effectController.fringe,
        focalLength: effectController.focalLength,
        showFocus: effectController.showFocus ? 1 : 0,
        manualdof: effectController.manualdof ? 1 : 0,
        vignetting: effectController.vignetting ? 1 : 0,
        depthblur: effectController.depthblur ? 1 : 0,
        noise: effectController.noise ? 1 : 0,
        pentagon: effectController.pentagon ? 1 : 0
    };

    const applyState = () => {
        effectController.fstop = state.fstop;
        effectController.maxblur = state.maxblur;
        effectController.focalDepth = state.focalDepth;
        effectController.threshold = state.threshold;
        effectController.gain = state.gain;
        effectController.bias = state.bias;
        effectController.fringe = state.fringe;
        effectController.focalLength = state.focalLength;
        effectController.showFocus = state.showFocus > 0.5;
        effectController.manualdof = state.manualdof > 0.5;
        effectController.vignetting = state.vignetting > 0.5;
        effectController.depthblur = state.depthblur > 0.5;
        effectController.noise = state.noise > 0.5;
        effectController.pentagon = state.pentagon > 0.5;

        // Update shader uniforms (inline matChanger)
        for (const e in effectController) {
            if (bokehPass && bokehPass.uniforms && (e in bokehPass.uniforms)) {
                bokehPass.uniforms[e].value = effectController[e];
            }
        }
        if (bokehPass) {
            bokehPass.enabled = effectController.enabled;
            bokehPass.uniforms['znear'].value = camera.near;
            bokehPass.uniforms['zfar'].value = camera.far;
        }
        camera.setFocalLength(effectController.focalLength);

        // Reflect in GUI if present
        if (gui && gui.controllers) {
            gui.controllers.forEach(c => {
                if (c.property in effectController) {
                    c.setValue(effectController[c.property]);
                }
            });
        }
    };

    try {
        new TWEEN.Tween(state)
            .to(target, durationMs)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(applyState)
            .onComplete(applyState)
            .start();
    } catch (e) {
        // Fallback to instant randomization
        randomizeBokehParameters();
    }
}

// Trigger a delayed blur pulse: after delayMs, enable strong blur for durationMs, then disable
function triggerDelayedBlur(delayMs = 1000, durationMs = 1000) {
    setTimeout(() => {
        effectController.enabled = true;
        effectController.maxblur = 12.0;
        effectController.fstop = 1.0;
        // Push to shader immediately
        for (const e in effectController) {
            if (bokehPass && bokehPass.uniforms && (e in bokehPass.uniforms)) {
                bokehPass.uniforms[e].value = effectController[e];
            }
        }
        if (bokehPass) {
            bokehPass.enabled = true;
            bokehPass.uniforms['znear'].value = camera.near;
            bokehPass.uniforms['zfar'].value = camera.far;
        }
        if (gui && gui.controllers) {
            gui.controllers.forEach(c => {
                if (c.property === 'enabled') c.setValue(true);
                if (c.property === 'maxblur') c.setValue(effectController.maxblur);
                if (c.property === 'fstop') c.setValue(effectController.fstop);
            });
        }

        setTimeout(() => {
            effectController.enabled = false;
            if (bokehPass) bokehPass.enabled = false;
            if (gui && gui.controllers) {
                gui.controllers.forEach(c => {
                    if (c.property === 'enabled') c.setValue(false);
                });
            }
        }, durationMs);
    }, delayMs);
}

// Apply current effectController values to bokeh shader and GUI
function applyBokehToShaderAndGUI() {
    if (bokehPass && bokehPass.uniforms) {
        for (const e in effectController) {
            if (e in bokehPass.uniforms) {
                bokehPass.uniforms[e].value = effectController[e];
            }
        }
        bokehPass.uniforms['znear'].value = camera.near;
        bokehPass.uniforms['zfar'].value = camera.far;
        bokehPass.enabled = effectController.enabled;
    }
    camera.setFocalLength(effectController.focalLength);
    if (gui && gui.controllers) {
        gui.controllers.forEach(c => {
            if (c.property in effectController) {
                c.setValue(effectController[c.property]);
            }
        });
    }
}

// Prolonged (e.g., 5s) nice blur pulse to maximum pleasing values
function niceBlurPulse(durationMs = 5000, rampMs = 600) {
    const prev = {
        enabled: effectController.enabled,
        fstop: effectController.fstop,
        maxblur: effectController.maxblur,
        focalDepth: effectController.focalDepth,
        threshold: effectController.threshold,
        gain: effectController.gain,
        bias: effectController.bias,
        fringe: effectController.fringe,
        focalLength: effectController.focalLength,
        showFocus: effectController.showFocus ? 1 : 0,
        manualdof: effectController.manualdof ? 1 : 0,
        vignetting: effectController.vignetting ? 1 : 0,
        depthblur: effectController.depthblur ? 1 : 0,
        noise: effectController.noise ? 1 : 0,
        pentagon: effectController.pentagon ? 1 : 0
    };

    // Choose strong blur target
    const state = { ...prev };
    const target = {
        enabled: 1,
        fstop: 0.6,
        maxblur: 14.0,
        focalDepth: Math.max(5, prev.focalDepth),
        threshold: 0.8,
        gain: 40.0,
        bias: 2.5,
        fringe: 20.0,
        focalLength: prev.focalLength,
        showFocus: 0,
        manualdof: 0,
        vignetting: 0,
        depthblur: 0,
        noise: prev.noise ? 1 : 0,
        pentagon: prev.pentagon ? 1 : 0
    };

    const applyFromState = () => {
        effectController.enabled = !!state.enabled;
        effectController.fstop = state.fstop;
        effectController.maxblur = state.maxblur;
        effectController.focalDepth = state.focalDepth;
        effectController.threshold = state.threshold;
        effectController.gain = state.gain;
        effectController.bias = state.bias;
        effectController.fringe = state.fringe;
        effectController.focalLength = state.focalLength;
        effectController.showFocus = state.showFocus > 0.5;
        effectController.manualdof = state.manualdof > 0.5;
        effectController.vignetting = state.vignetting > 0.5;
        effectController.depthblur = state.depthblur > 0.5;
        effectController.noise = state.noise > 0.5;
        effectController.pentagon = state.pentagon > 0.5;
        applyBokehToShaderAndGUI();
    };

    // Ramp up
    try {
        new TWEEN.Tween(state)
            .to(target, rampMs)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(applyFromState)
            .onComplete(() => {
                // Hold, then ramp down and disable
                setTimeout(() => {
                    new TWEEN.Tween(state)
                        .to(prev, rampMs)
                        .easing(TWEEN.Easing.Quadratic.InOut)
                        .onUpdate(applyFromState)
                        .onComplete(() => {
                            effectController.enabled = !!prev.enabled;
                            applyBokehToShaderAndGUI();
                        })
                        .start();
                }, durationMs);
            })
            .start();
    } catch (e) {
        // fallback instant
        effectController.enabled = true;
        effectController.maxblur = 14.0;
        effectController.fstop = 0.6;
        applyBokehToShaderAndGUI();
        setTimeout(() => { effectController.enabled = !!prev.enabled; applyBokehToShaderAndGUI(); }, durationMs);
    }
}

// Load a random sculpture (same behavior as Editor's loadRandomSculpture)
// Exposed globally as window.loadRandomSculpture
async function loadRandomSculpture() {
    try {
        // Ensure list is populated
        let list = store.state.currentSculptures || [];
        if (!list || list.length === 0) {
            const fetched = await store.dispatch('fetchAllSculptures');
            if (Array.isArray(fetched) && fetched.length) list = fetched;
        }
        if (!list || list.length === 0) return;

        // Pick random entry
        const choice = list[Math.floor(Math.random() * list.length)];
        if (!choice || !choice.id) return;

        // Save previous code to revert on failure
        const prevCode = store.state.selectedSculpture ? store.state.selectedSculpture.shaderSource : null;

        // Brief blur cue
        triggerDelayedBlur(0, 800);

        // Fetch full sculpture + shader
        const sculpture = await store.dispatch('fetchSculpture', { id: choice.id });
        if (!sculpture || !sculpture.shaderSource) throw new Error('No shader code');

        // Apply code into editor/selection or viewer
        if (store.state.selectedSculpture) {
            store.state.selectedSculpture.shaderSource = sculpture.shaderSource;
            store.state.selectedSculpture.saved = false;
            store.commit('setUnsavedChanges', { [store.state.selectedSculpture.id]: false });
        } else if (store.state.currSculpture) {
            // In viewer mode, update current sculpture's shader to trigger recompile
            store.state.currSculpture.shaderSource = sculpture.shaderSource;
        }
        if (window.cm && typeof window.cm.setValue === 'function') {
            window.cm.setValue(sculpture.shaderSource);
        }
    } catch (e) {
        console.error('loadRandomSculpture failed:', e);
        // Nothing else to do; previous state remains
    } finally {
        // Ensure bokeh returns to prior state if it was off
        if (!effectController.enabled && bokehPass) bokehPass.enabled = false;
    }
}

// expose
window.loadRandomSculpture = loadRandomSculpture;

// Toggle RGB shift effect
function toggleRGBShift() {
    if (rgbShiftPass) {
        rgbShiftPass.enabled = true;
        console.log('🎨 RGB Shift effect: ENABLED');
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

    // D-pad controls for Halftone radius
    if (window.gamepadState.dpadUp && halftoneController) {
        halftoneController.radius = Math.min(20.0, halftoneController.radius + 2.0);
        updateHalftoneBlending();
        console.log('🎮 Halftone Radius:', halftoneController.radius);
    }
    if (window.gamepadState.dpadDown && halftoneController) {
        halftoneController.radius = Math.max(0.1, halftoneController.radius - 2.0);
        updateHalftoneBlending();
        console.log('🎮 Halftone Radius:', halftoneController.radius);
    }

    if (updated) {
        const mod = getAudioModulation(0.35, false);
        rgbShiftPass.uniforms['amount'].value = params.rsx * mod;
        rgbShiftPass.uniforms['angle'].value = params.rsy;
        rgbShiftPass.uniforms.amount.value = params.rsx * mod;
    }
}

function render(time) {
	if (!animationPaused) {
		requestAnimationFrame(render);
	}

    handleGamepadInput();

    // Update audio
    if (audioInitialized) {
        updateAudioLevel();
        audioPhase += 0.12 + audioLevel * 0.6;
    }

	// Keyboard-held momentary effects (audio-reactive)
	applyHeldKeyEffects();

	// Apply palette toggles via hue/saturation
	applyPaletteToggles();

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
        uniforms.push({ name: 'audioLevel', value: (audioLevel || 0.0), type: 'float' });
        uniforms.push({ name: 'time', value: currTime, type: 'float' });
        uniforms.push({ name: 'resolution', value: new Vector2(canvasContainer.clientWidth, canvasContainer.clientHeight), type: 'vec2' });
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
					// firstIntersect.material.uniforms['audioLevel'].value = 11.0;
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

	// Trail fading, gentle per-frame curvature, and occasional generation
	try {
		if (!window.generatedLines) {
			// lazily attach group to scene
			window.generatedLines = new Group();
			scene.add(window.generatedLines);
		}
		// fade + bend existing
		const toRemove = [];
		const bendTime = (Date.now() - startTime) * 0.001;
		window.generatedLines.children.forEach(line => {
			try {
				// slow fade for longer persistence
				if (line.material && typeof line.material.opacity === 'number') {
					line.material.opacity *= 0.98; // slower fade
					if (line.material.opacity < 0.01) toRemove.push(line);
				}
				// gentle curvature animation per frame
				if (line.geometry && line.geometry.getAttribute && line.geometry.getAttribute('position')) {
					const posAttr = line.geometry.getAttribute('position');
					if (!line.userData) line.userData = {};
					if (!line.userData.basePositions) {
						// snapshot base positions once
						line.userData.basePositions = new Float32Array(posAttr.array);
						line.userData.phase = Math.random() * Math.PI * 2;
						line.userData.amp = 0.25 + Math.random() * 0.35; // 0.25..0.6
						line.userData.freq = 0.3 + Math.random() * 0.5;   // 0.3..0.8
						line.userData.distTick = 0;
					}
					const base = line.userData.basePositions;
					const phase = line.userData.phase || 0.0;
					const amp = line.userData.amp || 0.3;
					const freq = line.userData.freq || 0.5;
					const tW = bendTime * freq;
					for (let i = 0; i < posAttr.count; i++) {
						const idx = i * 3;
						const bx = base[idx];
						const by = base[idx + 1];
						const bz = base[idx + 2];
						// layered sinusoidal offsets for smooth curvature
						posAttr.array[idx]     = bx + Math.sin(tW + i * 0.12 + phase) * amp * 0.35;
						posAttr.array[idx + 1] = by + Math.cos(tW * 0.9 + i * 0.15 + phase) * amp * 0.35;
						posAttr.array[idx + 2] = bz + Math.sin(tW * 0.7 + i * 0.10 + phase) * amp * 0.20;
					}
					posAttr.needsUpdate = true;
					// refresh dashed distances occasionally
					line.userData.distTick = (line.userData.distTick || 0) + 1;
					if (line.userData.distTick % 12 === 0 && typeof line.computeLineDistances === 'function') {
						line.computeLineDistances();
					}
				}
			} catch(e){}
		});
		toRemove.forEach(l => { try { window.generatedLines.remove(l); } catch(e){} });
		// randomly seed new trails
		if (Math.random() < 0.05) {
			generateLinesTrail();
		}
	} catch(e){}

    // Rotate selected sculpture on X when enabled (override)
    if (window.rotateXEnabled) {
        // Autofix: if no selectedObject, try to resolve it
        if (!store.state.selectedObject) {
            try {
                const curr = store.state.currSculpture;
                if (curr && curr.id) {
                    const match = store.state.objectsToUpdate.find(o => o && o.mesh && o.mesh.name === curr.id);
                    if (match && match.mesh) store.state.selectedObject = match.mesh;
                }
                if (!store.state.selectedObject && store.state.objectsToUpdate.length > 0) {
                    store.state.selectedObject = store.state.objectsToUpdate[0].mesh;
                }
                if (!store.state.selectedObject && window.scene) {
                    const meshes = window.scene.children.filter(obj => obj.type === 'Mesh');
                    if (meshes.length > 0) store.state.selectedObject = meshes[0];
                }
            } catch(e) {}
        }
        if (store.state.selectedObject) {
            const delta = 0.1 * (typeof getAudioModulation === 'function' ? getAudioModulation() : 1.0);
            window.rotXAngle += delta;
            store.state.selectedObject.rotation.x = window.rotXAngle;
        }
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
	// Normalize to renderer canvas for raycaster.setFromCamera(mouse, camera)
	if (renderer && renderer.domElement) {
		const rect = renderer.domElement.getBoundingClientRect();
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
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
