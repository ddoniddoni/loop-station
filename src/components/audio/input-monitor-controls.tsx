import { Badge, Select, Slider, Text } from "@radix-ui/themes";
import { isInputMonitorMode } from "@/audio/input/input-monitor";
import type { MicrophoneController, MicrophoneSnapshot } from "@/audio/input/microphone-controller";
import { ko } from "@/lib/i18n/ko";

export function InputMonitorControls({ controller, snapshot, ready }: {
  controller: MicrophoneController; snapshot: MicrophoneSnapshot; ready: boolean;
}) {
  const mode = snapshot.monitorPending ?? snapshot.monitorMode;
  return (
    <div className="station-input-monitor">
      <div className="station-input-heading">
        <label htmlFor="input-monitor-mode"><Text as="span" size="2">{ko.inputMonitor}</Text></label>
        <Badge color={snapshot.monitorMode === "off" ? "gray" : "jade"} variant="soft" role="status">
          {snapshot.monitorPending ? ko.inputMonitorPending : ko.inputMonitorModes[snapshot.monitorMode]}
        </Badge>
        <Select.Root value={mode} disabled={!ready} onValueChange={(value) => {
          if (isInputMonitorMode(value)) controller.setMonitorMode(value);
        }}>
          <Select.Trigger id="input-monitor-mode" aria-describedby={ready ? "input-monitor-hint input-monitor-auto-hint" : "input-controls-reason"} />
          <Select.Content>
            <Select.Item value="off">{ko.inputMonitorModes.off}</Select.Item>
            <Select.Item value="on">{ko.inputMonitorModes.on}</Select.Item>
            <Select.Item value="auto">{ko.inputMonitorModes.auto}</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
      <Text as="p" id="input-monitor-hint" size="1" color="gray">{ko.inputMonitorHint}</Text>
      <Text as="p" id="input-monitor-auto-hint" size="1" color="gray">{ko.inputMonitorAutoHint}</Text>
      <div className="station-input-heading">
        <Text as="span" id="input-monitor-volume-label" size="2">{ko.inputMonitorVolume}</Text>
        <span className="station-input-number">{snapshot.monitorVolume}%</span>
      </div>
      <Slider aria-labelledby="input-monitor-volume-label" aria-valuetext={`${snapshot.monitorVolume}%`}
        min={0} max={100} step={1} value={[snapshot.monitorVolume]} disabled={!ready}
        onValueChange={(values) => controller.setMonitorVolume(values[0] ?? 20)} />
      <Text as="p" size="1" color="gray">{ko.inputMonitorResetHint}</Text>
    </div>
  );
}
