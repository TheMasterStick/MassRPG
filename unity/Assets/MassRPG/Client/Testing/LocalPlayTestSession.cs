using System;
using System.Collections.Generic;
using MassRPG.Client.Camera;
using MassRPG.Client.World;
using MassRPG.Core.Authority;
using MassRPG.Core.Characters;
using MassRPG.Core.World;
using MassRPG.Data.Items;
using MassRPG.Data.World;
using MassRPG.Server.Authority;
using UnityEngine;

namespace MassRPG.Client.Testing
{
    /// <summary>
    /// Lightweight in-process play session used by the World Editor's Play From Here command.
    /// It still routes movement through LocalGameAuthority so editor testing exercises the same
    /// request -> authoritative simulation -> presentation split intended for the real client.
    /// </summary>
    public sealed class LocalPlayTestSession : MonoBehaviour
    {
        private const int RenderChunkRadius = 2;
        private const float MovementStepSeconds = 0.12f;

        private readonly List<Mesh> _terrainMeshes = new List<Mesh>();
        private AuthoredWorldPageStore _world;
        private LocalGameAuthority _authority;
        private PlayerState _player;
        private GridPresentationSpace _presentation;
        private Transform _playerView;
        private BoundedObliqueCameraRig _cameraRig;
        private Material _terrainMaterial;
        private Material _playerMaterial;
        private float _nextMovementStep;
        private string _lastDecision = "Click authored terrain to move.";
        private bool _legacyInputAvailable = true;

        public PlayerState Player => _player;
        public LocalGameAuthority Authority => _authority;
        public AuthoredWorldPageStore World => _world;

        public void Initialize(AuthoredWorldPageStore world, GridLocation spawnLocation)
        {
            if (world == null) throw new ArgumentNullException(nameof(world));
            if (!WorldConstants.IsInsideWorld(spawnLocation.Tile))
                throw new ArgumentOutOfRangeException(nameof(spawnLocation));

            _world = world;
            _authority = new LocalGameAuthority(new ItemCatalog(), world);
            _player = new PlayerState(Guid.NewGuid(), "Editor Test Character")
            {
                Location = spawnLocation
            };
            _authority.RegisterPlayer(_player);

            gameObject.name = "MassRPG Play From Here Session";
            CreatePresentationSpace(spawnLocation.Tile);
            CreateTerrain(spawnLocation);
            CreatePlayerView();
            CreateCamera();
            SyncPlayerView();

            _lastDecision = world.IsWalkable(spawnLocation)
                ? "Spawned through local authority. Click terrain to issue a MoveTo request."
                : "Spawn tile is not walkable or its page is missing; visual inspection is still available.";
        }

        private void Update()
        {
            if (_authority == null || _player == null) return;

            if (_player.Movement.IsMoving && Time.unscaledTime >= _nextMovementStep)
            {
                _authority.AdvanceMovementOneStep(_player.CharacterId);
                _nextMovementStep = Time.unscaledTime + MovementStepSeconds;
            }
            SyncPlayerView();
            HandleLegacyInput();
        }

        private void HandleLegacyInput()
        {
            if (!_legacyInputAvailable || _cameraRig == null) return;
            try
            {
                var scroll = Input.mouseScrollDelta.y;
                if (Mathf.Abs(scroll) > 0.001f) _cameraRig.ApplyZoomDelta(scroll);
                if (!Input.GetMouseButtonDown(0)) return;

                var camera = UnityEngine.Camera.main;
                if (camera == null) return;
                var ray = camera.ScreenPointToRay(Input.mousePosition);
                if (!Physics.Raycast(ray, out var hit, 1000f)) return;
                var tile = _presentation.WorldPositionToTile(hit.point);
                if (!WorldConstants.IsInsideWorld(tile)) return;
                var destination = new GridLocation(tile, _player.Plane, _player.Storey);
                var decision = _authority.Submit(new MoveToRequest(Guid.NewGuid(), _player.CharacterId, destination));
                _lastDecision = decision.Accepted
                    ? $"Move accepted -> {tile.X}, {tile.Y} ({_player.Movement.RemainingSteps} step(s))."
                    : $"Move rejected: {decision.Code}.";
                _nextMovementStep = Time.unscaledTime;
            }
            catch (InvalidOperationException)
            {
                // Projects configured for only the new Input System throw when legacy Input is read.
                // The session remains useful for spawn/camera/terrain validation rather than failing.
                _legacyInputAvailable = false;
                _lastDecision = "Legacy mouse input is disabled by this Unity project; Play From Here inspection remains active.";
            }
        }

        private void CreatePresentationSpace(GridCoord origin)
        {
            var root = new GameObject("Presentation Space");
            root.transform.SetParent(transform, false);
            _presentation = root.AddComponent<GridPresentationSpace>();
            _presentation.SetOrigin(origin);
        }

        private void CreateTerrain(GridLocation spawn)
        {
            _terrainMaterial = CreateMaterial(new Color(0.32f, 0.43f, 0.27f));
            var chunkSize = WorldConstants.DefaultRenderChunkSize;
            var centerChunkX = spawn.Tile.X / chunkSize;
            var centerChunkY = spawn.Tile.Y / chunkSize;

            for (var cy = centerChunkY - RenderChunkRadius; cy <= centerChunkY + RenderChunkRadius; cy++)
            {
                if (cy < 0) continue;
                for (var cx = centerChunkX - RenderChunkRadius; cx <= centerChunkX + RenderChunkRadius; cx++)
                {
                    if (cx < 0) continue;
                    var start = new GridCoord(cx * chunkSize, cy * chunkSize);
                    if (!WorldConstants.IsInsideWorld(start)) continue;

                    var mesh = LogicalTerrainChunkMeshBuilder.Build(
                        _world,
                        cx,
                        cy,
                        spawn.Plane,
                        spawn.Storey,
                        _presentation.TileSize,
                        _presentation.ElevationStepHeight,
                        chunkSize);
                    if (mesh.vertexCount == 0)
                    {
                        Destroy(mesh);
                        continue;
                    }

                    _terrainMeshes.Add(mesh);
                    var chunk = new GameObject($"Terrain Chunk {cx},{cy}");
                    chunk.transform.SetParent(_presentation.transform, false);
                    chunk.transform.position = _presentation.ToWorldPosition(new GridLocation(start, spawn.Plane, spawn.Storey), 0);
                    var filter = chunk.AddComponent<MeshFilter>();
                    filter.sharedMesh = mesh;
                    var renderer = chunk.AddComponent<MeshRenderer>();
                    renderer.sharedMaterial = _terrainMaterial;
                    var collider = chunk.AddComponent<MeshCollider>();
                    collider.sharedMesh = mesh;
                }
            }
        }

        private void CreatePlayerView()
        {
            var capsule = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            capsule.name = "Editor Test Character";
            capsule.transform.SetParent(transform, true);
            var collider = capsule.GetComponent<Collider>();
            if (collider != null) collider.enabled = false;
            _playerView = capsule.transform;
            _playerMaterial = CreateMaterial(new Color(0.72f, 0.73f, 0.78f));
            var renderer = capsule.GetComponent<Renderer>();
            if (renderer != null) renderer.sharedMaterial = _playerMaterial;
        }

        private void CreateCamera()
        {
            var existing = UnityEngine.Camera.main;
            if (existing != null) existing.enabled = false;

            var rig = new GameObject("MassRPG Test Camera Rig");
            rig.transform.SetParent(transform, false);
            var cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.SetParent(rig.transform, false);
            var camera = cameraObject.AddComponent<UnityEngine.Camera>();
            camera.nearClipPlane = 0.05f;
            camera.farClipPlane = 600f;
            camera.clearFlags = CameraClearFlags.Skybox;
            cameraObject.AddComponent<AudioListener>();

            _cameraRig = rig.AddComponent<BoundedObliqueCameraRig>();
            _cameraRig.FollowTarget = _playerView;
            _cameraRig.SetNormalizedZoom(0.35f);
        }

        private void SyncPlayerView()
        {
            if (_playerView == null || _player == null || _presentation == null) return;
            var elevation = _world.GetLogicalElevation(_player.Location);
            var position = _presentation.ToWorldPosition(_player.Location, elevation);
            position.y += 1f;
            _playerView.position = position;
        }

        private void OnGUI()
        {
            if (_player == null) return;
            var text = $"MassRPG - Play From Here\nTile: {_player.Tile.X}, {_player.Tile.Y}   Plane: {_player.Plane}   Floor: {_player.Storey}\n{_lastDecision}\nEsc/Stop Play Mode returns to the editor.";
            GUI.Box(new Rect(12f, 12f, 520f, 78f), text);
        }

        private void OnDestroy()
        {
            for (var i = 0; i < _terrainMeshes.Count; i++)
                if (_terrainMeshes[i] != null) Destroy(_terrainMeshes[i]);
            _terrainMeshes.Clear();
            if (_terrainMaterial != null) Destroy(_terrainMaterial);
            if (_playerMaterial != null) Destroy(_playerMaterial);
        }

        private static Material CreateMaterial(Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit")
                ?? Shader.Find("Standard")
                ?? Shader.Find("Unlit/Color");
            if (shader == null) throw new InvalidOperationException("No suitable built-in terrain test shader was found.");
            var material = new Material(shader) { color = color };
            return material;
        }
    }
}
