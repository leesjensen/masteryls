import React from 'react';

export default function usePastedTopicFiles(courseOps) {
  const [externalAddedFiles, setExternalAddedFiles] = React.useState([]);
  const [pastingImageCommit, setPastingImageCommit] = React.useState(false);
  const [previewFileUrls, setPreviewFileUrls] = React.useState({});
  const previewFileUrlsRef = React.useRef({});

  React.useEffect(() => {
    return () => {
      Object.values(previewFileUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      previewFileUrlsRef.current = {};
    };
  }, []);

  const addPreviewFileUrls = React.useCallback((uploadDescriptors) => {
    const nextUrls = {};
    (Array.isArray(uploadDescriptors) ? uploadDescriptors : []).forEach((file) => {
      if (!file?.name || !file?.props || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return;
      }

      if (previewFileUrlsRef.current[file.name]) {
        URL.revokeObjectURL(previewFileUrlsRef.current[file.name]);
      }

      const url = URL.createObjectURL(file.props);
      previewFileUrlsRef.current[file.name] = url;
      nextUrls[file.name] = url;
    });

    if (Object.keys(nextUrls).length > 0) {
      setPreviewFileUrls((current) => ({ ...current, ...nextUrls }));
    }
  }, []);

  const handlePastedFiles = React.useCallback(
    async (uploadDescriptors) => {
      if (!Array.isArray(uploadDescriptors) || uploadDescriptors.length === 0) {
        return;
      }

      addPreviewFileUrls(uploadDescriptors);
      setExternalAddedFiles(uploadDescriptors);
      await courseOps.addTopicFiles(uploadDescriptors);
    },
    [addPreviewFileUrls, courseOps],
  );

  const getExistingTopicFileNames = React.useCallback(async () => {
    const files = await courseOps.getTopicFiles();
    if (!Array.isArray(files)) {
      return [];
    }

    return files.map((file) => file?.name).filter(Boolean);
  }, [courseOps]);

  return {
    externalAddedFiles,
    previewFileUrls,
    pastingImageCommit,
    setPastingImageCommit,
    handlePastedFiles,
    getExistingTopicFileNames,
  };
}
