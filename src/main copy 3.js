import firebase from 'firebase/compat/app';

// These imports load individual services into the firebase namespace.
import 'firebase/compat/auth';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import 'firebase/compat/app-check';

import { Scene, Color, PerspectiveCamera, Vector2, Vector3, Raycaster, HemisphereLight, TextureLoader, WebGLRenderer, FrontSide, BackSide } from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';

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

let renderer, controls, mapControls, canvas, canvasContainer;

const mouse = new Vector2();
const raycaster = new Raycaster();
const hemisphereLight = new HemisphereLight(0xFFFFFF, 0xFFFFFF);
const startTime = Date.now();
let prevCanvasSize = window.innerWidth/2;
let tweeningSculpturesOpacity = true;
let fogDistance = 200.0;
window.fogDistance = fogDistance;


function init() {
    handleGamepadInput()
	canvasContainer = document.querySelector('.canvas-container');
	renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: true});
	renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
	prevCanvasSize = { width: canvasContainer.clientWidth, height: canvasContainer.clientHeight };
    Object.assign(store.state.canvasSize, prevCanvasSize);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setClearColor( 0x000000, 0 );
	canvasContainer.appendChild(renderer.domElement);

	canvas = document.querySelector('canvas');
	canvas.setAttribute('tabindex', '0');
	canvas.setAttribute('powerPreference', 'high-performance');
	canvas.addEventListener('click', (event) => {
		event.target.focus();
	});


	// canvas.addEventListener('mousemove', onMouseMove, false);
    console.log("Gamepad:", navigator.getGamepads()[0]);

	mediaCap = piCreateMediaRecorder(() => console.log("capturing render"), canvas);
	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true; // Restore damping for smooth mouse controls
	controls.enablePan = false;
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

        console.log('Gamepads detected:', gamepads ? gamepads.length : 0, gamepad ? gamepad.id : 'none');

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
        console.log('🎮 GAMEPAD ACTIVE - Left:', window.gamepadState.leftStickX.toFixed(2), window.gamepadState.leftStickY.toFixed(2), 'Right:', window.gamepadState.rightStickX.toFixed(2), window.gamepadState.rightStickY.toFixed(2));

        // Visual feedback - temporarily change renderer clear color when gamepad is active
        if (Math.abs(window.gamepadState.leftStickX) > 0.1 || Math.abs(window.gamepadState.leftStickY) > 0.1 ||
            Math.abs(window.gamepadState.rightStickX) > 0.1 || Math.abs(window.gamepadState.rightStickY) > 0.1) {
            renderer.setClearColor(0x00ff00, 0.1); // Green tint when moving
        } else {
            renderer.setClearColor(0x000000, 0); // Back to black
        }
    } else {
        console.log('No gamepad detected');
        // Reset renderer clear color when no gamepad
        renderer.setClearColor(0x000000, 0);
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

    // Left Bumper (Decrease fog distance)
    if (window.gamepadState.leftBumper) {
        window.fogDistance = Math.max(10, window.fogDistance - 5);
        console.log('🎮 Fog distance:', window.fogDistance);
    }

    // Right Bumper (Increase fog distance)
    if (window.gamepadState.rightBumper) {
        window.fogDistance = Math.min(500, window.fogDistance + 5);
        console.log('🎮 Fog distance:', window.fogDistance);
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
			camera.position.y = 22;
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
		// raycaster.setFromCamera(mouse, camera);
		const intersects = raycaster.intersectObjects(objectsToRaycast);
		if(intersects.length > 0) {
			const firstIntersect = intersects[0].object;
			firstIntersect.material.side = FrontSide;
			const frontSideIntersection = raycaster.intersectObjects(objectsToRaycast);
			if (frontSideIntersection.length > 0) {
				if(firstIntersect.material.uniforms) {
					// firstIntersect.material.uniforms['mouse'].value = frontSideIntersection[0].point.sub(firstIntersect.position);
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


	renderer.render(scene, camera);

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
				// store.state.selectedObject = store.state.intersectedObject;
				// selectedSculptureOpacity.opacity = 1.0;
				// canvas.style.cursor = 'auto';
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
		// camTarget = new Vector3().copy(controls.target);
		// mapControls.target = new Vector3().copy(controls.target);
	} else {
		// camTarget = new Vector3().copy(mapControls.target);
		// controls.target = new Vector3().copy(mapControls.target);
	}

    console.log(camTarget);
	let tweenControlsTarget = new TWEEN.Tween(camTarget)
		.to(endTargetPos, duration)
		.onUpdate(function () {
			// controls.target.set(camTarget.x, camTarget.y, camTarget.z);
			// mapControls.target.set(camTarget.x, camTarget.y, camTarget.z);
		});
	let camPos = new Vector3().copy(camera.position);
	let endCamPos = new Vector3().copy(endTargetPos);
	endCamPos.z += 2;
	let tweenCamera = new TWEEN.Tween(camPos)
		.to(endCamPos, duration)
		.onUpdate(function () {
			camera.position.set(camPos.x, camPos.y, camPos.z);
		});
	// tweenCamera.start();
	// tweenControlsTarget.start();
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
			.onUpdate(function() {
				sculp.setOpacity(selectedSculptureOpacity.opacity);
			})
			.onComplete(function() {
				tweeningSculpturesOpacity = false;
				resolve();
			});
		// fadeSculpture.start();
	});
}

function tweenObjectToValue(obj, endValue, updateCallback, time = 1000) {
	return new Promise(function (resolve, reject) {
		let currState = { state: obj };
		let tween = new TWEEN.Tween(currState)
			.to({ 'state': endValue }, time)
			// .easing(TWEEN.Easing.Quadratic.InOut)
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
		camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
	}
}
window.onCanvasResize = onCanvasResize;
