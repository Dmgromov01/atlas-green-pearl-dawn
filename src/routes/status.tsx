import { createFileRoute } from "@tanstack/react-router";
import { StatusView } from "@/components/status/status-view";

export const Route = createFileRoute("/status")({ component: StatusView });
