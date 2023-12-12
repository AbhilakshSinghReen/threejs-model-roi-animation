import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { mediaBaseUrl } from "./apiEndpoints";
import { getProperSegmentName, getMaterialForMeshName } from "./utils/segmentsUtils";

const SCENE_TO_SCREEN_HEIGHT_RATIO = 0.65;

class AnimatedScene {
  constructor(reportData) {
    this.reportData = reportData;
    this.volumeShape = reportData.meshes_metadata.input_volume.shape;
    this.segmentMeshesData = reportData.meshes_metadata.meshes;
    // this.segmentsOfInterest = reportData.meshes_metadata.segmentsOfInterest;
    this.segmentsOfInterest = ["liver", "stomach", "lung_upper_lobe_left"];
    this.currentSegmentOfInterestIndex = -1;
    this.gltfModelUrl = mediaBaseUrl + `/segment-meshes/${reportData.report_media_id}/model.gltf`;

    // this.currentSegmentOfInterestIndex = -1;
    this.allAnimationsCompleted = false;

    this.AnimationStates = {
      ROI_ZOOM_IN: Symbol("ROI_ZOOM_IN"),
      ROI_TURNTABLE: Symbol("ROI_TURNTABLE"),
      ROI_ZOOM_OUT: Symbol("ROI_ZOOM_OUT"),
      ROI_CHANGE: Symbol("ROI_CHANGE"),
    };
    this.constants = {
      pointLightPositionRatio: 0.9,
    };

    this.mainClock = new THREE.Clock();
    this.scene = new THREE.Scene();

    this.initialCameraTransform = this.getCameraPositionAndRotationForGeometry(1, 2);

    this.createCameraBoom();
    this.createRenderer();
    this.createOrbitControls();
    this.orbitControls.update();
    this.initialCameraTransform = {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      rotation: [this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z],
    };
    console.log(this.initialCameraTransform);
    this.createHelpers();

    this.loadGltfModel(this.gltfModelUrl, [0, 512, 0]); // TODO: remove the hardcoded 2nd param

    // this.createTorusMesh();
    // this.createAmbientLight();
    // this.createBasicCamera();

    const dummyAnimatorState = {
      cameraDistanceFromLookAt: 500,
      cameraHeightAboveLookAt: 200,
      cameraLookAt: [0, this.volumeShape[1] / 4, 0],
      cameraBoomYRotation: 1.2,
    };
    this.updateSceneFromAnimatorState(dummyAnimatorState);

    this.assignButtonEventHandlers();

    this.animate = this.animate.bind(this);
    this.animate();
  }

  getCameraPositionAndRotationForGeometry(origin, shape) {
    const maxDim = Math.max(shape[0], shape[1], shape[2]);

    return {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    };

    return {
      position: [0, maxDim / 2, maxDim * 2],
      rotation: [0, 0, 0],
    };
  }

  createCameraBoom() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / (window.innerHeight * SCENE_TO_SCREEN_HEIGHT_RATIO),
      0.1,
      10_000
    );
    this.cameraLight = new THREE.PointLight(0xffffff, 1);
    this.cameraBoom = new THREE.Group();

    // this.cameraBoom.add(this.camera);
    // this.camera.position.set(0, 0, 500);
    // this.cameraBoom.add(this.cameraLight);
    // this.cameraLight.position.set(0, 0, pointLightPositionRatio * cameraDistanceFromLookAt);
    // this.cameraBoom.position.set(100, 100, 100);

    this.camera.add(this.cameraLight);
    this.scene.add(this.camera);

    this.camera.position.set(
      this.initialCameraTransform.position[0],
      this.initialCameraTransform.position[1],
      this.initialCameraTransform.position[2]
    );
    this.camera.rotation.set(
      this.initialCameraTransform.rotation[0],
      this.initialCameraTransform.rotation[1],
      this.initialCameraTransform.rotation[2]
    );

    this.scene.add(this.cameraBoom);
  }

  createRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("#bg"),
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight * SCENE_TO_SCREEN_HEIGHT_RATIO);
    //   renderer.render(this,scene, this.camera);
  }

  createOrbitControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.autoRotate = true;
    this.orbitControls.autoRotateSpeed = 1;
    this.orbitControls.enableDamping = true;
  }

  createHelpers() {
    this.gridHelper = new THREE.GridHelper(2000, 50);
    this.scene.add(this.gridHelper);
  }

  assignButtonEventHandlers() {
    const playPauseButton = document.getElementById("play-pause-button");
    const resetButton = document.getElementById("reset-button");
    const prevButton = document.getElementById("prev-button");
    const nextButton = document.getElementById("next-button");

    playPauseButton.onclick = () => {
      const currentButtonText = playPauseButton.innerText;
      if (currentButtonText === "Pause") {
        this.orbitControls.autoRotate = false;
        playPauseButton.innerText = "Play";
      } else {
        this.orbitControls.autoRotate = true;
        playPauseButton.innerText = "Pause";
      }
    };

    resetButton.onclick = () => {
      // this.orbitControls.reset();
      this.camera.position.set(0, 200, 500);
      // this.camera.rotation.set(
      //   this.initialCameraTransform.rotation[0],
      //   this.initialCameraTransform.rotation[1],
      //   this.initialCameraTransform.rotation[2]
      // );
    };

    prevButton.onclick = () => {
      this.currentSegmentOfInterestIndex -= 1;
      if (this.currentSegmentOfInterestIndex < -1) {
        this.currentSegmentOfInterestIndex = this.segmentsOfInterest.length - 1;
      }
      this.setTargetAnimatorState();

      console.log(this.currentSegmentOfInterestIndex);
      console.log(this.segmentsOfInterest);
    };

    nextButton.onclick = () => {
      this.currentSegmentOfInterestIndex += 1;
      if (this.currentSegmentOfInterestIndex >= this.segmentsOfInterest.length) {
        this.currentSegmentOfInterestIndex = -1;
      }
      this.setTargetAnimatorState();

      console.log(this.currentSegmentOfInterestIndex);
      console.log(this.segmentsOfInterest);
    };
  }

  loadGltfModel(modelUrl, meshesPosition) {
    const gltfLoader = new GLTFLoader();
    const scene = this.scene;

    gltfLoader.load(
      modelUrl,
      function (gltf) {
        const mainMesh = gltf.scene;

        mainMesh.traverse((node) => {
          if (node.isMesh) {
            console.log(node.name);
            node.name = getProperSegmentName(node.name);
            console.log(node.name);
            console.log("-----");

            const meshMaterialDetails = getMaterialForMeshName(node.name);
            const meshMaterial = new THREE.MeshStandardMaterial({
              color: meshMaterialDetails["Base Color"],
              roughness: meshMaterialDetails["Roughness"],
              metalness: meshMaterialDetails["Metallic"],
              transparent: true,
              opacity: 1,
            });
            node.material = meshMaterial;
          }
        });

        mainMesh.position.set(meshesPosition[0], meshesPosition[1], meshesPosition[2]);
        scene.add(mainMesh);
      },
      function (xhr) {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      function (error) {
        console.error(error);
      }
    );
  }

  getCurrentSegmentOfInterestData() {
    const currentSegmentNameTextElement = document.getElementById("current-segment-name-text");

    if (this.currentSegmentOfInterestIndex === -1) {
      currentSegmentNameTextElement.innerText = "full_body";
      return {
        name: "full_body",
        origin: [0, 0, 0],
        shape: this.volumeShape,
      };
    }

    const currentSegmentOfInterestName = this.segmentsOfInterest[this.currentSegmentOfInterestIndex];
    const currentSegmentOfInterestMeshData = this.segmentMeshesData.find(
      (obj) => (obj.name = currentSegmentOfInterestName)
    );
    currentSegmentNameTextElement.innerText = currentSegmentOfInterestName;
    return {
      name: currentSegmentOfInterestName,
      origin: currentSegmentOfInterestMeshData.geometricOrigin,
      shape: this.volumeShape, // TODO: get segment mesh shape from backend
    };
  }

  setTargetAnimatorState() {
    const currentSegmentOfInterestData = this.getCurrentSegmentOfInterestData();

    if (currentSegmentOfInterestData.name === "full_body") {
      this.scene.traverse((node) => {
        if (node.isMesh) {
          node.material.opacity = 1;
        }
      });
      return;
    }

    this.scene.traverse((node) => {
      if (node.isMesh) {
        if (node.name === currentSegmentOfInterestData.name) {
          node.material.opacity = 1;
        } else {
          node.material.opacity = 0.2;
        }
      }
    });

    // pass
  }

  getAnimatorStateForFocusingGeometry(origin, shape) {}

  // set target animation state for AnimationState
  // get current and update lerped until target is met
  // once target is met, go to next animation state and repeat from step 1
  //

  getTargetAnimatorState(animationState) {
    if (animationState === this.AnimationStates.ROI_CHANGE) {
      this.currentSegmentOfInterestIndex += 1;
      if (this.currentSegmentOfInterestIndex >= this.segmentsOfInterest.length) {
        this.currentSegmentOfInterestIndex = -1;
        this.allAnimationsCompleted = true;
        return;
      }

      const segmentOfInterestName = this.segmentsOfInterest[this.currentSegmentOfInterestIndex];
      const segmentOfInterestMeshData = this.segmentMeshesData.find((seg) => seg.name === segmentOfInterestName);

      const targetGeometricOrigin = segmentOfInterestMeshData.geometricOrigin;
      const targetGeometryShape = [this.volumeShape[0] / 3, this.volumeShape[1] / 3, this.volumeShape[2] / 3]; // TODO: get this from mesh data
    } else if (animationState === this.AnimationStates.ROI_ZOOM_IN) {
    } else if (animationState === this.AnimationStates.ROI_TURNTABLE) {
    } else if (animationState === this.AnimationStates.ROI_ZOOM_OUT) {
    }
  }

  getCurrentAnimatorState() {
    return {
      cameraDistanceFromLookAt: this.camera.position.z,
      cameraHeightAboveLookAt: this.camera.position.y,
      cameraLookAt: [this.cameraBoom.position.x, this.cameraBoom.position.y, this.cameraBoom.position.z],
      cameraBoomYRotation: this.cameraBoom.rotation.y,
    };
  }

  updateSceneFromAnimatorState(animatorState, deltaTime = 1) {
    if (animatorState.cameraDistanceFromLookAt) {
      this.camera.position.setZ(animatorState.cameraDistanceFromLookAt);
      this.cameraLight.position.setZ(this.constants.pointLightPositionRatio * animatorState.cameraDistanceFromLookAt);
    }

    if (animatorState.cameraHeightAboveLookAt) {
      this.camera.position.setY(animatorState.cameraHeightAboveLookAt);
      this.cameraLight.position.setY(this.constants.pointLightPositionRatio * animatorState.cameraHeightAboveLookAt);
      //   this.camera.lookAt(0, animatorState.cameraHeightAboveLookAt, 0);
    }

    if (animatorState.cameraLookAt) {
      this.cameraBoom.position.set(
        animatorState.cameraLookAt[0],
        animatorState.cameraLookAt[1],
        animatorState.cameraLookAt[2]
      );

      this.orbitControls.target.set(
        animatorState.cameraLookAt[0],
        animatorState.cameraLookAt[1],
        animatorState.cameraLookAt[2]
      );
    }

    if (animatorState.cameraBoomYRotation) {
      this.cameraBoom.rotation.y = animatorState.cameraBoomYRotation;
      while (this.cameraBoom.rotation.y > 6.28319) {
        this.cameraBoom.rotation.y -= 6.28319;
      }
    } else if (animatorState.cameraBoomYRotationIncrement) {
      this.cameraBoom.rotation.y += deltaTime * animatorState.cameraBoomYRotationIncrement;
      while (this.cameraBoom.rotation.y > 6.28319) {
        this.cameraBoom.rotation.y -= 6.28319;
      }
    }
  }

  ///

  createTorusMesh() {
    const geometry = new THREE.TorusGeometry(10, 3, 16, 100);
    const material = new THREE.MeshStandardMaterial({ color: 0xff6347 });
    const torus = new THREE.Mesh(geometry, material);
    this.scene.add(torus);
  }

  createAmbientLight() {
    const ambientLight = new THREE.AmbientLight(0xffffff);
    this.scene.add(ambientLight);
  }

  createBasicCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / (window.innerHeight * SCENE_TO_SCREEN_HEIGHT_RATIO),
      0.1,
      1000
    );
    this.camera.position.setZ(30);
    this.camera.position.setX(-3);
  }

  ///

  animate() {
    requestAnimationFrame(this.animate);
    // const deltaTime = this.mainClock.getDelta();

    // const updatedAnimatorState = {
    //   cameraBoomYRotationIncrement: 0.25,
    // };
    // this.updateSceneFromAnimatorState(updatedAnimatorState, deltaTime);

    this.orbitControls.update();

    // console.log(this.camera.position);
    // console.log(this.camera.rotation);

    // this.camera.position.x += 5;

    this.renderer.render(this.scene, this.camera);
  }
}

export default AnimatedScene;
