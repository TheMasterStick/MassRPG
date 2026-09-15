using System;
using MassRPG.Client.Testing;
using MassRPG.Core.Content;
using MassRPG.Core.World;
using MassRPG.Data.World;
using UnityEditor;
using UnityEngine;

namespace MassRPG.Editor.World
{
    /// <summary>
    /// Bridges an editor coordinate into an in-process authoritative test session. The request is
    /// kept in Unity SessionState so it survives the editor's play-mode domain reload but never
    /// contaminates canonical MassRPG world data or a player save.
    /// </summary>
    [InitializeOnLoad]
    public static class MassRPGPlayFromHereCoordinator
    {
        private const string PendingKey = "MassRPG.PlayFromHere.Pending";
        private const string XKey = "MassRPG.PlayFromHere.X";
        private const string YKey = "MassRPG.PlayFromHere.Y";
        private const string PlaneKey = "MassRPG.PlayFromHere.Plane";
        private const string StoreyKey = "MassRPG.PlayFromHere.Storey";

        static MassRPGPlayFromHereCoordinator()
        {
            EditorApplication.playModeStateChanged -= OnPlayModeStateChanged;
            EditorApplication.playModeStateChanged += OnPlayModeStateChanged;
        }

        public static bool HasPendingRequest => SessionState.GetBool(PendingKey, false);

        public static void Start(GridLocation location)
        {
            if (!WorldConstants.IsInsideWorld(location.Tile))
                throw new ArgumentOutOfRangeException(nameof(location));
            if (EditorApplication.isPlayingOrWillChangePlaymode) return;

            SessionState.SetBool(PendingKey, true);
            SessionState.SetInt(XKey, location.Tile.X);
            SessionState.SetInt(YKey, location.Tile.Y);
            SessionState.SetInt(PlaneKey, location.Plane);
            SessionState.SetInt(StoreyKey, location.Storey);
            EditorApplication.EnterPlaymode();
        }

        public static void CancelPending()
        {
            SessionState.EraseBool(PendingKey);
            SessionState.EraseInt(XKey);
            SessionState.EraseInt(YKey);
            SessionState.EraseInt(PlaneKey);
            SessionState.EraseInt(StoreyKey);
        }

        private static void OnPlayModeStateChanged(PlayModeStateChange change)
        {
            if (change == PlayModeStateChange.ExitingEditMode && HasPendingRequest)
                return;

            if (change == PlayModeStateChange.EnteredPlayMode && HasPendingRequest)
            {
                try
                {
                    StartRuntimeSession(ReadLocation());
                }
                catch (Exception ex)
                {
                    Debug.LogError("MassRPG Play From Here failed to initialize: " + ex);
                }
                finally
                {
                    CancelPending();
                }
                return;
            }

            if (change == PlayModeStateChange.EnteredEditMode)
                CancelPending();
        }

        private static GridLocation ReadLocation()
            => new GridLocation(
                new GridCoord(SessionState.GetInt(XKey, WorldConstants.WorldWidthTiles / 2),
                    SessionState.GetInt(YKey, WorldConstants.WorldHeightTiles / 2)),
                SessionState.GetInt(PlaneKey, WorldConstants.SurfacePlane),
                SessionState.GetInt(StoreyKey, 0));

        private static void StartRuntimeSession(GridLocation spawn)
        {
            var store = LoadNearbyPages(spawn);
            var root = new GameObject("MassRPG Play From Here");
            var session = root.AddComponent<LocalPlayTestSession>();
            session.Initialize(store, spawn);
            Debug.Log($"MassRPG Play From Here started at {spawn.Tile.X}, {spawn.Tile.Y}, plane {spawn.Plane}, floor {spawn.Storey}. Loaded {store.LoadedPageCount} authored page(s).");
        }

        private static AuthoredWorldPageStore LoadNearbyPages(GridLocation spawn)
        {
            var store = new AuthoredWorldPageStore(new ContentId("ground.unpainted"));
            var pageSize = store.PageSize;
            var centerPageX = spawn.Tile.X / pageSize;
            var centerPageY = spawn.Tile.Y / pageSize;
            var maxPageX = (WorldConstants.WorldWidthTiles - 1) / pageSize;
            var maxPageY = (WorldConstants.WorldHeightTiles - 1) / pageSize;

            // One storage-page margin gives the 5x5 render-chunk inspection window and nearby
            // click-to-move pathfinder data enough room even when the launch tile hugs a page edge.
            for (var py = Math.Max(0, centerPageY - 1); py <= Math.Min(maxPageY, centerPageY + 1); py++)
            {
                for (var px = Math.Max(0, centerPageX - 1); px <= Math.Min(maxPageX, centerPageX + 1); px++)
                {
                    var key = new WorldPageKey(new WorldPageCoord(px, py), spawn.Plane, spawn.Storey);
                    if (!WorldPageJsonPersistence.TryLoad(key, out var document)) continue;
                    store.ImportPage(WorldPageCodec.Decode(document));
                }
            }
            return store;
        }
    }
}
