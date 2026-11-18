import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync } from 'expo-image-picker';

export async function pickAvatar(): Promise<string | null> {
  const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] });
  if (result.canceled) return null;

  const context = ImageManipulator.manipulate(result.assets[0].uri, { maxWidth: 320, maxHeight: 320 });
  try {
    const rendered = await context.renderAsync();
    try {
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (!image.base64 || image.base64.length > 4 * Math.ceil(200 * 1024 / 3)) {
        throw new Error('Invalid avatar image size');
      }
      return `data:image/jpeg;base64,${image.base64}`;
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}
