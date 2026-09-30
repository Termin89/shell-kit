import { lazy } from "react";
import { defineModule } from "shell-kit/module";
import { useReportProps } from "./controller";

// Варианты — отдельные чанки: lazy() не фетчит, запрос уходит только
// при рендере выбранного, пользователь грузит ровно один вариант.
// when типизирован пропсами контроллера (ReportProps): состояние модулю
// приходит через контроллер, entry не читает его сам.
const reportModule = defineModule({
  page: {
    controller: useReportProps,
    variants: [
      {
        when: (p) => p.scope === "admin",
        component: lazy(() => import("./ReportFull")),
      },
      { component: lazy(() => import("./ReportLite")) }, // дефолт
    ],
  },
});

export default reportModule;
