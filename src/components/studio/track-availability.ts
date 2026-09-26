import { isCapturePhase, type LoopSnapshot } from "@/audio/loop/loop-controller";

export function workspaceBlocksTrack(snapshot: LoopSnapshot): boolean {
  return snapshot.save.editLocked || snapshot.blockedByTrack !== null || snapshot.workspaceIssue !== null;
}
export function trackIsEditing(snapshot: LoopSnapshot): boolean {
  return isCapturePhase(snapshot.phase) || snapshot.historyPending !== null || snapshot.playbackSending || snapshot.pendingPlayback !== null || workspaceBlocksTrack(snapshot);
}
