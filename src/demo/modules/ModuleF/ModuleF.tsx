import { defineModule } from "shell-kit/module";
import { useOrdersProps } from "./controller";
import OrdersPage from "./OrdersPage";

/**
 * Модуль F · Заказы — демо полного services-стека: диспетчер defineService
 * (стратегии mock/api, переключение на лету), контроллер на useServiceQuery
 * + useServiceMutation, чистая вьюха на пропсах. Сервис и мутации
 * живут в контроллере — вьюха про них не знает.
 */
const ordersModule = defineModule({
  page: {
    component: OrdersPage,
    controller: useOrdersProps,
  },
});

export default ordersModule;
