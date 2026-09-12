import { WORLD_SIZE } from './AeldorData';
import { getEditorCell, type EditorCell } from './EditorWorld';
import type { WorldPlane } from './types';

export type ObjectRotation = 0 | 90 | 180 | 270;

export interface ObjectTransform {
  rotation: ObjectRotation;
  flipX: boolean;
  flipY: boolean;
}

export type RoofPieceId = 'tile_middle' | 'tile_side' | 'tatch_middle' | 'tatch_side';

export interface EditorRoofPiece {
  id: RoofPieceId;
  transform: ObjectTransform;
}

export interface TransformableEditorCell extends EditorCell {
  structureTransform?: ObjectTransform;
  roof?: EditorRoofPiece | null;
}

export const IDENTITY_OBJECT_TRANSFORM: ObjectTransform = {
  rotation: 0,
  flipX: false,
  flipY: false,
};

export function getEditorStructureTransformAt(
  x: number,
  y: number,
  plane: WorldPlane = 0,
): ObjectTransform | undefined {
  const cell = getEditorCell(x, y, WORLD_SIZE, plane) as TransformableEditorCell | undefined;
  return cell?.structureTransform;
}

export function getEditorRoofAt(
  x: number,
  y: number,
  plane: WorldPlane = 0,
): EditorRoofPiece | undefined {
  const cell = getEditorCell(x, y, WORLD_SIZE, plane) as TransformableEditorCell | undefined;
  return cell?.roof ?? undefined;
}
