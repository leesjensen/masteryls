import React from 'react';

export default function usePastedTopicFiles(courseOps) {
  const [externalAddedFiles, setExternalAddedFiles] = React.useState([]);
  const [pastingImageCommit, setPastingImageCommit] = React.useState(false);

  const waitForFilesToExist = React.useCallback(
    async (fileNames, timeoutMs = 12000, intervalMs = 300) => {
      const target = new Set((Array.isArray(fileNames) ? fileNames : []).filter(Boolean));
      if (target.size === 0) {
        return true;
      }

      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const files = await courseOps.getTopicFiles();
        const existing = new Set((Array.isArray(files) ? files : []).map((file) => file?.name).filter(Boolean));

        const allFound = Array.from(target).every((name) => existing.has(name));
        if (allFound) {
          return true;
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }

      return false;
    },
    [courseOps],
  );

  const handlePastedFiles = React.useCallback(
    async (uploadDescriptors) => {
      if (!Array.isArray(uploadDescriptors) || uploadDescriptors.length === 0) {
        return;
      }

      const names = uploadDescriptors.map((file) => file.name);
      await courseOps.addTopicFiles(uploadDescriptors);
      await waitForFilesToExist(names);
      setExternalAddedFiles(uploadDescriptors);
    },
    [courseOps, waitForFilesToExist],
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
    pastingImageCommit,
    setPastingImageCommit,
    handlePastedFiles,
    getExistingTopicFileNames,
  };
}
