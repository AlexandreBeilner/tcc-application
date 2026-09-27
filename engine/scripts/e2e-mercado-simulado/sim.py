import sys,collections,math,os
sys.path.insert(0,'.')
from lib import *
random.seed(7)
LOG=open("sim.log","a")
def log(*a):
    s=" ".join(str(x) for x in a); print(s); LOG.write(s+"\n"); LOG.flush()
stats=collections.Counter()
findings=[]
def finding(sev,msg):
    findings.append((sev,msg)); log("!! ACHADO",sev,msg)

admin=User("admin_x","admin") if False else None
st,d=req("POST","/auth/login",{"email":"admin@sim.test","password":"Admin1234!"}); AT=d["token"]

def catalog(u):
    # include_sandbox=true (achado da S.9: desde a S.8 o default esconde SAND3/
    # SANDPRE do mercado real; sim.py precisa dos dois pra persona "sand" e pro
    # ticker CAT["SAND3"] usado em day_actions).
    a=u.g("/market/assets?include_sandbox=true")[1]["assets"]
    return {x["ticker"]:x for x in a}
boot=User("probe","x"); CAT=catalog(boot)
RV=[t for t,x in CAT.items() if x["type"] in("acao","etf","fii") and not x["is_sandbox"]]
FI=[t for t,x in CAT.items() if x["type"] not in("acao","etf","fii") and not x["is_sandbox"]]
log("RV",RV); log("FI",FI)
def price(u,t):
    st,d=u.g("/market/assets/"+CAT[t]["id"]); return d["asset"].get("current_price") if st==200 else None

users={}
def mk(n,p): users[n]=User(n,p); return users[n]
for i in range(3): mk(f"hold{i}","hold")
for i in range(3): mk(f"trader{i}","trader")
for i in range(2): mk(f"limiter{i}","limiter")
for i in range(2): mk(f"fixa{i}","fixa")
mk("div0","div"); mk("degen0","degen"); mk("lurker0","lurker"); mk("sand0","sand"); mk("novice0","novice")
for i in range(int(os.environ.get("CROWD","0"))):
    mk(f"crowd{i}",random.choice(["hold","trader","trader","limiter","div","fixa","degen"]))
for n,u in users.items():
    if n=="lurker0": continue
    complete_lessons(u,"2.3" if n=="novice0" else None)

def rec(u,label,resp):
    st,d=resp; stats[(label,st)]+=1
    if st>=500: finding("ALTO",f"{label} {u.name} -> {st} {str(d)[:200]}")
    return st,d

def day_actions(day):
    prices={t:price(boot,t) for t in RV}
    live=[t for t in RV if prices[t]]
    for n,u in users.items():
        p=u.persona; acc=u.acct(); cash=acc["cashBalance"]
        held={x["ticker"]:x for x in acc["positions"] if x["quantity"]>0 and not x["isSandbox"]}
        if p=="hold" and not held and cash>5000 and live:
            t=random.choice(live); q=int(cash*0.25/prices[t])
            if q>0: rec(u,"hold_buy",u.order(CAT[t]["id"],"buy","market",q))
        elif p=="trader" and live:
            t=random.choice(live)
            if held and random.random()<0.45:
                t=random.choice(list(held)); q=max(1,int(held[t]["quantity"]*random.random()))
                rec(u,"trader_sell",u.order(CAT[t]["id"],"sell","market",q))
            else:
                q=int(cash*random.uniform(.05,.3)/prices[t])
                if q>0: rec(u,"trader_buy",u.order(CAT[t]["id"],"buy","market",q))
        elif p=="limiter" and live:
            t=random.choice(live); px=prices[t]
            if random.random()<0.6:
                lp=round(px*random.uniform(.97,1.01),2); q=int(cash*.1/lp)
                if q>0:
                    st,d=rec(u,"limit_buy",u.order(CAT[t]["id"],"buy","limit",q,lp))
                    if st==201 and d["remaining_quantity"]>0 and random.random()<.4: rec(u,"cancel",u.p(f"/market/orders/{d['order_id']}/cancel"))
            elif held:
                t=random.choice(list(held)); px=prices[t] or 1
                rec(u,"limit_sell",u.order(CAT[t]["id"],"sell","limit",max(1,held[t]["quantity"]//2),round(px*random.uniform(.99,1.04),2)))
        elif p=="fixa":
            if day%20==1 and FI and cash>2000:
                t=random.choice(FI); rec(u,"fi_buy",u.p("/market/fixed-income/purchases",{"asset_id":CAT[t]["id"],"amount":round(cash*0.2,2)}))
            if day%20==15 and acc["fixedIncomePositions"]:
                for fp in acc["fixedIncomePositions"][:2]: rec(u,"fi_redeem",u.p("/market/fixed-income/redemptions",{"asset_id":fp["assetId"]}))
        elif p=="div":
            if not held and cash>5000:
                for t in [x for x in RV if CAT[x]["type"]=="fii" or x.startswith("BNDD")]:
                    if prices[t]:
                        q=int(cash*.2/prices[t]); 
                        if q>0: rec(u,"div_buy",u.order(CAT[t]["id"],"buy","market",q))
        elif p=="degen":
            if held and random.random()<.5:
                for t,x in list(held.items())[:3]: rec(u,"degen_sellall",u.order(CAT[t]["id"],"sell","market",x["quantity"]))
            elif live:
                t=random.choice(live); q=int(cash/prices[t]) # all-in
                if q>0: rec(u,"degen_allin",u.order(CAT[t]["id"],"buy","market",q))
        elif p=="novice":
            # novice0 completa lições só até "2.3" (sortOrder), mas
            # complete_lessons(upto) completa TUDO até lá, inclusive as
            # lições 1.x (anteriores a 2.x na trilha) — então na prática o
            # gate de renda fixa inteiro (unlock em 1.2-1.11) e ação (2.3)
            # já estão liberados; só etf (2.9) e fii (2.10) continuam
            # travados. O gate (`assertProductUnlocked`) roda ANTES do
            # motor (`PlaceOrderUseCase.execute`), então pra ação/renda
            # fixa (unlocked) a checagem certa é "o gate não bloqueou"
            # (st != 403) — 201 ou um 422 legítimo (mercado fechado no fim
            # de semana simulado, saldo insuficiente, valor abaixo do
            # mínimo) são desfechos válidos do motor, não falha de gating.
            # Achado da S.9: a versão anterior exigia 201/403 fixo e gerava
            # falso positivo em todo fim de semana simulado e sempre que o
            # caixa de novice0 esvaziava pelas compras repetidas.
            for t in RV:
                if prices[t]:
                    st,d=u.order(CAT[t]["id"],"buy","market",1); stats[("novice_"+CAT[t]["type"],st)]+=1
                    gated=CAT[t]["type"] not in("acao",)
                    if gated and st!=403: finding("ALTO",f"gating: novice {t} ({CAT[t]['type']}) deveria estar travado, obtido {st} {str(d)[:120]}")
                    if not gated and st==403: finding("ALTO",f"gating: novice {t} ({CAT[t]['type']}) deveria estar liberado, obtido 403 {str(d)[:120]}")
            for t in FI:
                st,d=u.p("/market/fixed-income/purchases",{"asset_id":CAT[t]["id"],"amount":100}); stats[("novice_fi",st)]+=1
                if st==403: finding("ALTO",f"gating: novice FI {t} deveria estar liberado (unlock <= 2.3), obtido 403 {str(d)[:120]}")
        elif p=="sand":
            if day in(1,10): rec(u,"sand_buy",u.order(CAT["SAND3"]["id"],"buy","market",50)); 
            if day==20: rec(u,"sand_sell",u.order(CAT["SAND3"]["id"],"sell","market",50))

INV=open("inv.sql").read()
def invariants(day):
    r=subprocess.run(COMPOSE+["exec","-T","postgres","psql","-U","tcc","-d","market","-At","-F"," | "],input=INV,capture_output=True,text=True)
    bad=[l for l in r.stdout.strip().split("\n") if l and not l.endswith("| 0")]
    if bad or r.returncode: finding("ALTO",f"dia {day} invariantes: {bad} {r.stderr[:200]}")
    return bad

if __name__=="__main__":
    days=int(sys.argv[1]); start=int(sys.argv[2]) if len(sys.argv)>2 else 1
    for d in range(start,start+days):
        t0=time.time(); day_actions(d); t1=time.time()
        tk=tick(); t2=time.time()
        log(f"dia {d} acoes={t1-t0:.1f}s tick={t2-t1:.1f}s",json.dumps(tk))
        if d%5==0 or d==1: invariants(d)
    log("STATS",sorted(stats.items(),key=str))
    json.dump(findings,open("findings.json","w"),indent=1)
