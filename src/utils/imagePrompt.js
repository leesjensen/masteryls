// Builds the text prompt sent to the Gemini image model. Two styles are offered in the editor's
// "Generate image" dialog: the default illustrated "visual" (a clean vector infographic, good for
// diagrams/concepts) and "photo" (a photorealistic image, for when a real-looking picture is wanted).
// Kept pure and separate from aiContentGenerator.js (which is network-coupled) so it is unit-testable.

export const IMAGE_STYLE_VISUAL = 'visual';
export const IMAGE_STYLE_PHOTO = 'photo';

// Drives the radio options in the generate-image dialog.
export const IMAGE_STYLE_OPTIONS = [
  { value: IMAGE_STYLE_VISUAL, label: 'Visual', description: 'Illustrated educational infographic' },
  { value: IMAGE_STYLE_PHOTO, label: 'Photo', description: 'Photorealistic image' },
];

const VISUAL_PROMPT = (prompt) => `
Create a high-quality instructional image for course content based on this prompt:

${prompt}

Requirements:
- No main title.
- White background.
- Image width should be greater than height, ideally around a 16:9 aspect ratio, and at most 800 pixels wide.
- The image should be a friendly and clean modern educational infographic in a vector illustration style.
- The image is professional looking and appropriate for a university audience.
- All graphical elements, including icons, flowcharts, thought bubbles, and UI screens, have clear black borders.
- Prefer a vibrant clean modern monochromatic palette that uses vibrant harmonious colors for highlights and callouts.
- Integrate clear, legible modern sans-serif typography for all text, including modular section callouts if used.
- Strong contrast between text and the background to increase legibility.
- Text must be large enough to be easily readable when the image is viewed on a mobile device.
- The structured, modular layout uses simple illustrative icons and flowcharts to explain complex concepts.`;

const PHOTO_PROMPT = (prompt) => `
Create a high-quality, photorealistic image for course content based on this prompt:

${prompt}

Requirements:
- Photorealistic, as if captured with a professional camera: natural lighting, realistic textures, accurate proportions, and a believable depth of field.
- No title, caption, labels, or other text overlaid on the image.
- Image width should be greater than height, ideally around a 16:9 aspect ratio, and at most 800 pixels wide.
- Professional looking and appropriate for a university audience.
- Realistic composition, color, and subject matter.
- Avoid illustration, cartoon, vector, infographic, flowchart, or diagram styling; this should look like a real photograph.`;

/**
 * Returns the Gemini image-model prompt text for the given subject and style.
 * Falls back to the illustrated "visual" style for any unrecognized style.
 */
export function buildImagePromptText(prompt, style = IMAGE_STYLE_VISUAL) {
  return style === IMAGE_STYLE_PHOTO ? PHOTO_PROMPT(prompt) : VISUAL_PROMPT(prompt);
}
