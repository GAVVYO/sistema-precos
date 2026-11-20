import { ORDER_STATUS_LABELS } from "@core/domain/labels";
import type { Database, OrderStatus, ServiceOrder } from "@core/domain/types";
import { canChangeStatus, changeOrderStatus } from "@core/services/orders";
import { act } from "./store";
import { showToast } from "./toast";

/**
 * Muda a etapa e explica para onde o carro foi ("Foi para Em andamento"),
 * com Desfazer quando a volta é permitida pelas mesmas regras do site.
 */
export function moveOrder(db: Database, userId: string, order: ServiceOrder, next: OrderStatus, who: string) {
  const from = order.status;
  const r = act((d, c) => changeOrderStatus(d, c, order.id, next));
  if (!r.ok) return showToast(r.message);
  const undoable = canChangeStatus(db, { workshopId: order.workshopId, userId }, next, from);
  showToast(`${who}: foi para ${ORDER_STATUS_LABELS[next]}`, undoable ? () => { act((d, c) => changeOrderStatus(d, c, order.id, from)); } : undefined);
}
