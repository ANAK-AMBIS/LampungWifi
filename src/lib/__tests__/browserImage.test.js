import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compressReviewImage } from '../browserImage.js'

describe('compressReviewImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('compresses image to 1200px and returns dataURL', async () => {
    const mockBitmap = { width: 2400, height: 1800, close: vi.fn() }
    global.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap)

    const mockToDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,compressed')
    const mockDrawImage = vi.fn()
    const mockGetContext = vi.fn().mockReturnValue({ drawImage: mockDrawImage })
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: mockGetContext,
      toDataURL: mockToDataURL,
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas)

    const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' })
    const result = await compressReviewImage(file)

    expect(global.createImageBitmap).toHaveBeenCalledWith(file)
    // scale 1200 / 2400 = 0.5 => 1200x900
    expect(mockCanvas.width).toBe(1200)
    expect(mockCanvas.height).toBe(900)
    expect(mockDrawImage).toHaveBeenCalled()
    expect(mockBitmap.close).toHaveBeenCalled()
    expect(result).toBe('data:image/jpeg;base64,compressed')
  })

  it('does not upscale small images', async () => {
    const mockBitmap = { width: 800, height: 600, close: vi.fn() }
    global.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap)

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,small'),
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas)

    const file = new File(['a'], 'small.jpg', { type: 'image/jpeg' })
    await compressReviewImage(file)

    expect(mockCanvas.width).toBe(800)
    expect(mockCanvas.height).toBe(600)
  })

  it('handles missing context gracefully', async () => {
    const mockBitmap = { width: 100, height: 100, close: vi.fn() }
    global.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap)

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(null),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,fallback'),
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas)

    const file = new File(['x'], 'f.jpg', { type: 'image/jpeg' })
    const result = await compressReviewImage(file)
    expect(result).toBe('data:image/jpeg;base64,fallback')
  })
})
