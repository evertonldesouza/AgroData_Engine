using AgroData.API.Http;
using AgroData.Application.DTOs;
using AgroData.Domain.Enums;

namespace AgroData.Tests.Api;

public sealed class EntityTagsTests
{
    [Fact]
    public void Snapshot_tags_are_stable_for_the_same_payload()
    {
        var snapshots = new[] { Snapshot("SOJA", 136.42, 1), Snapshot("MILHO", 58.19, 2) };

        Assert.Equal(
            EntityTags.ForSnapshots(snapshots),
            EntityTags.ForSnapshots([.. snapshots.Reverse()]));
    }

    [Fact]
    public void Snapshot_tags_change_when_a_price_changes()
    {
        var before = EntityTags.ForSnapshots([Snapshot("SOJA", 136.42, 1)]);
        var after = EntityTags.ForSnapshots([Snapshot("SOJA", 136.43, 1)]);

        Assert.NotEqual(before, after);
    }

    [Fact]
    public void Snapshot_tags_change_when_a_new_quote_arrives()
    {
        var before = EntityTags.ForSnapshots([Snapshot("SOJA", 136.42, 1)]);
        var after = EntityTags.ForSnapshots([Snapshot("SOJA", 136.42, 2)]);

        Assert.NotEqual(before, after);
    }

    [Fact]
    public void Empty_collections_have_a_constant_tag()
    {
        Assert.Equal("\"empty\"", EntityTags.ForSnapshots([]));
        Assert.Null(EntityTags.LastModified([]));
    }

    [Fact]
    public void History_tags_include_the_moving_average()
    {
        var withAverage = History(136.42);
        var withoutAverage = History(null);

        Assert.NotEqual(EntityTags.ForHistory(withAverage), EntityTags.ForHistory(withoutAverage));
    }

    [Fact]
    public void Last_modified_is_the_most_recent_timestamp_in_utc()
    {
        var older = Snapshot("SOJA", 1, 1, new DateTime(2026, 10, 22, 10, 0, 0, DateTimeKind.Utc));
        var newer = Snapshot("MILHO", 2, 2, new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc));

        var lastModified = EntityTags.LastModified([older, newer]);

        Assert.Equal(new DateTimeOffset(2026, 10, 22, 12, 0, 0, TimeSpan.Zero), lastModified);
    }

    [Fact]
    public void Unspecified_timestamps_are_treated_as_utc()
    {
        var unspecified = new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Unspecified);

        Assert.Equal(TimeSpan.Zero, EntityTags.ToUtcOffset(unspecified).Offset);
    }

    private static CommoditySnapshotResponse Snapshot(
        string symbol,
        double price,
        int id,
        DateTime? timestamp = null) =>
        new(
            Id: id,
            Symbol: symbol,
            Price: price,
            PreviousPrice: null,
            Delta: null,
            DeltaPercent: null,
            Trend: TrendDirection.Flat,
            Timestamp: timestamp ?? new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc),
            Source: "Test",
            History: [price]);

    private static CommodityHistoryResponse History(double? movingAverage) =>
        new(
            Symbol: "SOJA",
            Points: [new PricePointResponse(new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc), 136.42)],
            MovingAverage: movingAverage,
            Window: 7);
}
