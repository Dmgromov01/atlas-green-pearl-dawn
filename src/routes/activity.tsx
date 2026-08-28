import { createFileRoute } from "@tanstack/react-router";
import { ActivityView } from "@/components/activity/activity-view";

export const Route = createFileRoute("/activity")({ component: ActivityView });
