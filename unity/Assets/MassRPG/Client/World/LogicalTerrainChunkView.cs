using MassRPG.Core.World;
using MassRPG.Data.World;
using UnityEngine;

namespace MassRPG.Client.World
{
    /// <summary>
    /// Disposable Unity view of one logical render chunk. AuthoredWorldPageStore remains the source
    /// of truth; unloading/destroying this GameObject cannot delete terrain data.
    /// </summary>
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class LogicalTerrainChunkView : MonoBehaviour
    {
        [SerializeField] private GridPresentationSpace presentationSpace;
        [SerializeField] private MeshFilter meshFilter;
        [SerializeField] private MeshCollider meshCollider;
        [SerializeField] private bool updateCollider = true;

        private Mesh _runtimeMesh;

        public int RenderChunkX { get; private set; }
        public int RenderChunkY { get; private set; }
        public int Plane { get; private set; }
        public int Storey { get; private set; }

        private void Awake()
        {
            if (meshFilter == null) meshFilter = GetComponent<MeshFilter>();
            if (meshCollider == null) meshCollider = GetComponent<MeshCollider>();
        }

        public void Rebuild(
            AuthoredWorldPageStore store,
            int renderChunkX,
            int renderChunkY,
            int plane = WorldConstants.SurfacePlane,
            int storey = 0)
        {
            if (presentationSpace == null)
            {
                Debug.LogError("LogicalTerrainChunkView requires a GridPresentationSpace.", this);
                return;
            }

            RenderChunkX = renderChunkX;
            RenderChunkY = renderChunkY;
            Plane = plane;
            Storey = storey;

            var startTile = new GridCoord(
                renderChunkX * WorldConstants.DefaultRenderChunkSize,
                renderChunkY * WorldConstants.DefaultRenderChunkSize);
            var originLocation = new GridLocation(startTile, plane, storey);
            transform.position = presentationSpace.ToWorldPosition(originLocation, 0);

            ReleaseRuntimeMesh();
            _runtimeMesh = LogicalTerrainChunkMeshBuilder.Build(
                store,
                renderChunkX,
                renderChunkY,
                plane,
                storey,
                presentationSpace.TileSize,
                presentationSpace.ElevationStepHeight,
                WorldConstants.DefaultRenderChunkSize);
            meshFilter.sharedMesh = _runtimeMesh;
            if (updateCollider && meshCollider != null) meshCollider.sharedMesh = _runtimeMesh;
        }

        public void RefreshAfterOriginShift()
        {
            if (presentationSpace == null) return;
            var startTile = new GridCoord(
                RenderChunkX * WorldConstants.DefaultRenderChunkSize,
                RenderChunkY * WorldConstants.DefaultRenderChunkSize);
            transform.position = presentationSpace.ToWorldPosition(new GridLocation(startTile, Plane, Storey), 0);
        }

        private void OnDestroy()
        {
            ReleaseRuntimeMesh();
        }

        private void ReleaseRuntimeMesh()
        {
            if (_runtimeMesh == null) return;
            if (meshFilter != null && meshFilter.sharedMesh == _runtimeMesh) meshFilter.sharedMesh = null;
            if (meshCollider != null && meshCollider.sharedMesh == _runtimeMesh) meshCollider.sharedMesh = null;
            if (Application.isPlaying) Destroy(_runtimeMesh);
            else DestroyImmediate(_runtimeMesh);
            _runtimeMesh = null;
        }
    }
}
