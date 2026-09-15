using System;
using System.Collections.Generic;
using MassRPG.Core.Content;
using MassRPG.Core.World;
using MassRPG.Data.World;
using MassRPG.EditorCore.World;
using UnityEditor;
using UnityEngine;

namespace MassRPG.Editor.World
{
    /// <summary>
    /// First real tactile MassRPG world-authoring surface. It deliberately edits the canonical
    /// 1x1 logical tile data directly rather than Unity Terrain or scene GameObjects.
    /// </summary>
    public sealed class MassRPGWorldEditorWindow : EditorWindow
    {
        private enum WaterPaintMode { Water, DeepWater, Erase }
        private enum PathingPaintMode { Movement, LineOfSight, NoBuild }

        private static readonly int[] BrushSizes = { 1, 3, 5, 7, 11, 21, 41, 81, 161, 321 };
        private static readonly string[] BrushLabels = { "1", "3", "5", "7", "11", "21", "41", "81", "161", "321" };
        private static readonly string[] GroundPresets =
        {
            "ground.grass", "ground.dirt", "ground.sand", "ground.stone", "ground.snow", "ground.swamp", "ground.rock"
        };

        private AuthoredWorldPageStore _store;
        private WorldEditSession _session;
        private readonly HashSet<WorldPageKey> _diskChecked = new HashSet<WorldPageKey>();
        private readonly HashSet<GridCoord> _strokeTiles = new HashSet<GridCoord>();

        private WorldEditorMode _mode = WorldEditorMode.Terrain;
        private BrushShape _brushShape = BrushShape.Square;
        private WaterPaintMode _waterMode = WaterPaintMode.Water;
        private PathingPaintMode _pathingMode = PathingPaintMode.Movement;
        private int _brushIndex = 0;
        private string _groundId = "ground.grass";
        private float _centerX = WorldConstants.WorldWidthTiles * 0.5f;
        private float _centerY = WorldConstants.WorldHeightTiles * 0.5f;
        private float _pixelsPerTile = 18f;
        private int _plane = WorldConstants.SurfacePlane;
        private int _storey;
        private bool _paintingStroke;
        private bool _strokeErase;
        private double _nextRecoveryAt;
        private string _status = "Ready";

        [MenuItem("MassRPG/World Editor %#m")]
        public static void Open()
        {
            var window = GetWindow<MassRPGWorldEditorWindow>();
            window.titleContent = new GUIContent("MassRPG World Editor");
            window.minSize = new Vector2(900, 600);
            window.Show();
        }

        private void OnEnable()
        {
            EnsureSession();
            _nextRecoveryAt = EditorApplication.timeSinceStartup + 60.0;
            EditorApplication.update += EditorUpdate;
        }

        private void OnDisable()
        {
            EditorApplication.update -= EditorUpdate;
            if (_session != null && _session.DirtyPageCount > 0) SaveRecovery();
        }

        private void EnsureSession()
        {
            if (_store != null && _session != null) return;
            _store = new AuthoredWorldPageStore(new ContentId("ground.unpainted"));
            _session = new WorldEditSession(_store, 250);
            _diskChecked.Clear();
        }

        private void EditorUpdate()
        {
            if (_session == null || _session.DirtyPageCount == 0) return;
            if (EditorApplication.timeSinceStartup < _nextRecoveryAt) return;
            SaveRecovery();
            _nextRecoveryAt = EditorApplication.timeSinceStartup + 60.0;
        }

        private void OnGUI()
        {
            EnsureSession();
            HandleKeyboardShortcuts(Event.current);
            DrawTopToolbar();
            DrawModeOptions();

            var toolbarHeight = GUILayoutUtility.GetLastRect().yMax + 4f;
            var canvas = new Rect(0f, toolbarHeight, position.width, Mathf.Max(0f, position.height - toolbarHeight - 22f));
            EnsureVisiblePagesLoaded(canvas);
            DrawCanvas(canvas);
            DrawStatusBar(canvas.yMax);
        }

        private void DrawTopToolbar()
        {
            using (new EditorGUILayout.HorizontalScope(EditorStyles.toolbar))
            {
                _mode = (WorldEditorMode)EditorGUILayout.EnumPopup(_mode, EditorStyles.toolbarPopup, GUILayout.Width(120));
                _brushIndex = EditorGUILayout.Popup(_brushIndex, BrushLabels, EditorStyles.toolbarPopup, GUILayout.Width(50));
                _brushShape = (BrushShape)EditorGUILayout.EnumPopup(_brushShape, EditorStyles.toolbarPopup, GUILayout.Width(70));

                GUILayout.Space(8);
                GUILayout.Label("X", GUILayout.Width(12));
                var x = EditorGUILayout.IntField(Mathf.RoundToInt(_centerX), EditorStyles.toolbarTextField, GUILayout.Width(70));
                GUILayout.Label("Y", GUILayout.Width(12));
                var y = EditorGUILayout.IntField(Mathf.RoundToInt(_centerY), EditorStyles.toolbarTextField, GUILayout.Width(70));
                if (x != Mathf.RoundToInt(_centerX) || y != Mathf.RoundToInt(_centerY))
                {
                    _centerX = Mathf.Clamp(x, 0, WorldConstants.WorldWidthTiles - 1);
                    _centerY = Mathf.Clamp(y, 0, WorldConstants.WorldHeightTiles - 1);
                }

                GUILayout.Label("Plane", GUILayout.Width(35));
                _plane = EditorGUILayout.IntField(_plane, EditorStyles.toolbarTextField, GUILayout.Width(35));
                GUILayout.Label("Floor", GUILayout.Width(32));
                _storey = Mathf.Max(0, EditorGUILayout.IntField(_storey, EditorStyles.toolbarTextField, GUILayout.Width(30)));

                GUILayout.FlexibleSpace();
                GUI.enabled = _session.CanUndo;
                if (GUILayout.Button("Undo", EditorStyles.toolbarButton, GUILayout.Width(45))) { _session.Undo(); Repaint(); }
                GUI.enabled = _session.CanRedo;
                if (GUILayout.Button("Redo", EditorStyles.toolbarButton, GUILayout.Width(45))) { _session.Redo(); Repaint(); }
                GUI.enabled = true;
                if (GUILayout.Button("Save", EditorStyles.toolbarButton, GUILayout.Width(45))) SaveProduction();
            }
        }

        private void DrawModeOptions()
        {
            using (new EditorGUILayout.HorizontalScope(EditorStyles.helpBox))
            {
                GUILayout.Label($"Brush {BrushSizes[_brushIndex]}x{BrushSizes[_brushIndex]}", GUILayout.Width(105));
                switch (_mode)
                {
                    case WorldEditorMode.Terrain:
                        GUILayout.Label("Ground ID", GUILayout.Width(60));
                        _groundId = EditorGUILayout.TextField(_groundId, GUILayout.Width(170));
                        for (var i = 0; i < GroundPresets.Length; i++)
                        {
                            var label = GroundPresets[i].Substring("ground.".Length);
                            if (GUILayout.Button(label, GUILayout.Height(18))) _groundId = GroundPresets[i];
                        }
                        break;

                    case WorldEditorMode.Elevation:
                        GUILayout.Label("Paint: left = raise +1, Shift+left = lower -1. Logical elevation remains integer/discrete.");
                        break;

                    case WorldEditorMode.Water:
                        _waterMode = (WaterPaintMode)GUILayout.Toolbar((int)_waterMode, new[] { "Water", "Deep Water", "Erase" }, GUILayout.Width(260));
                        break;

                    case WorldEditorMode.Pathing:
                        _pathingMode = (PathingPaintMode)GUILayout.Toolbar((int)_pathingMode, new[] { "Movement", "Ranged LOS", "No Build" }, GUILayout.Width(300));
                        GUILayout.Label("Shift+paint erases the selected flag.");
                        break;

                    default:
                        GUILayout.Label("This authoring layer has a data foundation but its tactile painting tool is not wired into this window yet.");
                        break;
                }
            }
        }

        private void DrawCanvas(Rect canvas)
        {
            if (canvas.width <= 0 || canvas.height <= 0) return;
            EditorGUI.DrawRect(canvas, new Color(0.105f, 0.11f, 0.12f));

            GUI.BeginGroup(canvas);
            var localRect = new Rect(0, 0, canvas.width, canvas.height);
            var bounds = VisibleBounds(localRect);
            DrawTiles(localRect, bounds);
            DrawGrid(localRect, bounds);
            DrawStrokePreview(localRect, bounds);
            GUI.EndGroup();

            HandleCanvasInput(canvas, bounds);
        }

        private void DrawTiles(Rect localRect, TileBounds bounds)
        {
            for (var y = bounds.MinY; y <= bounds.MaxY; y++)
            {
                if (y < 0 || y >= WorldConstants.WorldHeightTiles) continue;
                for (var x = bounds.MinX; x <= bounds.MaxX; x++)
                {
                    if (x < 0 || x >= WorldConstants.WorldWidthTiles) continue;
                    var location = Loc(x, y);
                    var rect = TileRect(x, y, bounds);
                    if (!_store.TryGetCell(location, out var cell)) continue;

                    EditorGUI.DrawRect(rect, GroundColor(cell.GroundId));
                    if ((cell.Flags & TileFlags.DeepWater) != 0)
                        EditorGUI.DrawRect(rect, new Color(0.05f, 0.18f, 0.35f, 0.82f));
                    else if ((cell.Flags & TileFlags.Water) != 0)
                        EditorGUI.DrawRect(rect, new Color(0.08f, 0.33f, 0.52f, 0.70f));

                    if ((cell.Flags & TileFlags.MovementBlocked) != 0)
                        EditorGUI.DrawRect(rect, new Color(0.55f, 0.08f, 0.08f, 0.20f));
                    if ((cell.Flags & TileFlags.NoBuild) != 0)
                        EditorGUI.DrawRect(rect, new Color(0.65f, 0.45f, 0.05f, 0.16f));

                    if (_pixelsPerTile >= 26f && cell.Elevation != 0)
                    {
                        var style = EditorStyles.miniLabel;
                        GUI.Label(rect, cell.Elevation.ToString(), style);
                    }
                }
            }
        }

        private void DrawGrid(Rect localRect, TileBounds bounds)
        {
            if (_pixelsPerTile < 10f) return;
            Handles.BeginGUI();
            var previous = Handles.color;
            Handles.color = new Color(1f, 1f, 1f, _pixelsPerTile >= 18f ? 0.11f : 0.055f);

            for (var x = bounds.MinX; x <= bounds.MaxX + 1; x++)
            {
                var px = (x - bounds.MinX) * _pixelsPerTile;
                Handles.DrawLine(new Vector3(px, 0), new Vector3(px, localRect.height));
            }
            for (var y = bounds.MinY; y <= bounds.MaxY + 1; y++)
            {
                var py = (y - bounds.MinY) * _pixelsPerTile;
                Handles.DrawLine(new Vector3(0, py), new Vector3(localRect.width, py));
            }
            Handles.color = previous;
            Handles.EndGUI();
        }

        private void DrawStrokePreview(Rect localRect, TileBounds bounds)
        {
            if (_strokeTiles.Count == 0) return;
            foreach (var tile in _strokeTiles)
            {
                if (tile.X < bounds.MinX || tile.X > bounds.MaxX || tile.Y < bounds.MinY || tile.Y > bounds.MaxY) continue;
                EditorGUI.DrawRect(TileRect(tile.X, tile.Y, bounds), new Color(1f, 1f, 1f, 0.22f));
            }
        }

        private void HandleCanvasInput(Rect canvas, TileBounds bounds)
        {
            var e = Event.current;
            if (!canvas.Contains(e.mousePosition)) return;
            var local = e.mousePosition - canvas.position;

            if (e.type == EventType.ScrollWheel)
            {
                _pixelsPerTile = Mathf.Clamp(_pixelsPerTile - e.delta.y * 1.5f, 6f, 48f);
                e.Use();
                Repaint();
                return;
            }

            if ((e.button == 2 || (e.button == 0 && e.alt)) && e.type == EventType.MouseDrag)
            {
                _centerX = Mathf.Clamp(_centerX - e.delta.x / _pixelsPerTile, 0f, WorldConstants.WorldWidthTiles - 1f);
                _centerY = Mathf.Clamp(_centerY - e.delta.y / _pixelsPerTile, 0f, WorldConstants.WorldHeightTiles - 1f);
                e.Use();
                Repaint();
                return;
            }

            var tile = new GridCoord(
                bounds.MinX + Mathf.FloorToInt(local.x / _pixelsPerTile),
                bounds.MinY + Mathf.FloorToInt(local.y / _pixelsPerTile));

            if (e.button == 1 && e.type == EventType.MouseDown)
            {
                Eyedrop(tile);
                e.Use();
                return;
            }

            if (e.button != 0 || e.alt) return;
            if (e.type == EventType.MouseDown)
            {
                _paintingStroke = true;
                _strokeErase = e.shift;
                _strokeTiles.Clear();
                AddBrushToStroke(tile);
                e.Use();
                Repaint();
            }
            else if (_paintingStroke && e.type == EventType.MouseDrag)
            {
                AddBrushToStroke(tile);
                e.Use();
                Repaint();
            }
            else if (_paintingStroke && (e.type == EventType.MouseUp || e.rawType == EventType.MouseUp))
            {
                ApplyStroke();
                _paintingStroke = false;
                _strokeTiles.Clear();
                e.Use();
                Repaint();
            }
        }

        private void AddBrushToStroke(GridCoord center)
        {
            if (!WorldConstants.IsInsideWorld(center)) return;
            var location = new GridLocation(center, _plane, _storey);
            foreach (var cell in WorldBrush.Cells(location, BrushSizes[_brushIndex], _brushShape))
                if (WorldConstants.IsInsideWorld(cell.Tile)) _strokeTiles.Add(cell.Tile);
        }

        private void ApplyStroke()
        {
            if (_strokeTiles.Count == 0) return;
            if (_mode == WorldEditorMode.Terrain && !ContentId.TryCreate(_groundId, out _))
            {
                _status = "Invalid ground ID. Use lower-case a-z, 0-9, '.', '_', '-' or '/'.";
                return;
            }

            var edits = new List<WorldCellEdit>(_strokeTiles.Count);
            foreach (var tile in _strokeTiles)
            {
                var location = new GridLocation(tile, _plane, _storey);
                _store.GetOrCreatePage(location);
                _store.TryGetCell(location, out var cell);
                edits.Add(new WorldCellEdit(location, PaintCell(cell)));
            }

            var changed = _session.Apply(StrokeLabel(), edits);
            _status = changed > 0 ? $"Edited {changed:N0} tile(s). {_session.DirtyPageCount} page(s) dirty." : "Stroke made no changes.";
        }

        private AuthoredTileCell PaintCell(AuthoredTileCell cell)
        {
            switch (_mode)
            {
                case WorldEditorMode.Terrain:
                    return Copy(cell, groundId: new ContentId(_groundId));

                case WorldEditorMode.Elevation:
                    return Copy(cell, elevation: checked((short)(cell.Elevation + (_strokeErase ? -1 : 1))));

                case WorldEditorMode.Water:
                {
                    var flags = cell.Flags & ~(TileFlags.Water | TileFlags.DeepWater);
                    if (_waterMode == WaterPaintMode.Water) flags |= TileFlags.Water;
                    else if (_waterMode == WaterPaintMode.DeepWater) flags |= TileFlags.DeepWater;
                    return Copy(cell, flags: flags);
                }

                case WorldEditorMode.Pathing:
                {
                    var bit = _pathingMode == PathingPaintMode.Movement ? TileFlags.MovementBlocked
                        : _pathingMode == PathingPaintMode.LineOfSight ? TileFlags.RangedLineOfSightBlocked
                        : TileFlags.NoBuild;
                    var flags = _strokeErase ? cell.Flags & ~bit : cell.Flags | bit;
                    return Copy(cell, flags: flags);
                }

                default:
                    return cell;
            }
        }

        private void Eyedrop(GridCoord tile)
        {
            var location = new GridLocation(tile, _plane, _storey);
            if (!_store.TryGetCell(location, out var cell)) return;
            _groundId = cell.GroundId.Value;
            _status = $"Sampled {cell.GroundId} at {tile.X}, {tile.Y} (elevation {cell.Elevation}).";
            Repaint();
        }

        private void EnsureVisiblePagesLoaded(Rect canvas)
        {
            var bounds = VisibleBounds(new Rect(0, 0, canvas.width, canvas.height));
            var minX = Mathf.Clamp(bounds.MinX, 0, WorldConstants.WorldWidthTiles - 1);
            var minY = Mathf.Clamp(bounds.MinY, 0, WorldConstants.WorldHeightTiles - 1);
            var maxX = Mathf.Clamp(bounds.MaxX, 0, WorldConstants.WorldWidthTiles - 1);
            var maxY = Mathf.Clamp(bounds.MaxY, 0, WorldConstants.WorldHeightTiles - 1);
            var size = _store.PageSize;

            for (var py = minY / size; py <= maxY / size; py++)
            {
                for (var px = minX / size; px <= maxX / size; px++)
                {
                    var key = new WorldPageKey(new WorldPageCoord(px, py), _plane, _storey);
                    if (_diskChecked.Contains(key)) continue;
                    _diskChecked.Add(key);
                    if (!WorldPageJsonPersistence.TryLoad(key, out var document)) continue;
                    try
                    {
                        _store.ImportPage(WorldPageCodec.Decode(document));
                    }
                    catch (Exception ex)
                    {
                        Debug.LogError($"Failed to load MassRPG world page {key}: {ex}");
                    }
                }
            }
        }

        private void SaveProduction()
        {
            if (_session.DirtyPageCount == 0)
            {
                _status = "Nothing to save.";
                return;
            }

            var documents = _session.BuildDirtyPageDocuments();
            for (var i = 0; i < documents.Count; i++) WorldPageJsonPersistence.Save(documents[i]);
            _session.MarkAllSaved();
            AssetDatabase.Refresh();
            _status = $"Saved {documents.Count} changed page(s) to {WorldPageJsonPersistence.ProductionRoot}.";
        }

        private void SaveRecovery()
        {
            if (_session == null || _session.DirtyPageCount == 0) return;
            var documents = _session.BuildDirtyPageDocuments();
            for (var i = 0; i < documents.Count; i++) WorldPageJsonPersistence.Save(documents[i], WorldPageJsonPersistence.RecoveryRoot);
            _status = $"Autosaved recovery copy for {documents.Count} dirty page(s).";
            Repaint();
        }

        private void HandleKeyboardShortcuts(Event e)
        {
            if (e.type != EventType.KeyDown) return;
            if ((e.control || e.command) && e.keyCode == KeyCode.S)
            {
                SaveProduction();
                e.Use();
            }
            else if ((e.control || e.command) && e.keyCode == KeyCode.Z && !e.shift)
            {
                if (_session.Undo()) _status = "Undo: " + _session.RedoLabel;
                e.Use();
                Repaint();
            }
            else if ((e.control || e.command) && ((e.keyCode == KeyCode.Z && e.shift) || e.keyCode == KeyCode.Y))
            {
                if (_session.Redo()) _status = "Redo: " + _session.UndoLabel;
                e.Use();
                Repaint();
            }
        }

        private void DrawStatusBar(float y)
        {
            var rect = new Rect(0, y, position.width, 22f);
            EditorGUI.DrawRect(rect, new Color(0.13f, 0.13f, 0.13f));
            var center = $"Center {Mathf.RoundToInt(_centerX)}, {Mathf.RoundToInt(_centerY)}   Zoom {_pixelsPerTile:0}px/tile   Dirty pages {_session.DirtyPageCount}";
            GUI.Label(new Rect(6, y + 2, position.width * 0.55f, 18), _status, EditorStyles.miniLabel);
            GUI.Label(new Rect(position.width * 0.55f, y + 2, position.width * 0.44f, 18), center, EditorStyles.miniLabel);
        }

        private TileBounds VisibleBounds(Rect localRect)
        {
            var columns = Mathf.CeilToInt(localRect.width / _pixelsPerTile) + 2;
            var rows = Mathf.CeilToInt(localRect.height / _pixelsPerTile) + 2;
            var minX = Mathf.FloorToInt(_centerX - columns * 0.5f);
            var minY = Mathf.FloorToInt(_centerY - rows * 0.5f);
            return new TileBounds(minX, minY, minX + columns, minY + rows);
        }

        private Rect TileRect(int x, int y, TileBounds bounds)
            => new Rect((x - bounds.MinX) * _pixelsPerTile, (y - bounds.MinY) * _pixelsPerTile, _pixelsPerTile, _pixelsPerTile);

        private GridLocation Loc(int x, int y) => new GridLocation(new GridCoord(x, y), _plane, _storey);

        private static AuthoredTileCell Copy(
            AuthoredTileCell cell,
            ContentId? groundId = null,
            short? elevation = null,
            TileFlags? flags = null)
            => new AuthoredTileCell(
                groundId ?? cell.GroundId,
                elevation ?? cell.Elevation,
                flags ?? cell.Flags,
                cell.MovementBlockedEdges,
                cell.LineOfSightBlockedEdges,
                cell.ElevationTransitionEdges);

        private string StrokeLabel()
        {
            switch (_mode)
            {
                case WorldEditorMode.Terrain: return "Paint terrain";
                case WorldEditorMode.Elevation: return _strokeErase ? "Lower elevation" : "Raise elevation";
                case WorldEditorMode.Water: return "Paint water";
                case WorldEditorMode.Pathing: return _strokeErase ? "Erase pathing" : "Paint pathing";
                default: return "World edit";
            }
        }

        private static Color GroundColor(ContentId id)
        {
            if (id.IsEmpty || id.Value == "ground.unpainted") return new Color(0.16f, 0.16f, 0.17f);
            unchecked
            {
                var hash = id.GetHashCode();
                var hue = ((hash & 0x7fffffff) % 1000) / 1000f;
                return Color.HSVToRGB(hue, 0.33f, 0.56f);
            }
        }

        private readonly struct TileBounds
        {
            public TileBounds(int minX, int minY, int maxX, int maxY)
            {
                MinX = minX;
                MinY = minY;
                MaxX = maxX;
                MaxY = maxY;
            }
            public int MinX { get; }
            public int MinY { get; }
            public int MaxX { get; }
            public int MaxY { get; }
        }
    }
}
