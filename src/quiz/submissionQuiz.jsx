import React from 'react';

export default function SubmissionQuiz({ meta }) {
  //         const dropZone = document.getElementById('drop-zone-${meta.id}');
  //         const fileInput = document.getElementById('file-input-${meta.id}');
  //         const fileNamesDiv = dropZone.querySelector('.file-names');
  //         const fileNamesList = fileNamesDiv.querySelector('ul');

  // console.log("loading script", { dropZone, fileInput, fileNamesDiv });

  //         dropZone.addEventListener('dragover', (e) => {
  //           e.preventDefault();
  //           dropZone.classList.add('border-blue-400', 'bg-blue-50');
  //         });

  //         dropZone.addEventListener('dragleave', () => {
  //           dropZone.classList.remove('border-blue-400', 'bg-blue-50');
  //         });

  //         dropZone.addEventListener('drop', (e) => {
  //           e.preventDefault();
  //           fileInput.files = e.dataTransfer.files;
  //           updateFileNames();
  //           console.log("updateFileNames", { fileInput });
  //         });

  //         fileInput.addEventListener('change', updateFileNames);

  //         function updateFileNames() {
  //           if (fileInput.files.length > 0) {
  //             fileNamesList.innerHTML = Array.from(fileInput.files)
  //               .map(f => "<li>" + f.name + "</li>").join('');
  //             fileNamesDiv.classList.remove('hidden');
  //           } else {
  //             fileNamesDiv.classList.add('hidden');
  //           }
  //         }

  return (
    <div id={`drop-zone-${meta.id}`} class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors duration-200">
      <input type="file" name={`quiz-${meta.id}`} id={`file-input-${meta.id}`} multiple hidden />
      <label for={`file-input-${meta.id}`} class="cursor-pointer">
        <div class="text-gray-500">
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <p class="mt-2 text-sm">
            <span class="font-medium text-blue-600 hover:text-blue-500">Click to upload</span> or drag and drop
          </p>
        </div>
      </label>
      <div class="file-names mt-3">
        <p class="text-sm font-medium text-gray-700 mb-1">Selected files:</p>
        <ul class="text-sm text-gray-600"></ul>
      </div>
    </div>
  );
}
