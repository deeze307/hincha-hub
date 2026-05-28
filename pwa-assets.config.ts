import { defineConfig, minimalPreset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimalPreset,
    maskable: {
      sizes: [512],
      resizeOptions: {
        background: '#09090F',
        fit: 'contain',
      },
      padding: 0.38,
    },
    apple: {
      sizes: [180],
      resizeOptions: {
        background: '#09090F',
        fit: 'contain',
      },
      padding: 0.2,
    },
    favicon: {
      sizes: [64, 192, 512],
      resizeOptions: {
        background: '#09090F',
        fit: 'contain',
      },
      padding: 0.1,
    },
  },
  images: ['src/assets/images/isotipo.png'],
})
