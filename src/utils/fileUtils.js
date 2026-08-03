export const getExt = (fname) => (fname || '').split('.').pop().toLowerCase();

export const canPreview3D = (fname) => {
    return ['glb', 'gltf', 'stl', 'obj'].includes(getExt(fname));
};

export const is3DModelType = (docTypeCode) => docTypeCode === 'models';