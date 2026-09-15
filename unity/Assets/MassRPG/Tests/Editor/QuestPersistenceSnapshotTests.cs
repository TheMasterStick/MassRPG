using System;
using MassRPG.Core.Content;
using MassRPG.Data.Quests;
using MassRPG.Server.Quests;
using NUnit.Framework;

namespace MassRPG.Tests
{
    public sealed class QuestPersistenceSnapshotTests
    {
        [Test]
        public void ActiveReadyAndCompletedQuestStateRoundTripsByStableIds()
        {
            var activeId = new ContentId("quest.active");
            var readyId = new ContentId("quest.ready");
            var completedId = new ContentId("quest.done");
            var catalog = CreateCatalog(activeId, readyId, completedId);
            var state = new CharacterQuestState();

            var active = new QuestProgressState(activeId);
            active.SetCount("step", 1);
            state.Add(active);

            var ready = new QuestProgressState(readyId);
            ready.SetCount("step", 2);
            ready.Status = QuestRunStatus.ReadyToClaim;
            state.Add(ready);
            state.Complete(completedId, true);

            var snapshot = QuestPersistenceSnapshotCodec.Capture(state);
            var restored = QuestPersistenceSnapshotCodec.Restore(snapshot, catalog);

            Assert.AreEqual(CharacterQuestSnapshot.CurrentVersion, snapshot.Version);
            Assert.IsTrue(restored.TryGetActive(activeId, out var restoredActive));
            Assert.AreEqual(1, restoredActive.GetCount("step"));
            Assert.AreEqual(QuestRunStatus.Active, restoredActive.Status);
            Assert.IsTrue(restored.TryGetActive(readyId, out var restoredReady));
            Assert.AreEqual(2, restoredReady.GetCount("step"));
            Assert.AreEqual(QuestRunStatus.ReadyToClaim, restoredReady.Status);
            Assert.IsTrue(restored.HasCompleted(completedId));
        }

        [Test]
        public void RestoreRejectsObjectiveProgressAfterDefinitionIdentityChanges()
        {
            var questId = new ContentId("quest.changed");
            var catalog = new QuestCatalog();
            catalog.Register(new QuestDefinition(
                questId,
                "Changed",
                new[] { new QuestObjectiveDefinition("new_step", QuestObjectiveKind.TalkToNpc, 1, new ContentId("npc.guide")) }));
            var snapshot = new CharacterQuestSnapshot(
                CharacterQuestSnapshot.CurrentVersion,
                new[]
                {
                    new ActiveQuestSnapshot(
                        questId,
                        QuestRunStatus.Active,
                        new[] { new QuestObjectiveProgressSnapshot("old_step", 1) })
                },
                Array.Empty<ContentId>());

            Assert.Throws<InvalidOperationException>(() => QuestPersistenceSnapshotCodec.Restore(snapshot, catalog));
        }

        [Test]
        public void RestoreRejectsReadyQuestWithIncompleteObjectives()
        {
            var questId = new ContentId("quest.incomplete_ready");
            var catalog = new QuestCatalog();
            catalog.Register(new QuestDefinition(
                questId,
                "Incomplete",
                new[] { new QuestObjectiveDefinition("step", QuestObjectiveKind.TalkToNpc, 2, new ContentId("npc.guide")) }));
            var snapshot = new CharacterQuestSnapshot(
                CharacterQuestSnapshot.CurrentVersion,
                new[]
                {
                    new ActiveQuestSnapshot(
                        questId,
                        QuestRunStatus.ReadyToClaim,
                        new[] { new QuestObjectiveProgressSnapshot("step", 1) })
                },
                Array.Empty<ContentId>());

            Assert.Throws<InvalidOperationException>(() => QuestPersistenceSnapshotCodec.Restore(snapshot, catalog));
        }

        private static QuestCatalog CreateCatalog(ContentId activeId, ContentId readyId, ContentId completedId)
        {
            var catalog = new QuestCatalog();
            catalog.Register(new QuestDefinition(
                activeId,
                "Active",
                new[] { new QuestObjectiveDefinition("step", QuestObjectiveKind.TalkToNpc, 2, new ContentId("npc.a")) }));
            catalog.Register(new QuestDefinition(
                readyId,
                "Ready",
                new[] { new QuestObjectiveDefinition("step", QuestObjectiveKind.TalkToNpc, 2, new ContentId("npc.b")) }));
            catalog.Register(new QuestDefinition(
                completedId,
                "Done",
                new[] { new QuestObjectiveDefinition("step", QuestObjectiveKind.TalkToNpc, 1, new ContentId("npc.c")) }));
            return catalog;
        }
    }
}
