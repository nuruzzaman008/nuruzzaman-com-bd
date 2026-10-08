namespace NBOnlineWallet {
    // Driven by the UI timer; independent of wall-clock adjustments.
    public sealed class SyncSchedule {
        private readonly IClock clock;
        private long next;
        public SyncSchedule(IClock clock) { this.clock = clock; }
        public bool Due { get { return clock.MonotonicMilliseconds >= next; } }
        public void AttemptCompleted() { next = checked(clock.MonotonicMilliseconds + 30000); }
    }
}
