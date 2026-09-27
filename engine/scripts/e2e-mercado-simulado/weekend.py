"""Mercado fechado no fim de semana simulado (tarefa S.11): avança o relógio até o próximo sábado e confere,
pelo gateway (backend + motor), as recusas `market_closed` (ação a mercado e limitada, renda fixa compra e
resgate) com `opens_on` e `days_until_open`, que sandbox segue aberto, que nada é gravado e que os ticks de
sábado e domingo (ETF, bots) não falham. Completa a trilha do usuário de teste antes (gate de produtos)."""
from lib import *

def aid(t): return sql("market", f"select id from assets where ticker='{t}'")[0][0]
def day(): return int(sql("market", "select current_day from market_calendar")[0][0])

fails = 0
def check(name, ok, extra=""):
    global fails
    print(("ok   " if ok else "FALHA"), name, extra)
    fails += (not ok)

u = User("weekend", "x")
complete_lessons(u)
acao, ltn, sand, sandpre = aid("BNDD3"), aid("LTN2027"), aid("SAND3"), aid("SANDPRE")
while day() % 7 != 4:  # avança até sexta-feira (dia % 7 == 4)
    tick()

def closed_checks(tag, days_left):
    for name, st_body in [
        ("ordem a mercado", u.order(acao, "buy", "market", 1)),
        ("ordem limitada", u.order(acao, "buy", "limit", 1, 10)),
        ("compra de renda fixa", u.p("/market/fixed-income/purchases", {"asset_id": ltn, "amount": 1000})),
        ("resgate de renda fixa", u.p("/market/fixed-income/redemptions", {"asset_id": ltn})),
    ]:
        st, b = st_body
        ok = st == 422 and isinstance(b, dict) and b.get("code") == "market_closed" and b.get("days_until_open") == days_left and b.get("opens_on")
        check(f"{tag}: {name} recusada", ok, f"{st} {b}")

st, _ = u.p("/market/fixed-income/purchases", {"asset_id": ltn, "amount": 1000})
check("sexta: compra de renda fixa aberta", st == 201)
events_before = len(sql("market", f"select 1 from market_events where user_id='{u.id}'"))
tick()  # sábado
check("sábado simulado: tick roda", day() % 7 == 5, f"dia {day()}")
closed_checks("sábado", 2)
tick()  # domingo
check("domingo simulado: tick roda", day() % 7 == 6, f"dia {day()}")
closed_checks("domingo", 1)
check("nada gravado pelas recusas", len(sql("market", f"select 1 from market_events where user_id='{u.id}'")) == events_before)
st, _ = u.g("/market/clock")
check("relógio: mercado fechado", st == 200 and u.g("/market/clock")[1]["market_open"] is False)
st, b = u.order(sand, "buy", "market", 1)
check("sandbox (ação) segue aberto", st == 201, f"{st} {b if st != 201 else ''}")
st, b = u.p("/market/fixed-income/purchases", {"asset_id": sandpre, "amount": 1000})
check("sandbox (renda fixa) segue aberto", st == 201, f"{st} {b if st != 201 else ''}")
tick()
st, b = u.order(acao, "buy", "market", 1)
check("segunda: mercado reabre", st == 201 and day() % 7 == 0, f"dia {day()} {st}")
raise SystemExit(1 if fails else 0)
