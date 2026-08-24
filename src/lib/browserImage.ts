export async function compressReviewImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (context) {
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  }
  bitmap.close?.()

  return canvas.toDataURL('image/jpeg', 0.72)
}
