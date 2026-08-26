import { createFileRoute } from "@tanstack/react-router";
import { RatesView } from "@/components/rates/rates-view";

export const Route = createFileRoute("/rates")({ component: RatesView });
