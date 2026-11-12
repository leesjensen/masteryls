// Builds the text prompt sent to the Gemini image model. The editor's "Generate image" dialog offers
// a Style radio; each style maps to a label/description (for the radio) and a prompt builder. Styles
// share a common base (aspect ratio, size, university-appropriate) and differ in aesthetic direction.
// Kept pure and separate from aiContentGenerator.js (which is network-coupled) so it is unit-testable.

export const IMAGE_STYLE_VISUAL = 'visual';
export const IMAGE_STYLE_PHOTO = 'photo';
export const IMAGE_STYLE_WATERCOLOR = 'watercolor';
export const IMAGE_STYLE_LINE_ART = 'line-art';
export const IMAGE_STYLE_RENDER_3D = '3d-render';
export const IMAGE_STYLE_MINIMALIST = 'minimalist';

// Shared across every style. Artistic styles additionally ask for no text, since image models render
// typography poorly outside the infographic style; the "visual" style keeps its text labels.
const BASE_REQUIREMENTS = `- Image width should be greater than height, ideally around a 16:9 aspect ratio, and at most 800 pixels wide.
- Professional looking and appropriate for a university audience.`;

const NO_TEXT = '- Do not overlay any title, caption, labels, or other text on the image.';

// Each style: the radio label/description and the aesthetic body appended after the shared base.
const STYLES = {
  [IMAGE_STYLE_VISUAL]: {
    label: 'Visual',
    description: 'Illustrated educational infographic',
    lead: 'Create a high-quality instructional image for course content based on this prompt:',
    body: `- No main title.
- White background.
- The image should be a friendly and clean modern educational infographic in a vector illustration style.
- All graphical elements, including icons, flowcharts, thought bubbles, and UI screens, have clear black borders.
- Prefer a vibrant clean modern monochromatic palette that uses vibrant harmonious colors for highlights and callouts.
- Integrate clear, legible modern sans-serif typography for all text, including modular section callouts if used.
- Strong contrast between text and the background to increase legibility.
- Text must be large enough to be easily readable when the image is viewed on a mobile device.
- The structured, modular layout uses simple illustrative icons and flowcharts to explain complex concepts.`,
  },
  [IMAGE_STYLE_PHOTO]: {
    label: 'Photo',
    description: 'Photorealistic image',
    lead: 'Create a high-quality, photorealistic image for course content based on this prompt:',
    body: `- Photorealistic, as if captured with a professional camera: natural lighting, realistic textures, accurate proportions, and a believable depth of field.
${NO_TEXT}
- Realistic composition, color, and subject matter.
- Avoid illustration, cartoon, vector, infographic, flowchart, or diagram styling; this should look like a real photograph.`,
  },
  [IMAGE_STYLE_WATERCOLOR]: {
    label: 'Watercolor',
    description: 'Soft painterly artwork',
    lead: 'Create a high-quality watercolor painting for course content based on this prompt:',
    body: `- Soft, painterly watercolor style with gentle color washes, visible brush texture, and organic edges.
- A light, airy palette with harmonious colors and natural paper texture.
${NO_TEXT}
- Evocative and artistic rather than technical; avoid vector, infographic, or photographic styling.`,
  },
  [IMAGE_STYLE_LINE_ART]: {
    label: 'Line art',
    description: 'Clean line drawing',
    lead: 'Create a high-quality line-art illustration for course content based on this prompt:',
    body: `- Clean, confident black line drawing on a white background, in the style of a careful ink sketch.
- Minimal or no color; if color is used, keep it to a single restrained accent.
- Clear, uncluttered linework with simple shading; emphasize form and outline.
${NO_TEXT}
- Avoid photographic rendering, heavy gradients, and dense infographic layouts.`,
  },
  [IMAGE_STYLE_RENDER_3D]: {
    label: '3D render',
    description: 'Polished 3D illustration',
    lead: 'Create a high-quality 3D-rendered illustration for course content based on this prompt:',
    body: `- Polished 3D render with soft studio lighting, smooth surfaces, gentle shadows, and subtle depth of field.
- A clean, friendly style (soft clay or isometric feel) with a cohesive, modern color palette.
- Plain or softly gradient background that keeps focus on the subject.
${NO_TEXT}
- Avoid flat vector, hand-drawn, and photographic styling; this should read as a rendered 3D scene.`,
  },
  [IMAGE_STYLE_MINIMALIST]: {
    label: 'Minimalist',
    description: 'Flat, simple shapes',
    lead: 'Create a high-quality minimalist illustration for course content based on this prompt:',
    body: `- Flat, minimalist design using bold simple geometric shapes and generous negative space.
- A limited, harmonious palette of two to four colors on a clean background.
- Reduce the subject to its essential forms; no fine detail, texture, or gradients.
${NO_TEXT}
- Avoid photographic, 3D, and busy infographic styling.`,
  },
};

// Drives the radio options in the generate-image dialog (order preserved; visual first = default).
export const IMAGE_STYLE_OPTIONS = Object.entries(STYLES).map(([value, { label, description }]) => ({ value, label, description }));

/**
 * Returns the Gemini image-model prompt text for the given subject and style.
 * Falls back to the illustrated "visual" style for any unrecognized style.
 */
export function buildImagePromptText(prompt, style = IMAGE_STYLE_VISUAL) {
  const { lead, body } = STYLES[style] || STYLES[IMAGE_STYLE_VISUAL];
  return `
${lead}

${prompt}

Requirements:
${BASE_REQUIREMENTS}
${body}`;
}
