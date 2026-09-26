import sys;sys.path.insert(0,'.')
from lib import *
u=User("gate_%d"%int(time.time()),"g")
A={x["ticker"]:x for x in u.g("/market/assets")[1]["assets"]}
def can(t):
    a=A[t]
    if a["type"] in("acao","etf","fii"): st,d=u.order(a["id"],"buy","market",1)
    else: st,d=u.p("/market/fixed-income/purchases",{"asset_id":a["id"],"amount":1000})
    return st,d
probe={"tesouro_selic":"LFT2029","cdb":"CDB2027","lci":"LCI2026","lca":"LCA2026","tesouro_prefixado":"LTN2027","tesouro_ipca":"NTNB2035","cri":"CRI2028","cra":"CRA2028","acao":"VALR3","etf":"SINT11","fii":"TJLO11"}
L=u.g("/lessons")[1]["lessons"]
unlock={k.split(":")[1]:l["code"] for l in L for k in l["unlocksKeys"] if k.startswith("asset:")}
print(unlock)
bad=0
prev=None
for code in [l["code"] for l in L]:
    # antes de completar cada lição: tudo que ainda não foi liberado deve dar 403
    for typ,t in probe.items():
        st,d=can(t); unlocked=typ in unlock and [x["code"] for x in L].index(unlock[typ])<=[x["code"] for x in L].index(code)-1
        # unlocked = lição de desbloqueio já concluída
        done=set(c for c in DONE) if 'DONE' in globals() else set()
    complete_lessons(u,code); DONE=[l["code"] for l in u.g("/lessons")[1]["lessons"] if l["status"]=="completed"]
    for typ,t in probe.items():
        st,d=can(t); shouldopen = unlock.get(typ) in DONE
        gated = st==403
        ok = (gated != shouldopen)
        if not ok:
            bad+=1; print("FALHA após",code,typ,t,"esperado",("liberado" if shouldopen else "403"),"obtido",st,str(d)[:100])
print("falhas de gating:",bad)
