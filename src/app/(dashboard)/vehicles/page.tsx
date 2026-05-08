import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { daysUntilDate } from "@/lib/date-utils";
import { VehiclesManager } from "./vehicles-manager";

export default async function VehiclesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "staff" || session.role === "viewer") redirect("/calendar");

  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ isActive: "desc" }, { plateNumber: "asc" }],
  });

  const payload = vehicles.map((v) => ({
    id: v.id,
    plateNumber: v.plateNumber,
    name: v.name,
    vehicleType: v.vehicleType,
    inspectionDate: v.inspectionDate,
    notes: v.notes,
    isActive: v.isActive,
    daysUntilInspection: daysUntilDate(v.inspectionDate),
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "ホーム", href: "/calendar" },
          { label: "車両管理" },
        ]}
        title="車両管理"
        description={`登録車両 全 ${vehicles.length} 台`}
      />
      <div className="px-4 md:px-6 py-6">
        <VehiclesManager
          initialVehicles={payload}
          canDelete={session.role === "admin" || session.role === "manager"}
        />
      </div>
    </>
  );
}
