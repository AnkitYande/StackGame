
var camera, scene, renderer; // ThreeJS globals
var world; // CannonJs global
var stack; // Parts that stay solid on top of each other
var overhangs; // Overhanging parts that fall down
var gameStarted;
var gameEnded;
var score = 0;

const boxHeight = 1; // Height of each layer
const originalBoxSize = 3; // Original width and height of a box
const speed = 0.1; //Animation Speed

const scoreElement = document.getElementById("score");
const intro = document.getElementById("intro");
const end = document.getElementById("end");



init();

function init() {
  gameStarted = false;
  stack = [];
  overhangs = [];

  scene = new THREE.Scene();
  world = new CANNON.World();

  // Setup ThreeJS
  const loader = new THREE.TextureLoader();
  scene.background = loader.load('./bg.jpeg');

  //Set up Cannon JS
  world.gravity.set(0, -10, 0); // Gravity pulls things down
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 40;


  // Add Foundation
  addLayer(0, 0, originalBoxSize, originalBoxSize);
  // Add First layer
  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

  // Set up lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(10, 20, 0);
  scene.add(dirLight);

  //Set up camera
  const aspect = window.innerWidth / window.innerHeight;
  const width = window.innerWidth > window.innerHeight ? 20 : 10;
  const height = width / aspect;
  camera = new THREE.OrthographicCamera(
    width / -2, // left
    width / 2, // right
    height / 2, // top
    height / -2, // bottom
    0, // near plane
    100 // far plane
  );
  camera.position.set(10, 12, 10);
  camera.lookAt(-2, 0, -2);

  // Set up renderer
  renderer = new THREE.WebGLRenderer({ aplpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
  document.body.appendChild(renderer.domElement);
}

function addLayer(x, z, width, depth, direction) {
  const y = boxHeight * stack.length; // Add the new box one layer higher
  const layer = generateBox(x, y, z, width, depth, false);
  layer.direction = direction;
  stack.push(layer);
}
function addOverhang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1); // Add the new box one the same layer
  const overhang = generateBox(x, y, z, width, depth, true);
  overhangs.push(overhang);
}


function generateBox(x, y, z, width, depth, falls) {
  // ThreeJS
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth);
  const hue = !falls ? (stack.length * 6 + 260) : ((stack.length - 1) * 6 + 260);
  const color = new THREE.Color(`hsl(${hue}, 100%, 65%)`);
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  // CannonJS
  const shape = new CANNON.Box(new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2));
  let mass = falls ? 5 : 0; // If it shouldn't fall then setting the mass to zero will keep it stationary
  mass *= width / originalBoxSize; // Reduce mass proportionately by size
  mass *= depth / originalBoxSize;
  let body = new CANNON.Body({ mass, shape });
  body.position.set(x, y, z);
  world.addBody(body);

  return {
    threejs: mesh,
    cannonjs: body,
    width,
    depth
  };
}

window.addEventListener("mousedown", startGame);
window.addEventListener("touchstart", startGame);

function startGame(){
  if (gameEnded) return;

  if (!gameStarted) {
    renderer.setAnimationLoop(animation);
    intro.style = "display: none"
    gameStarted = true;
  } else {
    const topLayer = stack[stack.length - 1];
    const previousLayer = stack[stack.length - 2];

    const direction = topLayer.direction;

    const size = direction == "x" ? topLayer.width : topLayer.depth;
    const delta = topLayer.threejs.position[direction] - previousLayer.threejs.position[direction]
    const overhangSize = Math.abs(delta);
    const overlap = size - overhangSize;

    if (overlap > 0) {
      scoreElement.innerText = stack.length - 1;
      new Audio('./plink.mp3').play();

      cutBox(topLayer, overlap, size, delta);

      //Overhang
      const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
      const overhangX =
        direction == "x"
          ? topLayer.threejs.position.x + overhangShift
          : topLayer.threejs.position.x;
      const overhangZ =
        direction == "z"
          ? topLayer.threejs.position.z + overhangShift
          : topLayer.threejs.position.z;
      const overhangWidth = direction == "x" ? overhangSize : topLayer.width;
      const overhangDepth = direction == "z" ? overhangSize : topLayer.depth;

      addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

      //Next layer
      const nextX = direction == "x" ? topLayer.threejs.position.x : -10;
      const nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
      const nextDirection = direction == "x" ? "z" : "x";
      addLayer(nextX, nextZ, topLayer.width, topLayer.depth, nextDirection);

    } else {
      missedTheSpot();
    }
  }
}

function cutBox(topLayer, overlap, size, delta) {
  const direction = topLayer.direction;

  const newWidth = direction == "x" ? overlap : topLayer.width;
  const newDepth = direction == "z" ? overlap : topLayer.depth;
  topLayer.width = newWidth; // New layer has the same size as the cut top layer
  topLayer.depth = newDepth; // New layer has the same size as the cut top layer

  //Update ThreeJS Model
  topLayer.threejs.scale[direction] = overlap / size;
  topLayer.threejs.position[direction] -= delta / 2;

  //Update CanonJS Model
  topLayer.cannonjs.position[direction] -= delta / 2;
  const shape = new CANNON.Box(new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2));
  topLayer.cannonjs.shapes = [];
  topLayer.cannonjs.addShape(shape);

}

function animation() {
  if (gameStarted) {
    let topLayer = stack[stack.length - 1];
    topLayer.threejs.position[topLayer.direction] += speed;
    topLayer.cannonjs.position[topLayer.direction] += speed;

    // console.log(camera.position.y, boxHeight * (stack.length - 2) + 12);
    if (topLayer.threejs.position[topLayer.direction] > 10) {
      endGame();
    }
    if (camera.position.y < boxHeight * (stack.length - 2) + 12) {
      camera.position.y += speed;
    }
    updatePhysics();
    renderer.render(scene, camera);
  }
}

function updatePhysics() {
  world.step(1 / 60);

  // Copy coordinates from Cannon.js to Three.js
  overhangs.forEach((element) => {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}

function missedTheSpot() {
  const topLayer = stack[stack.length - 1];
  // Turn to top layer into an overhang and let it fall down
  addOverhang(
    topLayer.threejs.position.x,
    topLayer.threejs.position.z,
    topLayer.width,
    topLayer.depth
  );
  world.remove(topLayer.cannonjs);
  scene.remove(topLayer.threejs);

  endGame();
}

function endGame() {
  const y = camera.position.y
  const aspect = window.innerWidth / window.innerHeight;
  const height = (y/2 +12)/aspect;
  const width = height * aspect;
  camera = new THREE.OrthographicCamera(
    width / -2, // left
    width / 2, // right
    height / 2, // top
    height / -2, // bottom
    0, // near plane
    100 // far plane
  );
  camera.position.set(10, y, 10);
  camera.lookAt(-2, 0, -2);
  gameEnded = true;
  end.style = "display: flex";
}