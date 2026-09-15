using System;
using System.Collections.Generic;
using MassRPG.Core.World;
using MassRPG.Data.World;
using UnityEngine;
using UnityEngine.Rendering;

namespace MassRPG.Client.World
{
    /// <summary>
    /// First production-bound visual mesh builder for exact authored logical terrain. It renders
    /// one top quad per loaded 1x1 cell and vertical cliff faces where a cardinal neighbour is
    /// lower. Logical elevation/pathing remain data; visual meshes are disposable chunk views.
    /// </summary>
    public static class LogicalTerrainChunkMeshBuilder
    {
        public static Mesh Build(
            AuthoredWorldPageStore store,
            int renderChunkX,
            int renderChunkY,
            int plane,
            int storey,
            float tileSize,
            float elevationStepHeight,
            int renderChunkSize = WorldConstants.DefaultRenderChunkSize)
        {
            if (store == null) throw new ArgumentNullException(nameof(store));
            if (renderChunkSize <= 0) throw new ArgumentOutOfRangeException(nameof(renderChunkSize));
            tileSize = Mathf.Max(0.01f, tileSize);
            elevationStepHeight = Mathf.Max(0.01f, elevationStepHeight);

            var vertices = new List<Vector3>(renderChunkSize * renderChunkSize * 4);
            var triangles = new List<int>(renderChunkSize * renderChunkSize * 6);
            var uvs = new List<Vector2>(renderChunkSize * renderChunkSize * 4);
            var startX = renderChunkX * renderChunkSize;
            var startY = renderChunkY * renderChunkSize;

            for (var localY = 0; localY < renderChunkSize; localY++)
            {
                for (var localX = 0; localX < renderChunkSize; localX++)
                {
                    var tile = new GridCoord(startX + localX, startY + localY);
                    if (!WorldConstants.IsInsideWorld(tile)) continue;
                    var location = new GridLocation(tile, plane, storey);
                    if (!store.TryGetCell(location, out var cell)) continue;

                    var height = cell.Elevation * elevationStepHeight;
                    AddTop(vertices, triangles, uvs, localX * tileSize, localY * tileSize, tileSize, height);

                    AddCliffIfLower(store, vertices, triangles, uvs, location, cell.Elevation,
                        new GridCoord(tile.X, tile.Y - 1), localX, localY, CardinalEdgeMask.North,
                        tileSize, elevationStepHeight);
                    AddCliffIfLower(store, vertices, triangles, uvs, location, cell.Elevation,
                        new GridCoord(tile.X + 1, tile.Y), localX, localY, CardinalEdgeMask.East,
                        tileSize, elevationStepHeight);
                    AddCliffIfLower(store, vertices, triangles, uvs, location, cell.Elevation,
                        new GridCoord(tile.X, tile.Y + 1), localX, localY, CardinalEdgeMask.South,
                        tileSize, elevationStepHeight);
                    AddCliffIfLower(store, vertices, triangles, uvs, location, cell.Elevation,
                        new GridCoord(tile.X - 1, tile.Y), localX, localY, CardinalEdgeMask.West,
                        tileSize, elevationStepHeight);
                }
            }

            var mesh = new Mesh { name = $"MassRPG Terrain {renderChunkX},{renderChunkY} p{plane}" };
            if (vertices.Count > ushort.MaxValue) mesh.indexFormat = IndexFormat.UInt32;
            mesh.SetVertices(vertices);
            mesh.SetTriangles(triangles, 0, true);
            mesh.SetUVs(0, uvs);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        private static void AddTop(
            List<Vector3> vertices,
            List<int> triangles,
            List<Vector2> uvs,
            float centerX,
            float centerZ,
            float tileSize,
            float height)
        {
            var half = tileSize * 0.5f;
            var first = vertices.Count;
            vertices.Add(new Vector3(centerX - half, height, centerZ - half));
            vertices.Add(new Vector3(centerX - half, height, centerZ + half));
            vertices.Add(new Vector3(centerX + half, height, centerZ + half));
            vertices.Add(new Vector3(centerX + half, height, centerZ - half));
            uvs.Add(new Vector2(0f, 0f));
            uvs.Add(new Vector2(0f, 1f));
            uvs.Add(new Vector2(1f, 1f));
            uvs.Add(new Vector2(1f, 0f));
            triangles.Add(first);
            triangles.Add(first + 1);
            triangles.Add(first + 2);
            triangles.Add(first);
            triangles.Add(first + 2);
            triangles.Add(first + 3);
        }

        private static void AddCliffIfLower(
            AuthoredWorldPageStore store,
            List<Vector3> vertices,
            List<int> triangles,
            List<Vector2> uvs,
            GridLocation current,
            short currentElevation,
            GridCoord neighbourTile,
            int localX,
            int localY,
            CardinalEdgeMask edge,
            float tileSize,
            float elevationStepHeight)
        {
            if (!WorldConstants.IsInsideWorld(neighbourTile)) return;
            var neighbour = new GridLocation(neighbourTile, current.Plane, current.Storey);
            if (!store.TryGetCell(neighbour, out var neighbourCell)) return;
            if (neighbourCell.Elevation >= currentElevation) return;

            var upper = currentElevation * elevationStepHeight;
            var lower = neighbourCell.Elevation * elevationStepHeight;
            AddCliffFace(vertices, triangles, uvs, localX * tileSize, localY * tileSize, tileSize, lower, upper, edge);
        }

        private static void AddCliffFace(
            List<Vector3> vertices,
            List<int> triangles,
            List<Vector2> uvs,
            float centerX,
            float centerZ,
            float tileSize,
            float lower,
            float upper,
            CardinalEdgeMask edge)
        {
            var half = tileSize * 0.5f;
            Vector3 a;
            Vector3 b;
            Vector3 c;
            Vector3 d;

            switch (edge)
            {
                case CardinalEdgeMask.North:
                    a = new Vector3(centerX + half, lower, centerZ - half);
                    b = new Vector3(centerX - half, lower, centerZ - half);
                    c = new Vector3(centerX - half, upper, centerZ - half);
                    d = new Vector3(centerX + half, upper, centerZ - half);
                    break;
                case CardinalEdgeMask.East:
                    a = new Vector3(centerX + half, lower, centerZ + half);
                    b = new Vector3(centerX + half, lower, centerZ - half);
                    c = new Vector3(centerX + half, upper, centerZ - half);
                    d = new Vector3(centerX + half, upper, centerZ + half);
                    break;
                case CardinalEdgeMask.South:
                    a = new Vector3(centerX - half, lower, centerZ + half);
                    b = new Vector3(centerX + half, lower, centerZ + half);
                    c = new Vector3(centerX + half, upper, centerZ + half);
                    d = new Vector3(centerX - half, upper, centerZ + half);
                    break;
                case CardinalEdgeMask.West:
                    a = new Vector3(centerX - half, lower, centerZ - half);
                    b = new Vector3(centerX - half, lower, centerZ + half);
                    c = new Vector3(centerX - half, upper, centerZ + half);
                    d = new Vector3(centerX - half, upper, centerZ - half);
                    break;
                default:
                    return;
            }

            var first = vertices.Count;
            vertices.Add(a);
            vertices.Add(b);
            vertices.Add(c);
            vertices.Add(d);
            var verticalUv = Mathf.Max(1f, (upper - lower) / tileSize);
            uvs.Add(new Vector2(0f, 0f));
            uvs.Add(new Vector2(1f, 0f));
            uvs.Add(new Vector2(1f, verticalUv));
            uvs.Add(new Vector2(0f, verticalUv));
            triangles.Add(first);
            triangles.Add(first + 1);
            triangles.Add(first + 2);
            triangles.Add(first);
            triangles.Add(first + 2);
            triangles.Add(first + 3);
        }
    }
}
