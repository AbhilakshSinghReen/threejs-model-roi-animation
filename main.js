import "./style.css";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import AnimatedScene from "./AnimatedScene";
import { mediaBaseUrl } from "./apiEndpoints";
import { getPathPart } from "./utils/jsUtils";
import { addInnerTextWithTypewriterEffect } from "./utils/textAnimationUtils";

// import segmentMeshRenderingConfig from "./segmentMaterials.json";
import apiClient from "./apiServices";
import speechRecognizer from "./apis/speechRecognition";
import speechSynthesizer from "./apis/speechSynthesis";

const SIMPLIFIED_REPORT_DEFAULT_LANGUAGE = "English";

async function main() {
  const reportId = getPathPart(window.location.pathname, 2);
  const responseData = await apiClient.reports.getDetail(reportId);
  if (!responseData.success) {
    console.error("Failed to get report details from server");
    return;
  }

  //////////////////

  const reportData = responseData.result.report;
  const simplifiedReportsAvailableLanguages = Object.keys(reportData.simplified_reports);
  const simplifiedReportsPreviouslySelectedLanguages = new Set([SIMPLIFIED_REPORT_DEFAULT_LANGUAGE]);

  const languageSelectElement = document.getElementById("simplified-text-language-select");
  const reportTextElement = document.getElementById("text-displayer-text");

  for (const language of simplifiedReportsAvailableLanguages) {
    const selectOption = document.createElement("option");
    selectOption.text = language;
    selectOption.value = language;
    languageSelectElement.add(selectOption);
  }

  addInnerTextWithTypewriterEffect(
    reportTextElement,
    reportData.simplified_reports[SIMPLIFIED_REPORT_DEFAULT_LANGUAGE],
    20,
    20
  );

  languageSelectElement.addEventListener("change", async function () {
    const selectedLanguage = languageSelectElement.value;

    if (simplifiedReportsPreviouslySelectedLanguages.has(selectedLanguage)) {
      reportTextElement.innerText = reportData.simplified_reports[selectedLanguage];
      return;
    }

    simplifiedReportsPreviouslySelectedLanguages.add(selectedLanguage);
    addInnerTextWithTypewriterEffect(reportTextElement, reportData.simplified_reports[selectedLanguage], 20, 20);
  });

  document.getElementById("report-type-text").innerText = reportData.report_metadata?.reportType;
  document.getElementById("report-date-text").innerText = reportData.report_metadata?.reportDate;

  const askQuestionMicButtonElement = document.getElementById("ask-question-mic-button");
  askQuestionMicButtonElement.onclick = () => {
    speechRecognizer.runSpeechRecognition(async (recognizedText) => {
      const askQuestionResponseData = await apiClient.reports.askQuestion(reportId, recognizedText);
      if (!askQuestionResponseData.success) {
        // TODO: add audio to say an error occurred
        console.log(askQuestionResponseData);
        return;
      }

      const answerText = askQuestionResponseData.result.answer;
      console.log(answerText);
      speechSynthesizer.speakText(answerText);
    });
  };

  const animatedScene = new AnimatedScene(reportData);

  return;

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

  ///// Animation is managed by:
  // isTurning
  // cameraDistanceFromLookAt
  // cameraHeightAboveLookAt
  // nonRoiOpacity
  /////
  //#region Helper Functions
  const floatEqualResolution = 1;
  const pointLightPositionRatio = 0.9;
  const cameraDistanceFromLookAtToRoiDimsRatio = 0.75;
  const cameraHeightAboveLookAtToRoiHeightRatio = 0.5;
  const turnTableDuration = 10_000;

  function isNullOrUndefinedOrNaN(value) {
    return value === undefined || value === null || isNaN(value);
  }

  function renderStateContainsNullish(renderState) {
    return (
      isNullOrUndefinedOrNaN(renderState.cameraDistanceFromLookAt) ||
      isNullOrUndefinedOrNaN(renderState.cameraHeightAboveLookAt) ||
      isNullOrUndefinedOrNaN(renderState.cameraLookAt[0]) ||
      isNullOrUndefinedOrNaN(renderState.cameraLookAt[1]) ||
      isNullOrUndefinedOrNaN(renderState.cameraLookAt[2])
    );
  }

  function renderStateIsEqual(renderState1, renderState2) {
    if (new Date().getTime() >= renderState2.turnTableEndTimestamp) {
      return true;
    }

    return (
      floatIsEqual(renderState1.cameraDistanceFromLookAt, renderState2.cameraDistanceFromLookAt) &&
      floatIsEqual(renderState1.cameraHeightAboveLookAt, renderState2.cameraHeightAboveLookAt) &&
      floatIsEqual(renderState1.cameraLookAt[0], renderState2.cameraLookAt[0]) &&
      floatIsEqual(renderState1.cameraLookAt[1], renderState2.cameraLookAt[1]) &&
      floatIsEqual(renderState1.cameraLookAt[2], renderState2.cameraLookAt[2])
    );
  }

  function lerpRenderStateIfRequired(currentRenderState, targetRenderState) {
    const updatedRenderState = {
      cameraDistanceFromLookAt: lerpFloatIfRequired(
        currentRenderState.cameraDistanceFromLookAt,
        targetRenderState.cameraDistanceFromLookAt
      ),
      cameraHeightAboveLookAt: lerpFloatIfRequired(
        currentRenderState.cameraHeightAboveLookAt,
        targetRenderState.cameraHeightAboveLookAt
      ),
      cameraLookAt: [
        lerpFloatIfRequired(currentRenderState.cameraLookAt[0], targetRenderState.cameraLookAt[0]),
        lerpFloatIfRequired(currentRenderState.cameraLookAt[1], targetRenderState.cameraLookAt[1]),
        lerpFloatIfRequired(currentRenderState.cameraLookAt[2], targetRenderState.cameraLookAt[2]),
      ],
    };
    return updatedRenderState;
  }

  let currentRenderState = {
    isTruning: false,
    cameraDistanceFromLookAt: cameraDistanceFromLookAtToRoiDimsRatio * Math.min(currentRoiShape[0], currentRoiShape[1]),
    cameraHeightAboveLookAt: currentRoiShape[2] * cameraHeightAboveLookAtToRoiHeightRatio,
    cameraLookAt: [currentRoiGeometricOrigin[0], currentRoiGeometricOrigin[1], currentRoiGeometricOrigin[2]],

    // nonRoiOpacity - leave this for now
  };
  let targetRenderState = {
    isTruning: false,
    cameraDistanceFromLookAt: cameraDistanceFromLookAtToRoiDimsRatio * Math.min(currentRoiShape[0], currentRoiShape[1]),
    cameraHeightAboveLookAt: currentRoiShape[2] * cameraHeightAboveLookAtToRoiHeightRatio,
    cameraLookAt: [currentRoiGeometricOrigin[0], currentRoiGeometricOrigin[1], currentRoiGeometricOrigin[2]],
  };

  let animationState = AnimationStates.ROI_ZOOM_IN;

  let nonRoiOpacity = 1;

  let cameraDistanceFromLookAt =
    cameraDistanceFromLookAtToRoiDimsRatio * Math.min(currentRoiShape[0], currentRoiShape[1]);
  let lastCameraDistanceFromLookAt = cameraDistanceFromLookAt;
  let cameraHeightAboveLookAt = currentRoiShape[2] * cameraHeightAboveLookAtToRoiHeightRatio;

  let turnTableStartTimestamp = null;
  let currentTimestamp;

  let volumeGeometricOrigin = [0, 256, 0]; // find the right place to define this

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
  cameraBoom.position.set(0, 0, 0);

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

    const currentRenderState = {
      cameraHeightAboveLookAt: camera.position.y,
      cameraDistanceFromLookAt: camera.position.z,
      // cameraLookAt: [cameraBoom.position[0], cameraBoom.position[1], cameraBoom.position[2]],
      cameraLookAt: [camera.lookAt[0], camera.lookAt[1], camera.lookAt[2]],
    };
    console.log(currentRenderState);

    if (renderStateContainsNullish(currentRenderState)) {
      console.log("Encountered one or more nullish values in the current render state.");
      renderer.render(scene, camera);
      return;
    }

    const animationStateCompleted = renderStateIsEqual(currentRenderState, targetRenderState);

    // console.log(camera.position.y);
    // console.log(animationStateCompleted);

    if (animationStateCompleted) {
      // console.log("Animation completed");

      switch (animationState) {
        case AnimationStates.ROI_ZOOM_IN: {
          targetRenderState.turnTableEndTimestamp = new Date().getTime() + turnTableDuration;
          animationState = AnimationStates.ROI_TURNTABLE;
          break;
        }
        case AnimationStates.ROI_TURNTABLE: {
          currentRoiShape = volumeShape;
          currentRoiGeometricOrigin = volumeGeometricOrigin;
          targetRenderState = {
            ...targetRenderState,
            cameraDistanceFromLookAt:
              cameraDistanceFromLookAtToRoiDimsRatio * Math.min(currentRoiShape[0], currentRoiShape[1]),
            cameraHeightAboveLookAt: currentRoiShape[2] * cameraHeightAboveLookAtToRoiHeightRatio,
            cameraLookAt: [currentRoiGeometricOrigin[0], currentRoiGeometricOrigin[1], currentRoiGeometricOrigin[2]],
          };
          animationState = AnimationStates.ROI_ZOOM_OUT;
          break;
        }
        case AnimationStates.ROI_ZOOM_OUT: {
          targetRenderState.turnTableEndTimestamp = new Date().getTime() + turnTableDuration;
          animationState = AnimationStates.ROI_TURNTABLE;
          break;
        }
        case AnimationStates.ROI_CHANGE: {
          if (currentRoiIndex == -1) {
            break;
          }

          currentRoiIndex += 1;
          if (currentRoiIndex >= regionsOfInterest.length) {
            currentRoiIndex = -1;
            break;
          }

          // set current ROI index and get shape and geometric origin
          currentRoiMeshName = regionsOfInterest[currentRoiIndex];
          currentRoiShape = [volumeShape[0] / 3, volumeShape[1] / 3, volumeShape[2] / 3];
          let currentRoiMeshMetadata = reportData.meshes_metadata.meshes.find(
            (meshMeta) => meshMeta.name === currentRoiMeshName
          );
          if (currentRoiMeshMetadata) {
            currentRoiGeometricOrigin = currentRoiMeshMetadata.geometricOrigin;
          }

          targetRenderState = {
            ...targetRenderState,
            cameraDistanceFromLookAt:
              cameraDistanceFromLookAtToRoiDimsRatio * Math.min(currentRoiShape[0], currentRoiShape[1]),
            cameraHeightAboveLookAt: currentRoiShape[2] * cameraHeightAboveLookAtToRoiHeightRatio,
            cameraLookAt: [currentRoiGeometricOrigin[0], currentRoiGeometricOrigin[1], currentRoiGeometricOrigin[2]],
          };
          animationState = AnimationStates.ROI_ZOOM_IN;

          break;
        }
        default: {
          break;
        }
      }
    }

    const updatedRenderState = lerpRenderStateIfRequired(currentRenderState, targetRenderState);

    console.log(targetRenderState);
    console.log(updatedRenderState);

    camera.position.set(0, updatedRenderState.cameraHeightAboveLookAt, updatedRenderState.cameraDistanceFromLookAt);
    camera.lookAt(0, updatedRenderState.cameraHeightAboveLookAt, 0);
    // cameraBoom.position.set(
    //   updatedRenderState.cameraLookAt[0],
    //   updatedRenderState.cameraLookAt[1],
    //   updatedRenderState.cameraLookAt[2]
    // );

    if (targetRenderState.isTruning) {
      cameraBoom.rotation.y += deltaTime * 0.25;
      if (cameraBoom.rotation.y > 6.28319) {
        cameraBoom.rotation.y -= 6.28319;
      }
    }

    renderer.render(scene, camera);
  }
  animate();
}

main();
