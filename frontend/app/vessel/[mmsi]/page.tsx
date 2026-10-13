import { redirect } from "next/navigation";

export default async function VesselRedirect({
  params,
}: {
  params: Promise<{ mmsi: string }>;
}) {
  const { mmsi } = await params;
  redirect(`/vessels/${mmsi}`);
}
