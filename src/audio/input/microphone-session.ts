export type MicrophoneErrorCode =
  | "insecure-context"
  | "unsupported"
  | "permission-denied"
  | "device-not-found"
  | "device-unreadable"
  | "constraints-unmet"
  | "request-aborted"
  | "cancelled"
  | "disposed"
  | "unknown";

export class MicrophoneError extends Error {
  constructor(readonly code: MicrophoneErrorCode) {
    super(code);
    this.name = "MicrophoneError";
  }
}

export type MicrophoneDevice = {
  id: string;
  label: string;
};

export type MicrophoneInfo = {
  deviceId: string | null;
  label: string;
  settings: MediaTrackSettings;
};

type MicrophoneCallbacks = {
  onDisconnected: () => void;
  onDevicesChanged: (devices: MicrophoneDevice[]) => void;
  onDeviceListError: () => void;
};

function requestError(error: unknown): MicrophoneError {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return new MicrophoneError("permission-denied");
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new MicrophoneError("device-not-found");
    case "NotReadableError":
    case "TrackStartError":
      return new MicrophoneError("device-unreadable");
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return new MicrophoneError("constraints-unmet");
    case "AbortError":
      return new MicrophoneError("request-aborted");
    default:
      return new MicrophoneError("unknown");
  }
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export class MicrophoneSession {
  private readonly mediaDevices: MediaDevices;
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private requestVersion = 0;
  private disposed = false;

  private readonly handleTrackEnded = () => {
    if (this.disposed || !this.track || this.track.readyState !== "ended") return;
    this.stopActiveStream();
    this.callbacks.onDisconnected();
  };

  private readonly handleDeviceChange = () => {
    if (this.track) void this.refreshDevices();
  };

  constructor(private readonly callbacks: MicrophoneCallbacks) {
    if (!window.isSecureContext) throw new MicrophoneError("insecure-context");
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicrophoneError("unsupported");
    }
    this.mediaDevices = navigator.mediaDevices;
    this.mediaDevices.addEventListener("devicechange", this.handleDeviceChange);
  }

  get active(): boolean {
    return this.track?.readyState === "live";
  }

  get activeStream(): MediaStream | null {
    return this.active ? this.stream : null;
  }

  async request(deviceId?: string): Promise<MicrophoneInfo> {
    this.assertActive();
    const version = ++this.requestVersion;
    const audio: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };

    let stream: MediaStream;
    try {
      stream = await this.mediaDevices.getUserMedia({ audio, video: false });
    } catch (error) {
      if (this.disposed || version !== this.requestVersion) throw new MicrophoneError("cancelled");
      throw requestError(error);
    }

    if (this.disposed || version !== this.requestVersion) {
      stopStream(stream);
      throw new MicrophoneError("cancelled");
    }

    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState === "ended") {
      stopStream(stream);
      throw new MicrophoneError("device-not-found");
    }

    this.stopActiveStream();
    this.stream = stream;
    this.track = track;
    track.addEventListener("ended", this.handleTrackEnded);
    void this.refreshDevices();

    const settings = track.getSettings();
    return {
      deviceId: settings.deviceId ?? deviceId ?? null,
      label: track.label,
      settings,
    };
  }

  cancelPending(): void {
    this.requestVersion += 1;
  }

  release(): void {
    this.cancelPending();
    this.stopActiveStream();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mediaDevices.removeEventListener("devicechange", this.handleDeviceChange);
    this.release();
  }

  private readonly refreshDevices = async (): Promise<void> => {
    try {
      if (!this.mediaDevices.enumerateDevices) {
        this.callbacks.onDeviceListError();
        return;
      }
      const devices = await this.mediaDevices.enumerateDevices();
      if (this.disposed || !this.active) return;
      this.callbacks.onDevicesChanged(
        devices
          .filter((device) => device.kind === "audioinput" && device.deviceId)
          .map((device) => ({ id: device.deviceId, label: device.label })),
      );
    } catch {
      if (!this.disposed && this.active) this.callbacks.onDeviceListError();
    }
  };

  private stopActiveStream(): void {
    this.track?.removeEventListener("ended", this.handleTrackEnded);
    if (this.stream) stopStream(this.stream);
    this.track = null;
    this.stream = null;
  }

  private assertActive(): void {
    if (this.disposed) throw new MicrophoneError("disposed");
  }
}
