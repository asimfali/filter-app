export const canPreview3D = (fname) => {
    const ext = (fname || '').split('.').pop().toLowerCase();
    return ['glb', 'gltf', 'stl', 'obj'].includes(ext);
};

export const is3DModelType = (docTypeCode) => docTypeCode === 'models';