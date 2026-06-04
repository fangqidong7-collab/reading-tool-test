export type AnnotationDisplayMode = 'inline' | 'above';

export const ANNOTATION_FONT_SIZE_MIN = 10;
export const ANNOTATION_FONT_SIZE_MAX = 18;

export const ABOVE_MODE_DEFAULTS = {
  lineHeight: 2.0,
} as const;

export function defaultAnnotationFontSize(bodyFontSize: number): number {
  return Math.max(ANNOTATION_FONT_SIZE_MIN, Math.round(bodyFontSize * 0.65));
}

export function defaultInlineAnnotationFontSize(bodyFontSize: number): number {
  return Math.max(ANNOTATION_FONT_SIZE_MIN, Math.round(bodyFontSize * 0.7));
}

export function clampAnnotationFontSize(size: number): number {
  return Math.max(ANNOTATION_FONT_SIZE_MIN, Math.min(ANNOTATION_FONT_SIZE_MAX, Math.round(size)));
}

export function parseAnnotationDisplayMode(value: unknown): AnnotationDisplayMode {
  return value === 'above' ? 'above' : 'inline';
}

export function aboveModeParagraphPaddingTop(annotationFontSize: number): number {
  return Math.round(annotationFontSize * 1.2);
}
