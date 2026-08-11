import { Skeleton } from "@/components/ui/skeleton";
export default function DashboardLoading() { return <section className="admin-page"><Skeleton className="h-24 w-full" /><div className="admin-kpi-grid">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-40" />)}</div><Skeleton className="h-80 w-full" /></section>; }
