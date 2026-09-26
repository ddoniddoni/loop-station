import { Flex, Select, Text } from "@radix-ui/themes";
import { isInputChannelAvailable } from "@/audio/input/input-channel";
import type { MicrophoneController, MicrophoneSnapshot } from "@/audio/input/microphone-controller";
import { ko } from "@/lib/i18n/ko";

export function MicrophoneChannelSelect({ controller, snapshot, ready }: {
  controller: MicrophoneController;
  snapshot: MicrophoneSnapshot;
  ready: boolean;
}) {
  const count = snapshot.info?.settings.channelCount;
  const leftAvailable = isInputChannelAvailable("left", count);
  const rightAvailable = isInputChannelAvailable("right", count);
  return (
    <Flex direction="column" gap="2">
      <Text as="label" htmlFor="input-channel" size="2">{ko.inputChannel}</Text>
      <Select.Root value={snapshot.channel} disabled={!ready || snapshot.captureLocked} onValueChange={(value) => {
        if (isInputChannelAvailable(value, count)) controller.setChannel(value);
      }}>
        <Select.Trigger id="input-channel" aria-describedby={`input-channel-hint${ready ? "" : " input-controls-reason"}`} />
        <Select.Content>
          <Select.Item value="mono">{ko.inputChannelMono}</Select.Item>
          <Select.Item value="left" disabled={!leftAvailable}>{ko.inputChannelLeft}</Select.Item>
          <Select.Item value="right" disabled={!rightAvailable}>{ko.inputChannelRight}</Select.Item>
          <Select.Item value="stereo" disabled>{ko.inputChannelStereo}</Select.Item>
        </Select.Content>
      </Select.Root>
      <div id="input-channel-hint">
        <Text as="p" size="1" color="gray">{ko.inputChannelHint}</Text>
        <Text as="p" size="1" color="gray">{
          !leftAvailable ? ko.inputChannelUnknown : !rightAvailable ? ko.inputChannelSingle : ko.inputChannelMultiple
        }</Text>
        {snapshot.captureLocked && <Text as="p" size="1" color="gray">{ko.inputChannelLocked}</Text>}
      </div>
    </Flex>
  );
}
