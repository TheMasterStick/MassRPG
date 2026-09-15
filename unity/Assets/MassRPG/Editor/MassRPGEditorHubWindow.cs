using UnityEditor;
using UnityEngine;
using MassRPG.Editor.World;

namespace MassRPG.Editor
{
    /// <summary>
    /// Front door for the production authoring suite. Individual tools remain separate windows so
    /// a designer can keep overview/detail/semantic palettes open together on multiple monitors.
    /// </summary>
    public sealed class MassRPGEditorHubWindow : EditorWindow
    {
        [MenuItem("MassRPG/Editor Hub", priority = 0)]
        public static void Open()
        {
            var window = GetWindow<MassRPGEditorHubWindow>();
            window.titleContent = new GUIContent("MassRPG Editor");
            window.minSize = new Vector2(470, 570);
            window.Show();
        }

        private void OnGUI()
        {
            GUILayout.Space(8);
            GUILayout.Label("MassRPG World Authoring", EditorStyles.largeLabel);
            EditorGUILayout.HelpBox(
                "Canonical authoring data lives outside Unity scene objects. Use the whole-world overview for the rough 180k pass, then exact tile/semantic tools for production detail.",
                MessageType.Info);

            Section("Terrain & geography");
            Button("World Overview", "Block the entire 180,000 x 180,000 world at 512x512 storage-page scale.", MassRPGWorldOverviewWindow.Open);
            Button("1x1 World Editor", "Hand-paint exact terrain, elevation, water, pathing, ramps and wall/fence edges.", MassRPGWorldEditorWindow.Open);

            Section("World semantics");
            Button("Road Editor", "Draw semantic roads with width, surface and routing/spawn guidance.", MassRPGRoadEditorWindow.Open);
            Button("Area Editor", "Draw overlapping regions, biomes, level bands, faction/resource/no-build/PvP areas.", MassRPGAreaEditorWindow.Open);
            Button("POI Editor", "Place public/hidden POIs with independent visible and protection footprints.", MassRPGPointOfInterestEditorWindow.Open);

            Section("Actors, objects & resources");
            Button("Creature Spawns", "Author fixed-cap creature populations, roam areas and optional patrol routes.", MassRPGCreatureSpawnEditorWindow.Open);
            Button("Placement Editor", "Place anchored objects, deliberate resources, NPC anchors, transport nodes and manual doodads.", MassRPGPlacementEditorWindow.Open);

            GUILayout.FlexibleSpace();
            EditorGUILayout.HelpBox(
                "Still in progress: searchable content palettes, deterministic biome-dressing controls, selection/stamps in the main 1x1 UI, recovery restore UI and Play From Here.",
                MessageType.None);
            GUILayout.Label("Unity 6.3 LTS · MassRPG authored-world tools", EditorStyles.centeredGreyMiniLabel);
        }

        private static void Section(string title)
        {
            GUILayout.Space(8);
            GUILayout.Label(title, EditorStyles.boldLabel);
        }

        private static void Button(string label, string description, System.Action action)
        {
            using (new EditorGUILayout.HorizontalScope(EditorStyles.helpBox))
            {
                if (GUILayout.Button(label, GUILayout.Width(145), GUILayout.Height(34))) action();
                GUILayout.Label(description, EditorStyles.wordWrappedMiniLabel, GUILayout.ExpandHeight(true));
            }
        }
    }
}
