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
    /// The visible terrain window follows the authoritative player rather than being a fixed
    /// spawn-time snapshot, which also gives us an early executable test of chunk streaming.
    /// </summary>
    public sealed class LocalPlayTestSession : MonoBehaviour
    {
        private const int RenderChunkRadius = 2;
        private const int OriginRebaseThresholdTiles = 128;
        private const float MovementStepSeconds = 0.12f;
        private const float ViewMoveSpeedTilesPerSecond = 10f;
        private const int MaximumMovementCatchupSteps = 8;

        private sealed class RuntimeTerrainChunk
        {
            public RuntimeTerrainChunk(GameObject root, Mesh mesh, int chunkX, int chunkY)
            {
                Root = root;
                Mesh = mesh;
                ChunkX = chunkX;
                ChunkY = chunkY;
            }

            public GameObject Root { get; }
            public Mesh Mesh { get; }
            public int ChunkX { get; }
            public int ChunkY { get; }
        }

        private readonly Dictionary<Vector2Int, RuntimeTerrainChunk> _terrainChunks =
            new Dictionary<Vector2Int, RuntimeTerrainChunk>();
        private readonly List<Vector2Int> _chunkRemovalBuffer = new List<Vector2Int>();

        private AuthoredWorldPageStore _world;
        private LocalGameAuthority _authority;
        private PlayerState _player;
        private GridPresentationSpace _presentation;
        private Transform _playerView;
        private Transform _destinationMarker;
        private BoundedObliqueCameraRig _cameraRig;
        private Material _terrainMaterial;
        private Material _playerMaterial;
        private Material _markerMaterial;
        private Vector2Int _terrainWindowCenter = new Vector2Int(int.MinValue, int.MinValue);
        private float _nextMovementStep;
        private string _lastDecision = "Click authored terrain to move.";
        private bool _legacyInputAvailable = true;

        public PlayerState Player => _player;
        public LocalGameAuthority Authority => _authority;
        public AuthoredWorldPageStore World => _world;
        public int LoadedRenderChunkCount => _terrainChunks.Count;

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
            CreateMaterials();
            RefreshTerrainWindow(true);
            CreatePlayerView();
            CreateDestinationMarker();
            CreateCamera();
            SyncPlayerView(true);
            SyncDestinationMarker();

            _lastDecision = world.IsWalkable(spawnLocation)
                ? "Spawned through local authority. Click terrain to issue a MoveTo request."
                : "Spawn tile is not walkable or its page is missing; visual inspection is still available.";
        }

        private void Update()
        {
            if (_authority == null || _player == null) return;

            AdvanceAuthoritativeMovement();
            RebasePresentationIfNeeded();
            RefreshTerrainWindow(false);
            SyncPlayerView(false);
            SyncDestinationMarker();
            HandleLegacyInput();
        }

        private void AdvanceAuthoritativeMovement()
        {
            if (!_player.Movement.IsMoving) return;

            var now = Time.unscaledTime;
            var steps = 0;
            while (_player.Movement.IsMoving
                   && now >= _nextMovementStep
                   && steps < MaximumMovementCatchupSteps)
            {
                if (!_authority.AdvanceMovementOneStep(_player.CharacterId))
                {
                    _lastDecision = "Movement stopped because the next authoritative step became invalid.";
                    break;
                }

                steps++;
                _nextMovementStep += MovementStepSeconds;
            }

            // Do not let a long editor pause create a huge movement burst when focus returns.
            if (steps >= MaximumMovementCatchupSteps && now > _nextMovementStep + MovementStepSeconds)
                _nextMovementStep = now + MovementStepSeconds;
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
                if (decision.Accepted) _nextMovementStep = Time.unscaledTime;
                SyncDestinationMarker();
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

        private void CreateMaterials()
        {
            _terrainMaterial = CreateMaterial(new Color(0.32f, 0.43f, 0.27f));
            _playerMaterial = CreateMaterial(new Color(0.72f, 0.73f, 0.78f));
            _markerMaterial = CreateMaterial(new Color(0.95f, 0.77f, 0.18f));
        }

        private void RefreshTerrainWindow(bool force)
        {
            if (_world == null || _presentation == null || _player == null) return;
            var chunkSize = WorldConstants.DefaultRenderChunkSize;
            var center = new Vector2Int(_player.Tile.X / chunkSize, _player.Tile.Y / chunkSize);
            if (!force && center == _terrainWindowCenter) return;
            _terrainWindowCenter = center;

            _chunkRemovalBuffer.Clear();
            foreach (var pair in _terrainChunks)
            {
                if (Mathf.Abs(pair.Key.x - center.x) <= RenderChunkRadius
                    && Mathf.Abs(pair.Key.y - center.y) <= RenderChunkRadius)
                    continue;
                _chunkRemovalBuffer.Add(pair.Key);
            }

            for (var i = 0; i < _chunkRemovalBuffer.Count; i++)
                RemoveTerrainChunk(_chunkRemovalBuffer[i]);

            for (var cy = center.y - RenderChunkRadius; cy <= center.y + RenderChunkRadius; cy++)
            {
                if (cy < 0) continue;
                for (var cx = center.x - RenderChunkRadius; cx <= center.x + RenderChunkRadius; cx++)
                {
                    if (cx < 0) continue;
                    var key = new Vector2Int(cx, cy);
                    if (_terrainChunks.ContainsKey(key)) continue;
                    TryCreateTerrainChunk(cx, cy);
                }
            }
        }

        private void TryCreateTerrainChunk(int chunkX, int chunkY)
        {
            var chunkSize = WorldConstants.DefaultRenderChunkSize;
            var start = new GridCoord(chunkX * chunkSize, chunkY * chunkSize);
            if (!WorldConstants.IsInsideWorld(start)) return;

            var mesh = LogicalTerrainChunkMeshBuilder.Build(
                _world,
                chunkX,
                chunkY,
                _player.Plane,
                _player.Storey,
                _presentation.TileSize,
                _presentation.ElevationStepHeight,
                chunkSize);
            if (mesh.vertexCount == 0)
            {
                Destroy(mesh);
                return;
            }

            var chunk = new GameObject($"Terrain Chunk {chunkX},{chunkY}");
            chunk.transform.SetParent(_presentation.transform, false);
            PositionTerrainChunk(chunk.transform, chunkX, chunkY);

            var filter = chunk.AddComponent<MeshFilter>();
            filter.sharedMesh = mesh;
            var renderer = chunk.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = _terrainMaterial;
            var collider = chunk.AddComponent<MeshCollider>();
            collider.sharedMesh = mesh;

            var key = new Vector2Int(chunkX, chunkY);
            _terrainChunks.Add(key, new RuntimeTerrainChunk(chunk, mesh, chunkX, chunkY));
        }

        private void PositionTerrainChunk(Transform chunk, int chunkX, int chunkY)
        {
            var chunkSize = WorldConstants.DefaultRenderChunkSize;
            var start = new GridCoord(chunkX * chunkSize, chunkY * chunkSize);
            chunk.position = _presentation.ToWorldPosition(
                new GridLocation(start, _player.Plane, _player.Storey),
                0);
        }

        private void RemoveTerrainChunk(Vector2Int key)
        {
            if (!_terrainChunks.TryGetValue(key, out var runtime)) return;
            _terrainChunks.Remove(key);
            if (runtime.Root != null) Destroy(runtime.Root);
            if (runtime.Mesh != null) Destroy(runtime.Mesh);
        }

        private void RebasePresentationIfNeeded()
        {
            if (_presentation == null || _player == null) return;
            var origin = _presentation.OriginTile;
            if (Math.Abs(_player.Tile.X - origin.X) < OriginRebaseThresholdTiles
                && Math.Abs(_player.Tile.Y - origin.Y) < OriginRebaseThresholdTiles)
                return;

            var oldPlayerWorld = PlayerWorldPosition();
            _presentation.SetOrigin(_player.Tile);
            var newPlayerWorld = PlayerWorldPosition();
            var worldShift = newPlayerWorld - oldPlayerWorld;

            foreach (var runtime in _terrainChunks.Values)
                if (runtime.Root != null)
                    PositionTerrainChunk(runtime.Root.transform, runtime.ChunkX, runtime.ChunkY);

            if (_playerView != null) _playerView.position += worldShift;
            if (_destinationMarker != null) _destinationMarker.position += worldShift;

            var camera = UnityEngine.Camera.main;
            if (camera != null) camera.transform.position += worldShift;
        }

        private void CreatePlayerView()
        {
            var capsule = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            capsule.name = "Editor Test Character";
            capsule.transform.SetParent(transform, true);
            var collider = capsule.GetComponent<Collider>();
            if (collider != null) collider.enabled = false;
            _playerView = capsule.transform;
            var renderer = capsule.GetComponent<Renderer>();
            if (renderer != null) renderer.sharedMaterial = _playerMaterial;
        }

        private void CreateDestinationMarker()
        {
            var marker = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            marker.name = "Move Destination";
            marker.transform.SetParent(transform, true);
            marker.transform.localScale = new Vector3(0.62f, 0.025f, 0.62f);
            var collider = marker.GetComponent<Collider>();
            if (collider != null) collider.enabled = false;
            var renderer = marker.GetComponent<Renderer>();
            if (renderer != null) renderer.sharedMaterial = _markerMaterial;
            _destinationMarker = marker.transform;
            marker.SetActive(false);
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

        private Vector3 PlayerWorldPosition()
        {
            var elevation = _world.GetLogicalElevation(_player.Location);
            var position = _presentation.ToWorldPosition(_player.Location, elevation);
            position.y += 1f;
            return position;
        }

        private void SyncPlayerView(bool snap)
        {
            if (_playerView == null || _player == null || _presentation == null) return;
            var target = PlayerWorldPosition();
            if (snap)
            {
                _playerView.position = target;
                return;
            }

            var speed = Mathf.Max(0.01f, _presentation.TileSize * ViewMoveSpeedTilesPerSecond);
            _playerView.position = Vector3.MoveTowards(
                _playerView.position,
                target,
                speed * Time.unscaledDeltaTime);
        }

        private void SyncDestinationMarker()
        {
            if (_destinationMarker == null || _player == null || _presentation == null) return;
            var destination = _player.Movement.Destination;
            if (!destination.HasValue)
            {
                _destinationMarker.gameObject.SetActive(false);
                return;
            }

            var elevation = _world.GetLogicalElevation(destination.Value);
            var position = _presentation.ToWorldPosition(destination.Value, elevation);
            position.y += 0.035f;
            _destinationMarker.position = position;
            _destinationMarker.gameObject.SetActive(true);
        }

        private void OnGUI()
        {
            if (_player == null) return;
            var origin = _presentation != null ? _presentation.OriginTile : _player.Tile;
            var text =
                $"MassRPG - Play From Here\n" +
                $"Tile: {_player.Tile.X}, {_player.Tile.Y}   Plane: {_player.Plane}   Floor: {_player.Storey}\n" +
                $"Render chunks: {_terrainChunks.Count}   Presentation origin: {origin.X}, {origin.Y}\n" +
                $"{_lastDecision}\n" +
                "Left click: move   Mouse wheel: zoom   Stop Play Mode: return to editor";
            GUI.Box(new Rect(12f, 12f, 560f, 98f), text);
        }

        private void OnDestroy()
        {
            _chunkRemovalBuffer.Clear();
            foreach (var runtime in _terrainChunks.Values)
            {
                if (runtime.Root != null) Destroy(runtime.Root);
                if (runtime.Mesh != null) Destroy(runtime.Mesh);
            }
            _terrainChunks.Clear();

            if (_terrainMaterial != null) Destroy(_terrainMaterial);
            if (_playerMaterial != null) Destroy(_playerMaterial);
            if (_markerMaterial != null) Destroy(_markerMaterial);
        }

        private static Material CreateMaterial(Color color)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit")
                ?? Shader.Find("Standard")
                ?? Shader.Find("Unlit/Color");
            if (shader == null) throw new InvalidOperationException("No suitable built-in terrain test shader was found.");
            return new Material(shader) { color = color };
        }
    }
}
