import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const AVATAR_SIZE = 512;

/**
 * System photo library → square crop → resized JPEG under the avatars bucket's
 * 2 MB limit. Returns a local file URI, or null if the user cancels.
 */
export async function pickAvatarImage(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  context.resize({ width: AVATAR_SIZE, height: null });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}
