import sys;sys.path.insert(0,'.')
from lib import *
def probe(tag, budget=3000):
    u=User("liq_"+tag,"l"); 
    if not u.g("/lessons")[1]["lessons"][-1]["status"]=="completed": complete_lessons(u)
    A=[x for x in u.g("/market/assets")[1]["assets"] if x["type"] in("acao","etf","fii") and not x["is_sandbox"]]
    out=[]
    for a in A:
        d=u.g("/market/assets/"+a["id"])[1]["asset"]; px=d["current_price"]; q=int(budget/px)
        st,b=u.order(a["id"],"buy","market",q)
        bf=b["filled_quantity"] if st==201 else 0; bcost=sum(f["price"]*f["quantity"] for f in b["fills"]) if st==201 else 0
        st2,s=(u.order(a["id"],"sell","market",bf) if bf else (0,None))
        sproc=sum(f["price"]*f["quantity"] for f in s["fills"]) if st2==201 else 0
        out.append((a["ticker"],a["type"],px,q,bf,round(bcost/bf/px*100-100,2) if bf else None,round(sproc/max(1,bf)/px*100-100,2) if bf else None,st,st2))
    return out
if __name__=="__main__":
    print("ticker type px want got buy_slip% sell_slip% st")
    for r in probe(sys.argv[1] if len(sys.argv)>1 else "a"): print(r)
