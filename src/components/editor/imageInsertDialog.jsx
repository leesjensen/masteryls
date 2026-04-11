import React from 'react';

function clampDimension(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return Math.max(1, Math.round(parsed));
}

const ImageInsertDialog = React.forwardRef(function ImageInsertDialog(_, ref) {
  const dialogRef = React.useRef(null);
  const resolveRef = React.useRef(null);
  const [fileName, setFileName] = React.useState('');
  const [width, setWidth] = React.useState('');
  const [originalWidth, setOriginalWidth] = React.useState(0);
  const [originalHeight, setOriginalHeight] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState('');

  const previewWidth = clampDimension(width) || originalWidth;
  const previewHeight = originalWidth > 0 ? Math.max(1, Math.round((previewWidth / originalWidth) * originalHeight)) : originalHeight;
  const canCommit = String(fileName || '').trim().length > 0 && Number(previewWidth) > 0 && Number(previewHeight) > 0;

  const closeDialog = React.useCallback((result) => {
    dialogRef.current?.close();
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
  }, []);

  React.useImperativeHandle(ref, () => ({
    show: ({ suggestedName, originalDimensions, previewObjectUrl }) => {
      const initialWidth = Number(originalDimensions?.width) || 0;
      const initialHeight = Number(originalDimensions?.height) || 0;

      setFileName(suggestedName || 'pasted-image.png');
      setWidth(String(initialWidth || ''));
      setOriginalWidth(initialWidth);
      setOriginalHeight(initialHeight);
      setPreviewUrl(previewObjectUrl || '');

      return new Promise((resolve) => {
        resolveRef.current = resolve;
        dialogRef.current?.showModal();
      });
    },
  }));

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const onCancel = (event) => {
      event.preventDefault();
      closeDialog(null);
    };

    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [closeDialog]);

  return (
    <dialog ref={dialogRef} className="w-full p-6 rounded-lg shadow-lg max-w-2xl mt-20 mx-auto" onClick={(event) => event.stopPropagation()}>
      <h2 className="text-xl font-bold text-amber-500 mb-2">Paste image</h2>
      <p className="mb-4 text-gray-700">Set the file name and image size before inserting.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-700" htmlFor="image-file-name">
            File name
          </label>
          <input id="image-file-name" type="text" value={fileName} onChange={(event) => setFileName(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" placeholder="pasted-image.png" />

          <label className="text-sm font-medium text-gray-700" htmlFor="image-width">
            Width (px)
          </label>
          <input id="image-width" type="number" min="1" value={width} onChange={(event) => setWidth(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />

          <p className="text-xs text-gray-500">
            Original: {originalWidth}x{originalHeight}
          </p>
          <p className="text-xs text-gray-500">
            Result: {previewWidth}x{previewHeight} (aspect ratio preserved)
          </p>
        </div>

        <div className="border border-gray-200 rounded-md p-3 bg-gray-50 min-h-56 flex items-center justify-center overflow-auto">{previewUrl ? <img src={previewUrl} alt="Image preview" style={{ width: `${previewWidth}px`, height: `${previewHeight}px`, objectFit: 'contain', maxWidth: '100%', maxHeight: '100%' }} /> : <div className="text-sm text-gray-500">No preview available.</div>}</div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button onClick={() => closeDialog(null)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors">
          Cancel
        </button>
        <button
          onClick={() =>
            closeDialog({
              fileName: String(fileName || '').trim(),
              width: clampDimension(width),
            })
          }
          disabled={!canCommit}
          className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Commit
        </button>
      </div>
    </dialog>
  );
});

export default ImageInsertDialog;
