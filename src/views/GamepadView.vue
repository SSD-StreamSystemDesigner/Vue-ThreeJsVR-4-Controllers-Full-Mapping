<template>
  <canvas ref="canvasRef"></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import {BoxLineGeometry} from "three/examples/jsm/geometries/BoxLineGeometry"
import {VRButton} from "three/examples/jsm/webxr/VRButton"
import {XRControllerModelFactory} from "three/examples/jsm/webxr/XRControllerModelFactory"
import{ 
  Constants as MotionControllerConstants,
  fetchProfile,
  MotionController
} from "three/examples/jsm/libs/motion-controllers.module"

const DEFAULT_PROFILES_PATH = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles';
const DEFAULT_PROFILE = 'generic-trigger';

let scene = new THREE.Scene()
scene.background = new THREE.Color(0xaaaaaa)
let renderer
let controls

let canvasRef = ref();

let controllers, gamepadIndices
const buttonStates =  {}

const raycaster = new THREE.Raycaster()
const workingMatrix = new THREE.Matrix4()
const workingVector = new THREE.Vector3()

const clock = new THREE.Clock()

//Room and Highlighted objects
let room
let highlighted

const random = (min, max) => {
  return Math.random() * (max - min) + min;
}

let camera = new THREE.PerspectiveCamera(
  60, //vertical field of view
  window.innerWidth / window.innerHeight, //aspect ratio
  0.1, //near plane
  100 //far plane
);
camera.position.y = 0;
camera.position.z = 4;
camera.position.x=0;
scene.add(camera);


const ambientLight = new THREE.HemisphereLight( 0x606060, 0x404040);
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff)
dirLight.position.set(1, 1, 1).normalize()
scene.add(dirLight)

let loop = () => {

  const dt = clock.getDelta()
  let elapsedTime
  controls.update();

  if(renderer.xr.isPresenting){

    if(controllers){
      Object.values(controllers).forEach((value)=>{
        handleController(value.controller)
      })
    }
    if(elapsedTime === undefined){
      elapsedTime = 0
    }                
    elapsedTime += dt
    if(elapsedTime > 0.3){
      updateGamepadState()
      elapsedTime = 0
    } 
  }
    
  
  
  renderer.render(scene, camera);
};

let resizeCallback = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.updateProjectionMatrix();
};

//XR Controller Builder function
const buildController = (index, line, modelFactory) =>{
  const controller = renderer.xr.getController(index)

  controller.userData.selectPressed = false
  controller.userData.index = index

  if(line){
    controller.add(line.clone())
  }

  scene.add(controller)

  let grip
  if(modelFactory){
    grip = renderer.xr.getControllerGrip(index)
    grip.add(modelFactory.createControllerModel(grip))
    scene.add(grip)
  }

  return {controller, grip}
}


//CREATE BUTTON STATES
const createButtonStates = (components)=>{
  
  gamepadIndices = components

  Object.keys(components).forEach((key)=>{
    if(key.indexOf("touchpad") != -1 || key.indexOf("thumbstick") != -1){
      buttonStates[key] = {button: 0, xAxis:0, yAxis:0}
    }
    else{
      buttonStates[key] = 0
    }
  })
}

//UPDATE GAMEPAD STATE
const updateGamepadState = () => {
  const session = renderer.xr.getSession()
  console.log("session: ", session)

  const inputSource = session.inputSources[0]
  console.log("inputSource: ", inputSource)

  if(inputSource && inputSource.gamepad && gamepadIndices && buttonStates){
    const gamepad = inputSource.gamepad;
    console.log("gamepad: ",gamepad)
  
    try{
      Object.entries(buttonStates).forEach(([key, value]) => {
        const buttonIndex = gamepadIndices[key].button
        if(key.indexOf("touchpad") != -1 || key.indexOf("thumbstick") != -1){
          const xAxisIndex = gamepadIndices[key].xAxis
          const yAxisIndex = gamepadIndices[key].yAxis
          buttonStates[key].button  = gamepad.buttons[buttonIndex].value
          buttonStates[key].xAxis = gamepad.axes[xAxisIndex].toFixed(2)
          buttonStates[key].yAxis = gamepad.axes[yAxisIndex].toFixed(2)
        }
        else{
          buttonStates[key] = gamepad.buttons[buttonIndex].value
        }
      })
    }catch(e){
      console.warn("an error occured setting the ui???")
    }
  }
}

//XR Controller HandleController function
const handleController = (controller)=>{
  if(controller.userData.selectPressed){
    controller.children[0].scale.z = 10;

    workingMatrix.identity().extractRotation(controller.matrixWorld)

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)

    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(workingMatrix)

    const intersects = raycaster.intersectObjects(room.children)

    if(intersects.length>0){
      intersects[0].object.add(highlighted)
      highlighted.visible = true
      controller.children[0].scale.z = intersects[0].distance
      controller.userData.selected = intersects[0].object
    }
    else{
      highlighted.visible = false
    }
  }
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true,
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.render(scene, camera);

  renderer.xr.enabled = true

  renderer.setAnimationLoop(loop);

  document.body.appendChild(VRButton.createButton(renderer))

  controls = new OrbitControls(camera, canvasRef.value);
  controls.enableDamping = true;

  const modelFactory = new XRControllerModelFactory()
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints( [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)])
  const line = new THREE.Line(lineGeometry)
  line.scale.z = 0

  controllers = {}
  controllers.right = buildController(0, line, modelFactory)
  controllers.left = buildController(1, line, modelFactory)

  //XR Controllers
  const controller = renderer.xr.getController(0)

  controller.addEventListener("connected", (e)=>{
    const info = {}

    fetchProfile(e.data, DEFAULT_PROFILES_PATH, DEFAULT_PROFILE).then( ({profile, assetPath}) =>{
      console.log(JSON.stringify(profile))

      info.name = profile.profileId
      info.targetRayMode = e.data.targetRayMode

      Object.entries(profile.layouts).forEach( ([key,layout]) =>{
        const components = {}
        Object.values(layout.components).forEach((component)=>{
          components[component.rootNodeName]= component.gamepadIndices
        })
        info[key] = components
      })

      createButtonStates(info.right)
      console.log(JSON.stringify(info))
      //updateControllers(info)

      if(info.right !== undefined){
        const right = renderer.xr.getController(0)

        let trigger = false, squeeze = false;

        Object.keys(info.right).forEach((key)=>{
          if(key.indexOf("trigger") != -1){
            trigger = true
          }
          if(key.indexOf("squeeze") != -1){
            squeeze = true
          }
        })

        if(trigger){
          right.addEventListener("selectstart", ()=>{
            right.userData.selectPressed = true
          })
          right.addEventListener("selectend", ()=>{
            right.children[0].scale.z = 0
            right.userData.selectPressed = false
            right.userData.selected = undefined
          })
        }

        if(squeeze){
          right.addEventListener("squeezestart", ()=>{
            right.userData.squeezePressed = true
            if(right.userData.selected !== undefined){
              right.attach(right.userData.selected)
              right.userData.attachedObject = right.userData.selected
            }
          })
          right.addEventListener("squeezeend", ()=>{
            right.userData.squeezePressed = false
            if(right.userData.attachedObject !== undefined){
              room.attach(right.userData.attachedObject)
              right.userData.attachedObject = undefined
            }
          })
        }

        right.addEventListener("disconnected", ()=>{
          const index = right.userData.index

          if(controllers){
            const obj = (index == 0) ? controllers.right : controllers.left

            if(obj){
              if(obj.controller){
                const controller = obj.controller
                while(controller.children.length > 0){
                  controller.remove(controller.children[0])
                }
                scene.remove(controller)
              }
              if(obj.grip){
                scene.remove(obj.grip)
              }
            }
          }
        })
      }

      if(info.left !== undefined){
        const left = renderer.xr.getController(1)

        let trigger = false, squeeze = false;

        Object.keys(info.left).forEach((key)=>{
          if(key.indexOf("trigger") != -1){
            trigger = true
          }
          if(key.indexOf("squeeze") != -1){
            squeeze = true
          }
        })

        if(trigger){
          left.addEventListener("selectStart", ()=>{
            left.userData.selectPressed = true
          })
          left.addEventListener("selectend", ()=>{
            left.children[0].scale.z = 0
            left.userData.selectPressed = false
            left.userData.selected = undefined
          })
        }

        if(squeeze){
          left.addEventListener("squeezestart", ()=>{
            left.userData.squeezePressed = true
            if(left.userData.selected !== undefined){
              left.attach(left.userData.selected)
              left.userData.attachedObject = left.userData.selected
            }
          })
          left.addEventListener("squeezeend", ()=>{
            left.userData.squeezePressed = false
            if(left.userData.attachedObject !== undefined){
              room.attach(left.userData.attachedObject)
              left.userData.attachedObject = undefined
            }
          })
        }

        left.addEventListener("disconnected", ()=>{
          const index = left.userData.index

          if(controllers){
            const obj = (index == 0) ? controllers.right : controllers.left

            if(obj){
              if(obj.controller){
                const controller = obj.controller
                while(controller.children.length > 0){
                  controller.remove(controller.children[0])
                }
                scene.remove(controller)
              }
              if(obj.grip){
                scene.remove(obj.grip)
              }
            }
          }
        })
      }

    })
  })

  

  

  //Room 
  const radius = 0.08;
  room = new THREE.LineSegments(
    new BoxLineGeometry(6,6,6,10,10,10),
    new THREE.LineBasicMaterial({color: 0x808080})
  )

  room.geometry.translate(0,3,0)
  scene.add(room)

  const geometry = new THREE.IcosahedronBufferGeometry( radius, 2)

  //Spheres
  for(let i=0; i<200; i++){
    const object = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial({color: Math.random() * 0xFFFFFF}))
    object.position.x = random(-2,2)
    object.position.y = random(-2,2)
    object.position.z = random(-2,2)

    room.add(object)
  }

  //highlight object
  highlighted = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide})
  )

  highlighted.scale.set(1.2, 1.2, 1.2)
  scene.add(highlighted)

  window.addEventListener("resize", resizeCallback);
});

onUnmounted(() => {
  renderer.setAnimationLoop(null);
});
</script>

<style>
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>