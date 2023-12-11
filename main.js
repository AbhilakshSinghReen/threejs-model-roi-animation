import "./style.css";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mediaBaseUrl } from "./apiEndpoints";

import segmentMeshRenderingConfig from "./segmentMaterials.json";
import apiClient from "./apiServices";
const reportId = 31;

async function main() {
  const responseData = await apiClient.reports.getDetail(reportId);
  if (!responseData.success) {
    console.error("Failed to get report details from server");
    return;
  }

  const reportData = responseData.result.report;
  const volumeShape = reportData.meshes_metadata.input_volume.shape;
  const regionsOfInterest = reportData.meshes_metadata.segmentsOfInterest;

  let currentRoiIndex = -1;
  let currentRoiMeshName = null;
  let currentRoiShape = volumeShape;
  let currentRoiMeshMetadata = reportData.meshes_metadata.meshes.find(
    (meshMeta) => meshMeta.name === currentRoiMeshName
  );
  let currentRoiGeometricOrigin = [0, volumeShape[1] / 2, 0];
  if (currentRoiMeshMetadata) {
    currentRoiGeometricOrigin = currentRoiMeshMetadata.geometricOrigin;
  }

  const gltfModelUrl = mediaBaseUrl + `/segment-meshes/${reportData.report_media_id}/model.gltf`;

  const AnimationStates = {
    ROI_ZOOM_IN: Symbol("ROI_ZOOM_IN"),
    ROI_TURNTABLE: Symbol("ROI_TURNTABLE"),
    ROI_ZOOM_OUT: Symbol("ROI_ZOOM_OUT"),
    ROI_CHANGE: Symbol("ROI_CHANGE"),
  };

  //#region Helper Functions
  const floatEqualResolution = 1;
  const pointLightPositionRatio = 0.9;
  const cameraDistanceFromLookAtToRoiDimsRatio = 0.75;
  const cameraHeightAboveLookAtToRoiHeightRatio = 0.5;
  const turnTableDuration = 10_000;

  let animationState = AnimationStates.ROI_ZOOM_IN;

  let nonRoiOpacity = 1;

  let cameraDistanceFromLookAt =
    cameraDistanceFromLookAtToRoiDimsRatio * Math.min(currentRoiShape[0], currentRoiShape[1]);
  let lastCameraDistanceFromLookAt = cameraDistanceFromLookAt;
  let cameraHeightAboveLookAt = currentRoiShape[2] * cameraHeightAboveLookAtToRoiHeightRatio;

  let turnTableStartTimestamp = null;
  let currentTimestamp;

  /////

  function clampFloat(value, lowerLimit, upperLimit) {
    return Math.max(lowerLimit, Math.min(upperLimit, value));
  }

  function lerpFloatIfRequired(currentVal, targetVal, alpha) {
    if (floatIsEqual(currentVal, targetVal)) {
      // console.log("not lerping");
      return currentVal;
    }

    // console.log("lerping");

    const lerpedVal = THREE.MathUtils.lerp(currentVal, targetVal, alpha);
    return lerpedVal;
  }

  function floatIsEqual(float1, float2, resolution = floatEqualResolution) {
    return Math.abs(float1 - float2) < resolution;
  }

  function floatArrIsEqual(floartArr1, floartArr2, resolution = floatEqualResolution) {
    if (floartArr1.length !== floartArr2.length) {
      return false;
    }

    for (let i = 0; i < floartArr1.length; i++) {
      if (!floatIsEqual(floartArr1[i], floartArr2[i], resolution)) {
        return false;
      }
    }

    return true;
  }

  function getProperSegmentName(meshName) {
    for (const segDetails of segmentMeshRenderingConfig) {
      const possibleMeshName = `Segment_${segDetails.segmentValue}`;
      if (meshName === possibleMeshName) {
        return segDetails.name;
      }
    }

    return meshName;
  }

  function getMaterialForMeshName(meshName) {
    for (const segDetails of segmentMeshRenderingConfig) {
      const possibleMeshName = `Segment_${segDetails.segmentValue}`;
      if (meshName === possibleMeshName || meshName === segDetails.name) {
        return segDetails.material;
      }
    }

    return {
      "Base Color": "#000000",
    };
  }

  //#endregion

  const mainClock = new THREE.Clock();

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10_000);
  const cameraLight = new THREE.PointLight(0xffffff, 1);
  const cameraBoom = new THREE.Group();
  cameraBoom.add(camera);
  camera.position.set(0, 0, cameraDistanceFromLookAt);
  cameraBoom.add(cameraLight);
  cameraLight.position.set(0, 0, pointLightPositionRatio * cameraDistanceFromLookAt);
  scene.add(cameraBoom);

  // initial position
  camera.position.set(0, cameraHeightAboveLookAt * 2, cameraDistanceFromLookAt * 2);
  camera.lookAt(0, cameraHeightAboveLookAt * 2, 0);
  cameraBoom.position.set(currentRoiGeometricOrigin[0], currentRoiGeometricOrigin[1], currentRoiGeometricOrigin[2]);

  const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#bg"),
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);

  const gridHelper = new THREE.GridHelper(2000, 50);
  scene.add(gridHelper);

  // load a glTF model
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    gltfModelUrl,
    function (gltf) {
      const mainMesh = gltf.scene;

      mainMesh.traverse((node) => {
        if (node.isMesh) {
          node.name = getProperSegmentName(node.name);

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

      mainMesh.position.set(0, 512, 0);
      scene.add(mainMesh);
    },
    // called while loading is progressing
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    // called when loading has errors
    function (error) {
      console.log(error);
      console.log("An error happened");
    }
  );

  function animate() {
    requestAnimationFrame(animate);
    const deltaTime = mainClock.getDelta();

    //
    // animation state handling
    switch (animationState) {
      case AnimationStates.ROI_ZOOM_IN: {
        const animationCompleted = floatArrIsEqual(
          [camera.position.y, camera.position.z, cameraBoom.position.x, cameraBoom.position.y, cameraBoom.position.z],
          [
            cameraHeightAboveLookAt,
            cameraDistanceFromLookAt,
            currentRoiGeometricOrigin[0],
            currentRoiGeometricOrigin[1],
            currentRoiGeometricOrigin[2],
          ]
        );

        if (animationCompleted) {
          turnTableStartTimestamp = new Date().getTime();
          animationState = AnimationStates.ROI_TURNTABLE;
          break;
        }

        break;
      }
      case AnimationStates.ROI_TURNTABLE: {
        currentTimestamp = new Date().getTime();
        const animationCompleted = currentTimestamp - turnTableStartTimestamp >= turnTableDuration;

        if (animationCompleted) {
          currentRoiShape = volumeShape;
          lastCameraDistanceFromLookAt = cameraDistanceFromLookAt;
          cameraDistanceFromLookAt =
            cameraDistanceFromLookAtToRoiDimsRatio * Math.min(currentRoiShape[0], currentRoiShape[1]);
          cameraHeightAboveLookAt = currentRoiShape[2] * cameraHeightAboveLookAtToRoiHeightRatio;
          nonRoiOpacity = 1;
          animationState = AnimationStates.ROI_ZOOM_OUT;
          break;
        }

        break;
      }
      case AnimationStates.ROI_ZOOM_OUT: {
        const animationCompleted = floatArrIsEqual(
          [camera.position.y, camera.position.z, cameraBoom.position.x, cameraBoom.position.y, cameraBoom.position.z],
          [
            cameraHeightAboveLookAt,
            cameraDistanceFromLookAt,
            currentRoiGeometricOrigin[0],
            currentRoiGeometricOrigin[1],
            currentRoiGeometricOrigin[2],
          ]
        );

        if (animationCompleted) {
          turnTableStartTimestamp = new Date().getTime();
          animationState = AnimationStates.ROI_CHANGE;
          break;
        }

        break;
      }
      case AnimationStates.ROI_CHANGE: {
        if (currentRoiIndex == -1) {
          break;
        }

        currentRoiIndex += 1;
        if (currentRoiIndex >= regionsOfInterest.length) {
          currentRoiIndex = -1;
          nonRoiOpacity = 1;
          break;
        }

        currentRoiShape = regionsOfInterest[currentRoiIndex].shape;
        currentRoiGeometricOrigin = regionsOfInterest[currentRoiIndex].currentRoiGeometricOrigin;
        lastCameraDistanceFromLookAt = cameraDistanceFromLookAt;
        cameraDistanceFromLookAt =
          cameraDistanceFromLookAtToRoiDimsRatio * Math.min(currentRoiShape[0], currentRoiShape[1]);
        cameraHeightAboveLookAt = currentRoiShape[2] * cameraHeightAboveLookAtToRoiHeightRatio;
        nonRoiOpacity = 0.2;
        animationState = AnimationStates.ROI_ZOOM_IN;

        break;
      }
      default: {
        break;
      }
    }

    //
    // constant rotation
    cameraBoom.rotation.y += deltaTime * 0.25;
    if (cameraBoom.rotation.y > 6.28319) {
      cameraBoom.rotation.y -= 6.28319;
    }

    //
    // lerps
    const updatedCameraHeightAboveLookAt = lerpFloatIfRequired(camera.position.y, cameraHeightAboveLookAt, 1 * 0.001);
    const updatedCameraDistanceFromLookAt = lerpFloatIfRequired(camera.position.z, cameraDistanceFromLookAt, 1 * 0.001);
    const updatedCameraBoomPosition = [
      lerpFloatIfRequired(cameraBoom.position.x, currentRoiGeometricOrigin[0], 1 * 0.001),
      lerpFloatIfRequired(cameraBoom.position.y, currentRoiGeometricOrigin[1], 1 * 0.001),
      lerpFloatIfRequired(cameraBoom.position.z, currentRoiGeometricOrigin[2], 1 * 0.001),
    ];

    //
    // animate opacity
    const distanceTraversed = Math.abs(lastCameraDistanceFromLookAt - updatedCameraDistanceFromLookAt);
    const distancePending = Math.abs(cameraDistanceFromLookAt - updatedCameraDistanceFromLookAt);

    scene.traverse((node) => {
      if (node.isMesh) {
        if (currentRoiIndex === -1) {
          node.material.opacity = 1;
          return;
        }

        if (node.name === regionsOfInterest[currentRoiIndex].name) {
          return;
        }

        const opacityTraversed = Math.abs(1 - node.material.opacity);
        const opacityPending = opacityTraversed * (distancePending / distanceTraversed);

        node.material.opacity = clampFloat(1, nonRoiOpacity + opacityPending);
      }
    });

    //
    //updates
    camera.position.set(0, updatedCameraHeightAboveLookAt, updatedCameraDistanceFromLookAt);
    camera.lookAt(0, updatedCameraHeightAboveLookAt, 0);
    cameraBoom.position.set(updatedCameraBoomPosition[0], updatedCameraBoomPosition[1], updatedCameraBoomPosition[2]);

    renderer.render(scene, camera);
  }
  animate();
}

main();
