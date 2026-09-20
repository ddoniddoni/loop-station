import { Badge, Button, Card, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import { AudioSetup } from "@/components/audio/audio-setup";
import { EnvironmentDiagnostics } from "@/components/audio/environment-diagnostics";
import { MicrophoneSetup } from "@/components/audio/microphone-setup";
import { ko } from "@/lib/i18n/ko";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col px-6 sm:px-12">
      <a className="skip-link" href="#main">{ko.skipToContent}</a>
      <Flex asChild align="center" justify="between" gap="4" wrap="wrap">
        <header className="py-8">
          <Text as="span" size="5" weight="bold" className="brand">{ko.appName}</Text>
          <Badge color="amber" variant="soft" radius="full" size="2">{ko.status}</Badge>
        </header>
      </Flex>

      <main id="main" className="flex flex-1 flex-col justify-center py-10 sm:py-20">
        <Card size={{ initial: "3", sm: "5" }} asChild>
          <section aria-labelledby="welcome-title">
            <div className="loop-mark mb-10" aria-hidden="true"><span /><span /></div>
            <Text as="p" size="2" color="amber" mb="4">{ko.introduction}</Text>
            <Heading as="h1" id="welcome-title" size={{ initial: "7", sm: "9" }} className="break-keep text-balance">{ko.title}</Heading>
            <Text as="p" id="availability" size="3" color="gray" mt="5" className="max-w-lg leading-7">{ko.availability}</Text>
            <Flex gap="3" wrap="wrap" mt="9">
              <Button type="button" size="3" variant="soft" disabled aria-describedby="availability" className="min-h-12">{ko.newProject}</Button>
              <Button type="button" size="3" variant="outline" color="gray" disabled aria-describedby="availability" className="min-h-12">{ko.demo}</Button>
            </Flex>
          </section>
        </Card>

        <section aria-labelledby="next-step-title" className="mt-8 grid gap-3 px-2 sm:grid-cols-[1fr_2fr] sm:gap-10">
          <Heading as="h2" id="next-step-title" size="2" color="gray" weight="medium">{ko.nextStepTitle}</Heading>
          <div>
            <Heading as="h3" size="3" weight="medium">{ko.nextStep}</Heading>
            <Text as="p" size="2" color="gray" mt="2" className="leading-6">{ko.nextStepDescription}</Text>
            <AudioSetup />
            <MicrophoneSetup />
            <EnvironmentDiagnostics />
          </div>
        </section>
      </main>

      <Separator size="4" />
      <Flex asChild justify="between" gap="3" wrap="wrap">
        <footer className="py-6">
          <Text as="span" size="1" color="gray">{ko.localFirst}</Text>
          <Text as="span" size="1" color="gray">{ko.privacy}</Text>
        </footer>
      </Flex>
    </div>
  );
}
