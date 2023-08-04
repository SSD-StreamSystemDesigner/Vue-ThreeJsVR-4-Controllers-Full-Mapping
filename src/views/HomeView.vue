<template>
  <canvas ref="canvasRef"></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls"
import {BoxLineGeometry} from "three/examples/jsm/geometries/BoxLineGeometry"
import {VRButton} from "three/examples/jsm/webxr/VRButton"
import {XRControllerModelFactory} from "three/examples/jsm/webxr/XRControllerModelFactory"
import * as THREE from "three"

let scene = new THREE.Scene()
scene.background = new THREE.Color(0xaaaaaa)
let renderer
let controls

let canvasRef = ref();

let controllers
const raycaster = new THREE.Raycaster()
const workingMatrix = new THREE.Matrix4()
const workingVector = new THREE.Vector3()

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
  controls.update();

  if(controllers){
    controllers.forEach( (controller) => {
      handleController(controller)
    })
  }

  renderer.render(scene, camera);
};

let resizeCallback = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.updateProjectionMatrix();
};

//XR Controller Builder function
const buildControllers = () =>{
  const controllerModelFactory = new XRControllerModelFactory()

  const geometry = new THREE.BufferGeometry().setFromPoints( [
    new THREE.Vector3(0,0,0),
    new THREE.Vector3(0,0,-1)
  ])
  const line = new THREE.Line(geometry)
  line.name = "line"
  line.scale.z = 10

  const controllers = []

  for(let i=0; i<=1; i++){
    const controller = renderer.xr.getController(i)
    controller.add(line.clone())
    controller.userData.selectPressed = false;
    scene.add(controller)

    controllers.push(controller)

    const grip = renderer.xr.getControllerGrip(i)
    grip.add(controllerModelFactory.createControllerModel(grip))
    scene.add(grip)
  }

  return controllers
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

  //XR Controllers
  controllers = buildControllers()

  //XR Controller Events handling
  controllers.forEach((controller)=>{
    controller.addEventListener("selectstart", ()=>{
      controller.children[0].scale.z = 10
      controller.userData.selectPressed = true
    })
    controller.addEventListener("selectend", ()=>{
      controller.children[0].scale.z = 0
      highlighted.visible = false
      controller.userData.selectPressed = false
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