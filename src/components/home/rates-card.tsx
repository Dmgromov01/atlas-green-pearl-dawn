import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { getRates } from "@/lib/server/rates";
import { Card } from "@/components/ui/card";
import { ServiceRow } from "@/components/shell/service-row";
import { haptic } from "@/lib/haptic";

export function RatesCard() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["rates"], queryFn: () => getRates() });
  const usd = q.data?.rates.USD;
  const eur = q.data?.rates.EUR;
  const status =
    usd && eur
      ? `USD ${Math.round(usd)} ₽ · EUR ${Math.round(eur)} ₽`
      : "Курсы ЦБ РФ";

  return (
    <Card>
      <ServiceRow
        icon={<Coins className="size-5" />}
        title="Валюты и конвертер"
        status={status}
        onClick={() => {
          haptic("medium");
          navigate({ to: "/rates" });
        }}
      />
    </Card>
  );
}
