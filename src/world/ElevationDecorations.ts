import { WORLD_SIZE } from './AeldorData';
import { getEditorCell, type EditorCell } from './EditorWorld';
import type { WorldPlane } from './types';

export type EdgeDirection = 'north' | 'east' | 'south' | 'west';
export type DecorationRotation = 0 | 90 | 180 | 270;
export type DecorationTheme = 'grass' | 'snow' | 'desert';

/**
 * A visual/pathing overlay painted on top of ordinary terrain. This is kept
 * separate from TileType so grass/desert/snow remain the ground while cliff and
 * crevice art can occupy only the edge band of a cell, Warcraft/RTS-editor style.
 * Transform data is persisted directly in the authored world JSON.
 */
export interface EditorDecoration {
  kind: 'edge';
  theme: DecorationTheme;
  spriteId: string;
  rotation: DecorationRotation;
  flipX: boolean;
  flipY: boolean;
}

export interface DecoratedEditorCell extends EditorCell {
  decoration?: EditorDecoration | null;
}

export interface EdgeTileDefinition {
  theme: DecorationTheme;
  spriteId: string;
  label: string;
  baseEdges: readonly EdgeDirection[];
}

const THEMES: DecorationTheme[] = ['grass', 'snow', 'desert'];
const BASE_PIECES: { suffix: string; label: string; edges: readonly EdgeDirection[] }[] = [
  { suffix: 'crevice_north', label: 'Crevice North', edges: ['north'] },
  { suffix: 'crevice_north_east', label: 'Crevice North-East', edges: ['north', 'east'] },
  { suffix: 'crevice_north_west', label: 'Crevice North-West', edges: ['north', 'west'] },
  { suffix: 'cliff_south', label: 'Cliff South', edges: ['south'] },
  { suffix: 'cliff_south_east', label: 'Cliff South-East', edges: ['south', 'east'] },
  { suffix: 'cliff_south_west', label: 'Cliff South-West', edges: ['south', 'west'] },
  { suffix: 'crevice_east', label: 'Crevice East', edges: ['east'] },
  { suffix: 'cliff_west', label: 'Cliff West', edges: ['west'] },
];

export const EDGE_TILE_DEFINITIONS: readonly EdgeTileDefinition[] = THEMES.flatMap((theme) =>
  BASE_PIECES.map((piece) => ({
    theme,
    spriteId: `${theme}_${piece.suffix}`,
    label: `${theme[0].toUpperCase()}${theme.slice(1)} ${piece.label}`,
    baseEdges: piece.edges,
  })),
);

const EDGE_BY_SPRITE = new Map(EDGE_TILE_DEFINITIONS.map((definition) => [definition.spriteId, definition]));

export function edgeTileDefinition(spriteId: string): EdgeTileDefinition | undefined {
  return EDGE_BY_SPRITE.get(spriteId);
}

export function getEditorDecorationAt(
  x: number,
  y: number,
  plane: WorldPlane = 0,
): EditorDecoration | undefined {
  const cell = getEditorCell(x, y, WORLD_SIZE, plane) as DecoratedEditorCell | undefined;
  const decoration = cell?.decoration;
  if (!decoration || decoration.kind !== 'edge' || !EDGE_BY_SPRITE.has(decoration.spriteId)) return undefined;
  return decoration;
}

function flipDirectionX(direction: EdgeDirection): EdgeDirection {
  if (direction === 'east') return 'west';
  if (direction === 'west') return 'east';
  return direction;
}

function flipDirectionY(direction: EdgeDirection): EdgeDirection {
  if (direction === 'north') return 'south';
  if (direction === 'south') return 'north';
  return direction;
}

function rotateDirection(direction: EdgeDirection, rotation: DecorationRotation): EdgeDirection {
  const order: EdgeDirection[] = ['north', 'east', 'south', 'west'];
  const index = order.indexOf(direction);
  const steps = rotation / 90;
  return order[(index + steps) % 4];
}

/** Mirrors are applied in sprite-local space, then the result is rotated clockwise. */
export function transformedDecorationEdges(decoration: EditorDecoration): EdgeDirection[] {
  const definition = edgeTileDefinition(decoration.spriteId);
  if (!definition) return [];
  const transformed = definition.baseEdges.map((edge) => {
    let next = edge;
    if (decoration.flipX) next = flipDirectionX(next);
    if (decoration.flipY) next = flipDirectionY(next);
    return rotateDirection(next, decoration.rotation);
  });
  return [...new Set(transformed)];
}

export function decorationBlocksEdge(decoration: EditorDecoration | undefined, edge: EdgeDirection): boolean {
  return !!decoration && transformedDecorationEdges(decoration).includes(edge);
}
