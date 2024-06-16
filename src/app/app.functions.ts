export function hexCodeToRgbaObject(hexCode: string, alpha: number): {r: number, g: number, b: number, a: number} {
  const hex = hexCode.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return {r, g, b, a: alpha}
}
