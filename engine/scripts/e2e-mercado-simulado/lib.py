import json,urllib.request,subprocess,time,random,sys
import os
BASE=os.environ.get("E2E_BASE","http://localhost:8100")
def req(m,p,b=None,t=None,raw=False):
    r=urllib.request.Request(BASE+p,method=m,data=json.dumps(b).encode() if b is not None else None,headers={"content-type":"application/json",**({"authorization":"Bearer "+t} if t else {})})
    try:
        with urllib.request.urlopen(r,timeout=180) as x:
            d=x.read().decode(); return x.status,(json.loads(d) if d else None)
    except urllib.error.HTTPError as e:
        d=e.read().decode()
        try: d=json.loads(d)
        except: pass
        return e.code,d
LESSON_STEP_WAIT=0.35  # um pouco acima de LESSON_MIN_STEP_INTERVAL_MS do compose.e2e.yml
COMPOSE=["docker","compose","-p","tccsim","-f",os.path.join(os.path.dirname(os.path.abspath(__file__)),"compose.e2e.yml")]
def sql(db,q):
    r=subprocess.run(COMPOSE+["exec","-T","postgres","psql","-U","tcc","-d",db,"-At","-F","|","-c",q],capture_output=True,text=True)
    if r.returncode: raise Exception(r.stderr)
    return [l.split("|") for l in r.stdout.strip().split("\n") if l]
def tick():
    r=subprocess.run(COMPOSE+["exec","-T","engine","wget","-qO-","--post-data=","http://localhost:8080/admin/tick"],capture_output=True,text=True)
    return json.loads(r.stdout)
class User:
    def __init__(s,name,persona):
        s.name=name;s.persona=persona
        st,d=req("POST","/auth/register",{"name":name,"email":f"{name}@sim.test","username":name,"password":"Senha1234!"})
        if st==409: st,d=req("POST","/auth/login",{"email":f"{name}@sim.test","password":"Senha1234!"})
        assert st in(200,201),(st,d); s.t=d["token"]; s.id=d["user"]["id"]
    def g(s,p): return req("GET",p,t=s.t)
    def p(s,p,b=None): return req("POST",p,b if b is not None else {},t=s.t)
    def order(s,asset,side,typ,qty,price=None):
        b={"asset_id":asset,"side":side,"type":typ,"quantity":qty}
        if price is not None: b["price"]=price
        return s.p("/market/orders",b)
    def acct(s): return s.g("/market/me/account")[1]

def complete_lessons(u, upto=None):
    """Completa lições em ordem (4 passos) até o código `upto` (inclusive); None = todas."""
    done=[]
    while True:
        L=u.g("/lessons")[1]["lessons"]
        target=next((l["sortOrder"] for l in L if l["code"]==upto),10**9) if upto else 10**9
        av=[l for l in L if l["status"]=="available" and l["sortOrder"]<=target]
        if not av: break
        l=av[0]
        for step in range(4):
            b={"step":step}
            if step==2 and l.get("microDecisionOptions"): b["selectedOption"]=0
            if step>0: time.sleep(LESSON_STEP_WAIT)  # gate de tempo mínimo entre passos (S.4)
            st,d=u.p(f"/lessons/{l['id']}/progress",b)
            assert st==200,(l["code"],step,st,d)
            if "microDecisionCorrect" in d and not d["microDecisionCorrect"]:
                u.p(f"/lessons/{l['id']}/progress",{"step":2,"selectedOption":1})
        done.append(l["code"])
    return done
