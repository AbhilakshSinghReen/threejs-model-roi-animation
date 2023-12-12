import segmentMeshRenderingConfig from "../data/segmentMaterials.json";

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

export { getProperSegmentName, getMaterialForMeshName };
