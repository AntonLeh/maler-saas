const assertEquals = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
import { changeError, seatsError, splitItems, SEAT_PRICES } from "./rules.ts";

Deno.test("Zusatzplätze prüfen", () => {
  assertEquals(seatsError("starter", 0, 3), null);
  assertEquals(seatsError("starter", 0, 4), "SEATS_BELEGT");
  assertEquals(seatsError("starter", 1, 4), null);
  assertEquals(seatsError("enterprise", 2, 14), null);
  assertEquals(seatsError("business", -1, 0), "SEATS_UNGUELTIG");
  assertEquals(seatsError("business", 1.5, 0), "SEATS_UNGUELTIG");
  assertEquals(seatsError("business", 501, 0), "SEATS_UNGUELTIG");
});

Deno.test("Abo-Positionen aufteilen", () => {
  const r = splitItems([
    { id: "si_seat", quantity: 2, price: { id: SEAT_PRICES.month } },
    { id: "si_plan", quantity: 1, price: { id: "price_plan" } },
  ]);
  assertEquals(r.plan?.id, "si_plan");
  assertEquals(r.seats?.id, "si_seat");
  assertEquals(splitItems([{ id: "x", price: { id: "p" } }]).seats, null);
});

Deno.test("Wechselregeln unverändert", () => {
  assertEquals(changeError({ plan: "starter", interval: "month" }, { plan: "starter", interval: "year" }), null);
  assertEquals(changeError({ plan: "business", interval: "year" }, { plan: "starter", interval: "year" }), "JAHRESABO_WECHSEL");
});
