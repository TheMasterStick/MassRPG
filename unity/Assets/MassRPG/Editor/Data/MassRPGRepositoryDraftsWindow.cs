using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace MassRPG.Editor.Data
{
    /// <summary>
    /// Unity-side view of repository drafts written by the browser/Codespaces editor. This proves
    /// both authoring surfaces share one source of truth before editable Unity forms are layered on.
    /// </summary>
    public sealed class MassRPGRepositoryDraftsWindow : EditorWindow
    {
        private IReadOnlyList<RepositoryItemDraftRecord> _items = Array.Empty<RepositoryItemDraftRecord>();
        private RepositoryItemDraftRecord _selected;
        private string _search = string.Empty;
        private Vector2 _listScroll;
        private Vector2 _detailScroll;

        [MenuItem("MassRPG/Repository Drafts", priority = 21)]
        public static void Open()
        {
            var window = GetWindow<MassRPGRepositoryDraftsWindow>();
            window.titleContent = new GUIContent("MassRPG Drafts");
            window.minSize = new Vector2(760f, 500f);
            window.Show();
        }

        private void OnEnable() => Reload();

        private void OnGUI()
        {
            DrawHeader();
            var body = GUILayoutUtility.GetRect(GUIContent.none, GUIStyle.none, GUILayout.ExpandWidth(true), GUILayout.ExpandHeight(true));
            var leftWidth = Mathf.Clamp(body.width * 0.40f, 300f, 430f);
            DrawList(new Rect(body.x, body.y, leftWidth, body.height));
            EditorGUI.DrawRect(new Rect(body.x + leftWidth, body.y, 1f, body.height), new Color(0f, 0f, 0f, 0.35f));
            DrawDetails(new Rect(body.x + leftWidth + 1f, body.y, body.width - leftWidth - 1f, body.height));
        }

        private void DrawHeader()
        {
            GUILayout.Space(6f);
            using (new EditorGUILayout.HorizontalScope())
            {
                using (new EditorGUILayout.VerticalScope())
                {
                    GUILayout.Label("Repository Content Drafts", EditorStyles.largeLabel);
                    GUILayout.Label(
                        "These are the same JSON drafts authored by the browser/Codespaces editor. Valid item drafts override migration-seed items only in the resolved draft catalog; they are not live-published data.",
                        EditorStyles.wordWrappedMiniLabel);
                }
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("Reload", GUILayout.Width(75f), GUILayout.Height(26f))) Reload();
                if (GUILayout.Button("Reveal folder", GUILayout.Width(95f), GUILayout.Height(26f)))
                {
                    Directory.CreateDirectory(RepositoryDraftItemStore.ItemDraftRoot);
                    EditorUtility.RevealInFinder(RepositoryDraftItemStore.ItemDraftRoot);
                }
            }

            using (new EditorGUILayout.HorizontalScope(EditorStyles.helpBox))
            {
                GUILayout.Label("Items", EditorStyles.boldLabel, GUILayout.Width(45f));
                var valid = _items.Count(item => item.IsValid);
                var ready = _items.Count(item => item.IsValid && item.ReadyForReview);
                var invalid = _items.Count - valid;
                GUILayout.Label($"{_items.Count} draft(s) · {valid} valid · {ready} ready for review · {invalid} invalid", EditorStyles.miniLabel);
                GUILayout.FlexibleSpace();
                GUILayout.Label("Search", GUILayout.Width(42f));
                _search = EditorGUILayout.TextField(_search, GUILayout.Width(230f));
            }
        }

        private void DrawList(Rect rect)
        {
            GUILayout.BeginArea(rect);
            _listScroll = EditorGUILayout.BeginScrollView(_listScroll);
            var query = (_search ?? string.Empty).Trim();
            var any = false;
            for (var i = 0; i < _items.Count; i++)
            {
                var item = _items[i];
                if (!Matches(item, query)) continue;
                any = true;
                var selected = ReferenceEquals(item, _selected);
                var label = item.DisplayName + "\n" + item.Id;
                if (!item.IsValid) label += "  · INVALID";
                else if (item.ReadyForReview) label += "  · ready";
                if (GUILayout.Toggle(selected, label, "Button", GUILayout.Height(42f)))
                    _selected = item;
            }

            if (!any)
            {
                EditorGUILayout.HelpBox(
                    _items.Count == 0
                        ? "No repository item drafts yet. Draft an item in the Online Data Editor and it will appear here after Reload."
                        : "No drafts match this search.",
                    MessageType.Info);
            }
            EditorGUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        private void DrawDetails(Rect rect)
        {
            GUILayout.BeginArea(rect);
            _detailScroll = EditorGUILayout.BeginScrollView(_detailScroll);
            if (_selected == null)
            {
                GUILayout.Space(18f);
                GUILayout.Label("Select a repository draft to inspect it.", EditorStyles.centeredGreyMiniLabel);
                EditorGUILayout.EndScrollView();
                GUILayout.EndArea();
                return;
            }

            GUILayout.Space(6f);
            GUILayout.Label(_selected.DisplayName, EditorStyles.largeLabel);
            ReadOnly("Permanent ID", _selected.Id);
            ReadOnly("File", MakeRelative(_selected.FilePath));
            ReadOnly("State", _selected.ReadyForReview ? "Ready for review" : "Draft");

            if (!_selected.IsValid)
            {
                EditorGUILayout.HelpBox(_selected.Error, MessageType.Error);
                if (GUILayout.Button("Reveal invalid JSON file")) EditorUtility.RevealInFinder(_selected.FilePath);
                EditorGUILayout.EndScrollView();
                GUILayout.EndArea();
                return;
            }

            var item = _selected.Definition;
            Section("Core item data");
            ReadOnly("Type", item.Type.ToString());
            ReadOnly("Stackable", item.Stackable ? "Yes" : "No");
            ReadOnly("Value", item.Value.ToString());
            if (!string.IsNullOrWhiteSpace(item.Description)) ReadOnlyMultiline("Description", item.Description);

            Section("Equipment / use");
            ReadOnly("Slots", item.AllowedEquipmentSlots.Length == 0 ? "—" : string.Join(", ", item.AllowedEquipmentSlots.Select(slot => slot.ToString())));
            ReadOnly("Two-handed", item.TwoHanded ? "Yes" : "No");
            ReadOnly("Dual wield", item.CanDualWield ? "Yes" : "No");
            ReadOnly("Equip requirement", item.EquipRequirementSkill.HasValue ? $"{item.EquipRequirementSkill.Value} {item.EquipRequirementLevel}" : "—");
            ReadOnly("Gathering tool", item.GatheringToolKind == Core.Resources.GatheringToolKind.None ? "—" : $"{item.GatheringToolKind}, tier {item.ToolTier}");
            ReadOnly("Heal amount", item.HealAmount > 0 ? item.HealAmount.ToString() : "—");
            ReadOnly("Attack interval", item.AttackIntervalMilliseconds > 0 ? item.AttackIntervalMilliseconds + " ms" : "style default");
            ReadOnly("Attack range", item.AttackRangeTiles > 0 ? item.AttackRangeTiles + " tile(s)" : "style default");

            Section("Combat bonuses");
            ReadOnly("Attack / Strength / Defence", $"{item.Bonuses.Attack} / {item.Bonuses.Strength} / {item.Bonuses.Defence}");
            ReadOnly("Ranged attack / strength", $"{item.Bonuses.RangedAttack} / {item.Bonuses.RangedStrength}");
            ReadOnly("Magic", item.Bonuses.Magic.ToString());

            GUILayout.Space(12f);
            EditorGUILayout.HelpBox(
                "This definition was reconstructed from repository JSON, not from the hard-coded migration catalog. It is therefore already exercising the shared Online Editor ↔ Unity data bridge.",
                MessageType.Info);
            if (GUILayout.Button("Reveal JSON file")) EditorUtility.RevealInFinder(_selected.FilePath);

            EditorGUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        private void Reload()
        {
            var prior = _selected?.Id;
            _items = RepositoryDraftItemStore.LoadAll();
            _selected = string.IsNullOrEmpty(prior) ? null : _items.FirstOrDefault(item => item.Id == prior);
            Repaint();
        }

        private static bool Matches(RepositoryItemDraftRecord item, string query)
        {
            if (string.IsNullOrEmpty(query)) return true;
            return item.Id.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0
                || item.DisplayName.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0
                || (item.Definition != null && item.Definition.Type.ToString().IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0);
        }

        private static string MakeRelative(string path)
        {
            var root = RepositoryDraftItemStore.RepositoryRoot.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            return path.StartsWith(root, StringComparison.OrdinalIgnoreCase) ? path.Substring(root.Length) : path;
        }

        private static void Section(string title)
        {
            GUILayout.Space(10f);
            GUILayout.Label(title, EditorStyles.boldLabel);
        }

        private static void ReadOnly(string label, string value)
        {
            using (new EditorGUILayout.HorizontalScope())
            {
                GUILayout.Label(label, GUILayout.Width(145f));
                EditorGUILayout.SelectableLabel(value ?? string.Empty, EditorStyles.textField, GUILayout.Height(EditorGUIUtility.singleLineHeight));
            }
        }

        private static void ReadOnlyMultiline(string label, string value)
        {
            GUILayout.Label(label);
            EditorGUILayout.SelectableLabel(value ?? string.Empty, EditorStyles.textArea, GUILayout.MinHeight(55f));
        }
    }
}
