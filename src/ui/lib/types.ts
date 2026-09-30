/**
 * Общие типы для ui-слоя.
 */

export type ClassDict = Record<string, boolean | null | undefined>;

export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassDict
  | ClassValue[];
