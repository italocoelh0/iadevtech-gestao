export const EVENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  REGISTRATIONS_OPEN: "Inscrições abertas",
  REGISTRATIONS_CLOSED: "Inscrições encerradas",
  IN_PROGRESS: "Em andamento",
  FINISHED: "Finalizado",
  CANCELED: "Cancelado",
};

export function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatEventMoney(value: string | number | { toString(): string }) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}
