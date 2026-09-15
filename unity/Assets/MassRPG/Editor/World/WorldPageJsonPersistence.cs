using System;
using System.Collections.Generic;
using System.IO;
using MassRPG.Core.World;
using MassRPG.Data.World;
using UnityEngine;

namespace MassRPG.Editor.World
{
    /// <summary>
    /// Editor-side disk persistence for authored world pages. Runtime/editor gameplay data remains
    /// engine-independent; this class only adapts WorldPageDocument to Unity's JSON utility.
    /// </summary>
    public static class WorldPageJsonPersistence
    {
        public const string ProductionRoot = "Assets/MassRPG/WorldData/Pages";
        public const string RecoveryRoot = "Library/MassRPG/WorldEditorRecovery";

        public static string FilePath(WorldPageKey key, string root = ProductionRoot)
        {
            var folder = Path.Combine(root, $"plane_{key.Plane}", $"storey_{key.Storey}");
            return Path.Combine(folder, $"page_{key.Page.X}_{key.Page.Y}.json").Replace('\\', '/');
        }

        public static void Save(WorldPageDocument document, string root = ProductionRoot)
        {
            if (document == null) throw new ArgumentNullException(nameof(document));
            var key = new WorldPageKey(new WorldPageCoord(document.PageX, document.PageY), document.Plane, document.Storey);
            var path = FilePath(key, root);
            var directory = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
            File.WriteAllText(path, JsonUtility.ToJson(ToDto(document), true));
        }

        public static bool TryLoad(WorldPageKey key, out WorldPageDocument document, string root = ProductionRoot)
        {
            var path = FilePath(key, root);
            if (!File.Exists(path))
            {
                document = null;
                return false;
            }

            var json = File.ReadAllText(path);
            var dto = JsonUtility.FromJson<PageDto>(json);
            if (dto == null)
            {
                document = null;
                return false;
            }

            document = FromDto(dto);
            return true;
        }

        private static PageDto ToDto(WorldPageDocument document)
        {
            var dto = new PageDto
            {
                formatVersion = document.FormatVersion,
                pageX = document.PageX,
                pageY = document.PageY,
                plane = document.Plane,
                storey = document.Storey,
                pageSize = document.PageSize,
                groundPalette = document.GroundPalette != null ? document.GroundPalette.ToArray() : Array.Empty<string>(),
                runs = new RunDto[document.Runs != null ? document.Runs.Count : 0]
            };

            for (var i = 0; i < dto.runs.Length; i++)
            {
                var run = document.Runs[i];
                dto.runs[i] = new RunDto
                {
                    length = run.Length,
                    groundIndex = run.GroundIndex,
                    elevation = run.Elevation,
                    flags = run.Flags,
                    movementEdges = run.MovementEdges,
                    lineOfSightEdges = run.LineOfSightEdges,
                    elevationTransitionEdges = run.ElevationTransitionEdges
                };
            }
            return dto;
        }

        private static WorldPageDocument FromDto(PageDto dto)
        {
            var document = new WorldPageDocument
            {
                FormatVersion = dto.formatVersion,
                PageX = dto.pageX,
                PageY = dto.pageY,
                Plane = dto.plane,
                Storey = dto.storey,
                PageSize = dto.pageSize,
                GroundPalette = new List<string>(dto.groundPalette ?? Array.Empty<string>()),
                Runs = new List<WorldPageRun>()
            };

            if (dto.runs != null)
            {
                for (var i = 0; i < dto.runs.Length; i++)
                {
                    var run = dto.runs[i];
                    document.Runs.Add(new WorldPageRun
                    {
                        Length = run.length,
                        GroundIndex = run.groundIndex,
                        Elevation = run.elevation,
                        Flags = run.flags,
                        MovementEdges = run.movementEdges,
                        LineOfSightEdges = run.lineOfSightEdges,
                        ElevationTransitionEdges = run.elevationTransitionEdges
                    });
                }
            }
            return document;
        }

        [Serializable]
        private sealed class PageDto
        {
            public int formatVersion;
            public int pageX;
            public int pageY;
            public int plane;
            public int storey;
            public int pageSize;
            public string[] groundPalette;
            public RunDto[] runs;
        }

        [Serializable]
        private sealed class RunDto
        {
            public int length;
            public ushort groundIndex;
            public short elevation;
            public byte flags;
            public byte movementEdges;
            public byte lineOfSightEdges;
            public byte elevationTransitionEdges;
        }
    }
}
