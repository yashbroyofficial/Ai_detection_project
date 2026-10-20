export type PresenceTransition = { humanPresent: boolean; alert: boolean };

export class TemporalPresenceTracker {
  private positiveStreak = 0;
  private negativeStreak = 0;
  private present = false;
  private armed = true;
  private lastAlertAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly confirmationFrames: number,
    private readonly absenceFrames: number,
    private readonly cooldownMs: number,
  ) {}

  observe(hasConfirmedDetection: boolean, timestamp: number): PresenceTransition {
    if (hasConfirmedDetection) {
      this.positiveStreak += 1;
      this.negativeStreak = 0;
      if (!this.present && this.positiveStreak >= this.confirmationFrames) {
        this.present = true;
        const alert = this.armed && timestamp - this.lastAlertAt >= this.cooldownMs;
        if (alert) this.lastAlertAt = timestamp;
        this.armed = false;
        return { humanPresent: true, alert };
      }
    } else {
      this.positiveStreak = 0;
      this.negativeStreak += 1;
      if (this.present && this.negativeStreak >= this.absenceFrames) {
        this.present = false;
        this.armed = true;
      }
    }
    return { humanPresent: this.present, alert: false };
  }

  reset() {
    this.positiveStreak = 0;
    this.negativeStreak = 0;
    this.present = false;
    this.armed = true;
    this.lastAlertAt = Number.NEGATIVE_INFINITY;
  }
}
