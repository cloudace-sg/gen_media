// Backend-only style definitions
// Expose only metadata to clients; keep systemPrompt private

const STYLES = [
  // General
  {
    id: 'freeform',
    label: 'Freeform',
    description: 'No preset — use your own prompt.',
    category: 'General',
    systemPrompt: '',
  },

  // Photographic Styles
  {
    id: 'analog_film',
    label: 'Analog Film',
    description: 'Grainy, retro, and nostalgic film look.',
    category: 'Photographic Styles',
    systemPrompt:
      'Low resolution, technicolor, push-processed, clipped highlights, chromatic aberration, 35mm film, filmic grain, medium format, shallow depth of field, retro optics.',
  },
  {
    id: 'modern_ecommerce',
    label: 'Modern E-commerce',
    description: 'Clean, bright, and product-focused lighting.',
    category: 'Photographic Styles',
    systemPrompt:
      'A product photography shot with a very shallow depth of field, creating a beautifully blurred foreground and background that makes the central product pop. The lighting is soft and diffused, casting gentle shadows and creating a warm, inviting atmosphere. The color palette is rich and earthy, with warm tones and slightly desaturated colors that give the image a timeless, analog feel. The overall composition is clean and focused, highlighting the product\'s texture and details in a tastefully arranged setting.',
  },
  {
    id: 'social_media_ready',
    label: 'Social Media Ready',
    description: 'Trendy, high-key, and engaging portrait style.',
    category: 'Photographic Styles',
    systemPrompt:
      'High-key studio portrait, direct flash aesthetic, East Asian social media style, Ulzzang/ Douyin stylized beauty with subtle but realistic imperfections.',
  },
  {
    id: 'cinematic_moody',
    label: 'Cinematic Moody',
    description: 'Deep shadows and a dramatic, moody grade.',
    category: 'Photographic Styles',
    systemPrompt:
      'Cinematic lighting, deep shadows, moody color grade, high contrast, anamorphic lens flare, film noir aesthetic, atmospheric and evocative.',
  },

  // Graphic & Illustrative Styles
  {
    id: 'minimalist_illustration',
    label: 'Minimalist Illustration',
    description: 'Clean, modern, with a limited color palette.',
    category: 'Graphic & Illustrative Styles',
    systemPrompt:
      'A minimalist illustration style, characterized by a limited color palette primarily featuring [color 1], [color 2], and [color 3]. Figures are often rendered with simple shapes and a focus on outlines, sometimes with stippling for texture or shading. The overall aesthetic is clean, modern, and graphic, reminiscent of contemporary editorial or advertising illustrations.',
  },
  {
    id: 'isometric_view',
    label: 'Isometric View',
    description: 'High-angle, vibrant, and detailed graphic composition.',
    category: 'Graphic & Illustrative Styles',
    systemPrompt:
      'High-angle, isometric view, bright, vibrant color palette with strong color blocking, crisp shadows creating depth and a sense of realism, clean and graphic composition, slightly stylized yet photorealistic rendering, a sense of stillness and observation, detailed textures (e.g., surface, fabric).',
  },
  {
    id: 'bold_graphic_ad',
    label: 'Bold & Graphic Ad',
    description: 'High-impact, minimalist design for advertising.',
    category: 'Graphic & Illustrative Styles',
    systemPrompt:
      'A high-impact advertisement design for billboard featuring a single, striking, and iconic central image that commands attention. The hero image is shot with dramatic lighting and high contrast, creating a powerful and memorable focal point. Dominating, bold typography is integrated seamlessly into the design, using a clean, modern, and highly legible font for instantaneous readability. The overall composition is minimalist and graphic, employing bold color blocking and generous use of negative space to ensure the message stands out. The concept is clever and thought-provoking, designed to be instantly understood while leaving a lasting impression.',
  },
  {
    id: 'flat_illustration',
    label: 'Flat Illustration',
    description: 'Simple shapes, solid colors, and no depth.',
    category: 'Graphic & Illustrative Styles',
    systemPrompt:
      'Flat 2D illustration, simple shapes, limited color palette, clean lines, no gradients or shadows, vector art style, minimalist and modern.',
  },

  // Abstract & Creative Styles
  {
    id: 'ethereal_dreamscape',
    label: 'Ethereal Dreamscape',
    description: 'Soft, magical, and otherworldly visuals.',
    category: 'Abstract & Creative Styles',
    systemPrompt:
      'Surreal and ethereal aesthetic, pastel color palette, soft focus, glowing elements, magical realism, dreamlike atmosphere, iridescent and pearlescent textures, bokeh effects.',
  },
  {
    id: 'grunge_texture',
    label: 'Grunge Texture',
    description: 'Distressed, textured, and edgy look.',
    category: 'Abstract & Creative Styles',
    systemPrompt:
      'Grunge aesthetic, distressed textures, scratches, dust, noise, muted and desaturated color palette, high contrast, gritty and raw feel, inspired by 90s zine culture.',
  },
  {
    id: 'vibrant_pop_art',
    label: 'Vibrant Pop Art',
    description: 'Bold, colorful, and graphic, inspired by pop art.',
    category: 'Abstract & Creative Styles',
    systemPrompt:
      'Pop art style inspired by Andy Warhol and Roy Lichtenstein, bold outlines, vibrant and saturated primary colors, Ben-Day dots pattern, graphic and comic book aesthetic, playful and energetic.',
  },
  {
    id: 'luxe_elegant',
    label: 'Luxe & Elegant',
    description: 'Sophisticated, luxurious, with a rich feel.',
    category: 'Abstract & Creative Styles',
    systemPrompt:
      'Luxury aesthetic, rich and deep color palette (e.g., emerald green, sapphire blue, gold), high-end materials like marble, silk, and polished metals, elegant and sophisticated composition, soft and dramatic lighting, a sense of opulence and exclusivity.',
  },
];

function getStyleById(id) {
  return STYLES.find((s) => s.id === id) || STYLES[0];
}

function getPublicStyles() {
  return STYLES.map(({ id, label, description, category }) => ({ id, label, description, category }));
}

module.exports = { getStyleById, getPublicStyles };


