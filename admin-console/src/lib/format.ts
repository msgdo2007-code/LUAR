export const formatDateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
export const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value || 0);
export const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
