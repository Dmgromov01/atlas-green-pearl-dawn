import { createFileRoute } from "@tanstack/react-router";
import { AdminView } from "@/components/admin/admin-view";

export const Route = createFileRoute("/admin")({ component: AdminView });
