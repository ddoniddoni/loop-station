"use client";

import { Badge, Button, Flex, Heading, Select, Text } from "@radix-ui/themes";
import type { MicrophoneController, MicrophoneSnapshot } from "@/audio/input/microphone-controller";
import { INPUT_PROCESSING_KEYS, processingMatches, processingValue, type InputProcessingKey } from "@/audio/input/input-processing";
import { ko } from "@/lib/i18n/ko";

const labels: Record<InputProcessingKey, string> = {
  echoCancellation: ko.microphoneEchoCancellation,
  noiseSuppression: ko.microphoneNoiseSuppression,
  autoGainControl: ko.microphoneAutoGainControl,
};

function actualLabel(value: unknown): string {
  const actual = processingValue(value);
  if (actual === null) return ko.microphoneSettingUnknown;
  if (typeof actual === "boolean") return actual ? ko.microphoneSettingOn : ko.microphoneSettingOff;
  return actual === "all" ? ko.inputProcessingAll : ko.inputProcessingRemote;
}

export function InputProcessingControls({ controller, snapshot }: { controller: MicrophoneController; snapshot: MicrophoneSnapshot }) {
  const ready = snapshot.audioReady && snapshot.routed && snapshot.phase === "active" && !snapshot.captureLocked;
  const pending = snapshot.phase === "applying";
  const error = snapshot.processingError;

  return (
    <section aria-labelledby="input-processing-title" className="mt-4">
      <Heading as="h4" id="input-processing-title" size="2">{ko.inputProcessingTitle}</Heading>
      <Text as="p" id="input-processing-hint" size="1" color="gray" mt="2">{ko.inputProcessingHint}</Text>
      <Text as="p" id="input-processing-lock" role="status" size="1" color="gray" mt="2">{
        pending ? ko.inputProcessingApplying : snapshot.captureLocked ? ko.inputProcessingLocked : !ready ? ko.inputProcessingNeedsInput : ko.inputProcessingReset
      }</Text>
      <Flex direction="column" gap="3" mt="3">
        {INPUT_PROCESSING_KEYS.map((key) => {
          const support = snapshot.info?.processing[key] ?? "unknown";
          const requested = snapshot.processingRequested[key];
          const selected = snapshot.processingPending?.key === key ? snapshot.processingPending.requested : requested;
          const actual = snapshot.info?.settings[key];
          const matches = processingMatches(actual, requested);
          const hintId = `processing-${key}-hint`;
          return (
            <div key={key}>
              <Flex justify="between" align="center" gap="2" wrap="wrap">
                <label htmlFor={`processing-${key}`}><Text size="2">{labels[key]}</Text></label>
                <Select.Root value={String(selected)} disabled={!ready || support !== "available"}
                  onValueChange={(value) => { if (value === "true" || value === "false") void controller.setProcessing(key, value === "true"); }}>
                  <Select.Trigger id={`processing-${key}`} aria-describedby={`${hintId} input-processing-hint input-processing-lock`} />
                  <Select.Content position="popper">
                    <Select.Item value="false">{ko.microphoneSettingOff}</Select.Item>
                    <Select.Item value="true">{ko.microphoneSettingOn}</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Flex>
              <Text as="p" size="1" color="gray" mt="1" id={hintId}>{ko.inputProcessingSupport[support]}</Text>
              <Flex gap="2" align="center" wrap="wrap" mt="1" role="status" aria-label={`${labels[key]} ${ko.inputProcessingResult}`}>
                <Text size="1">{ko.inputProcessingRequested}: {requested ? ko.microphoneSettingOn : ko.microphoneSettingOff}</Text>
                <Badge color={pending || matches === null ? "gray" : matches ? "jade" : "amber"} variant="soft">
                  {pending ? ko.inputProcessingPrevious : ko.inputProcessingReported}: {actualLabel(actual)}
                </Badge>
                {!pending && matches === false && <Text size="1" color="amber">{ko.inputProcessingMismatch}</Text>}
              </Flex>
              {matches === false && support === "available" && <Button type="button" size="1" variant="ghost" mt="2" disabled={!ready}
                aria-label={`${labels[key]} ${ko.inputProcessingReapply}`} onClick={() => void controller.setProcessing(key, requested)}>{ko.inputProcessingReapply}</Button>}
            </div>
          );
        })}
      </Flex>
      {error && <Text as="p" role="alert" size="2" color="red" mt="3">
        {labels[error.key]} · {error.requested ? ko.microphoneSettingOn : ko.microphoneSettingOff}: {ko.inputProcessingFailed}{" "}
        {error.code === "constraints-unmet" ? ko.inputProcessingRejected : error.code === "unsupported" ? ko.inputProcessingSupport.unsupported : ko.inputProcessingRetry}
      </Text>}
      <Button type="button" size="1" variant="outline" color="gray" mt="3" disabled={!ready} onClick={() => controller.refreshProcessing()}>{ko.inputProcessingRefresh}</Button>
    </section>
  );
}
