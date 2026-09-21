"use client";

import { Badge, Button, Card, Heading, Text } from "@radix-ui/themes";
import { useEffect, useRef, useState } from "react";
import { collectEnvironmentReport, type EnvironmentReport, type StorageEstimate } from "@/lib/environment/diagnostics";
import { ko } from "@/lib/i18n/ko";

type DiagnosticRow = {
  label: string;
  value: string;
  color: "green" | "gray" | "amber";
};

const storageNumberFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

function availability(value: boolean): string {
  return value ? ko.diagnosticsApiAvailable : ko.diagnosticsApiUnavailable;
}

function bytes(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return ko.diagnosticsUnknown;
  return `${storageNumberFormatter.format(value / 1_048_576)} MiB`;
}

function storageEstimateValue(estimate: StorageEstimate): string {
  if (estimate.status === "unavailable") return ko.diagnosticsApiUnavailable;
  if (estimate.status === "error") return ko.diagnosticsReadFailed;
  return `${bytes(estimate.usage)} / ${bytes(estimate.quota)}`;
}

function diagnosticRows(report: EnvironmentReport): DiagnosticRow[] {
  return [
    { label: ko.diagnosticsSecure, value: report.secureContext ? ko.diagnosticsActive : ko.diagnosticsInactive, color: report.secureContext ? "green" : "amber" },
    { label: ko.diagnosticsWorklet, value: availability(report.audioWorkletApi), color: report.audioWorkletApi ? "green" : "gray" },
    { label: ko.diagnosticsMicrophone, value: availability(report.microphoneApi), color: report.microphoneApi ? "green" : "gray" },
    { label: ko.diagnosticsMidi, value: availability(report.midiApi), color: report.midiApi ? "green" : "gray" },
    { label: ko.diagnosticsIndexedDb, value: availability(report.indexedDbApi), color: report.indexedDbApi ? "green" : "gray" },
    { label: ko.diagnosticsIsolation, value: report.crossOriginIsolated ? ko.diagnosticsActive : ko.diagnosticsInactive, color: report.crossOriginIsolated ? "green" : "gray" },
    { label: ko.diagnosticsStorageEstimate, value: storageEstimateValue(report.storageEstimate), color: report.storageEstimate.status === "available" ? "green" : "gray" },
    { label: ko.diagnosticsPersistence, value: report.persistentStorage === null ? ko.diagnosticsUnknown : report.persistentStorage ? ko.diagnosticsGranted : ko.diagnosticsNotGranted, color: report.persistentStorage ? "green" : "gray" },
  ];
}

export function EnvironmentDiagnostics() {
  const [report, setReport] = useState<EnvironmentReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const generationRef = useRef(0);

  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  async function checkEnvironment(): Promise<void> {
    const generation = ++generationRef.current;
    setChecking(true);
    setIssue(null);

    try {
      const nextReport = await collectEnvironmentReport();
      if (generation === generationRef.current) setReport(nextReport);
    } catch {
      if (generation === generationRef.current) setIssue(ko.diagnosticsFailed);
    } finally {
      if (generation === generationRef.current) setChecking(false);
    }
  }

  return (
    <section aria-labelledby="diagnostics-title" className="studio-side-content">
      <Heading as="h2" id="diagnostics-title" size="3" weight="medium">{ko.diagnosticsTitle}</Heading>
      <Text as="p" size="2" color="gray" mt="2" className="leading-6">{ko.diagnosticsDescription}</Text>
      <Button type="button" variant="outline" mt="4" disabled={checking} onClick={() => void checkEnvironment()}>
        {checking ? ko.diagnosticsChecking : ko.diagnosticsRun}
      </Button>
      {issue && <Text as="p" role="alert" size="2" color="red" mt="3">{issue}</Text>}
      {report && (
        <Card size="2" mt="4">
          <dl className="grid gap-3">
            {diagnosticRows(report).map((row) => (
              <div key={row.label} className="flex flex-wrap items-center justify-between gap-2">
                <dt><Text as="span" size="2">{row.label}</Text></dt>
                <dd><Badge color={row.color} variant="soft">{row.value}</Badge></dd>
              </div>
            ))}
          </dl>
          <Text as="p" size="1" color="gray" mt="4">{ko.diagnosticsCaveat}</Text>
        </Card>
      )}
    </section>
  );
}
