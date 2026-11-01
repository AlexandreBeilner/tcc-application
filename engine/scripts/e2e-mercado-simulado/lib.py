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
COMPOSE=["docker","compose","-p","tccsim","-f",os.path.join(os.path.dirname(os.path.abspath(__file__)),"compose.e2e.yml")]
def sql(db,q):
    r=subprocess.run(COMPOSE+["exec","-T","postgres","psql","-U","tcc","-d",db,"-At","-F","|","-c",q],capture_output=True,text=True)
    if r.returncode: raise Exception(r.stderr)
    return [l.split("|") for l in r.stdout.strip().split("\n") if l]
def tick():
    r=subprocess.run(COMPOSE+["exec","-T","engine","wget","-qO-","--post-data=","http://localhost:8080/admin/tick"],capture_output=True,text=True)
    return json.loads(r.stdout)
def ensure_market_open(u, attempts=10):
    """Avança o relógio simulado até um dia de pregão (fim de semana simulado fecha o mercado, S.11)."""
    for _ in range(attempts):
        if u.g("/market/clock")[1]["market_open"]: return
        tick()
    raise AssertionError("mercado simulado continuou fechado depois de vários ticks")
def ensure_two_sided_book(u, asset_id, attempts=30):
    """Ordem a mercado só executa contra contraparte real (Market Maker, Fase P): numa stack recém-subida
    o book ainda está vazio e a ordem volta 201 com filled_quantity 0. Avança ticks até os dois lados
    estarem cotados (mesmo critério de backend/test/e2e/support/market.ts)."""
    for _ in range(attempts):
        book=u.g(f"/market/assets/{asset_id}/book")[1]["book"]
        if book["best_bid"] is not None and book["best_ask"] is not None: return
        ensure_market_open(u); tick()
    raise AssertionError(f"book do ativo {asset_id} continuou sem os dois lados cotados")
class User:
    def __init__(s,name,persona):
        s.name=name;s.persona=persona
        email=f"{name}@sim.test"
        st,d=req("POST","/auth/register",{"name":name,"email":email,"username":name,"password":"Senha1234!"})
        assert st in(201,409),(st,d)
        # Conta por e-mail e senha só entra com o e-mail verificado (EM.3.1) e o link vai por
        # e-mail, que o script não lê: confirma direto no banco da stack e faz o login real.
        sql("gamification",f"UPDATE users SET email_verified_at=now() WHERE email='{email}' AND email_verified_at IS NULL")
        st,d=req("POST","/auth/login",{"email":email,"password":"Senha1234!"})
        assert st==200,(st,d); s.t=d["token"]; s.id=d["user"]["id"]
    def g(s,p): return req("GET",p,t=s.t)
    def p(s,p,b=None): return req("POST",p,b if b is not None else {},t=s.t)
    def order(s,asset,side,typ,qty,price=None):
        b={"asset_id":asset,"side":side,"type":typ,"quantity":qty}
        if price is not None: b["price"]=price
        return s.p("/market/orders",b)
    def acct(s): return s.g("/market/me/account")[1]

PHASES=("scenario","microDecision","revelation")
def lesson_blocks(lesson_id):
    """Blocos de autoria (com gabarito) da lição, lidos do banco da stack: o conteúdo vive no banco
    (N.23) e o gabarito nunca sai do servidor antes do acerto, então não há caminho HTTP pra ele."""
    r=subprocess.run(COMPOSE+["exec","-T","postgres","psql","-U","tcc","-d","gamification","-At","-c",
        f"SELECT blocks FROM lessons WHERE id='{lesson_id}'"],capture_output=True,text=True)
    if r.returncode: raise Exception(r.stderr)
    out=r.stdout.strip()
    return json.loads(out) if out else None
def solve_checkpoints(u, lesson_id, phase):
    """Resolve as perguntas intermediárias de uma fase (RC.3.2): sem isso o avanço responde 422
    checkpoint_unsolved. Cobre todos os formatos (LJ.2.x); order e match chegam embaralhados, então
    o gabarito de autoria é traduzido pras posições que o cliente vê; match confere um par por vez."""
    public=[b for b in (u.g(f"/lessons/{lesson_id}")[1]["lesson"].get("blocks") or {}).get("phases",{}).get(phase,[]) if b["type"]=="check"]
    if not public: return
    authored={b["id"]:b for b in lesson_blocks(lesson_id)["phases"][phase] if b["type"]=="check"}
    for c in public:
        b=authored[c["id"]]; url=f"/lessons/{lesson_id}/checkpoints/{c['id']}/answer"; k=b["kind"]
        if k=="single": st,d=u.p(url,{"selectedOption":b["answer"]})
        elif k=="true_false": st,d=u.p(url,{"selectedOption":0 if b["answer"] else 1})
        elif k=="estimate": st,d=u.p(url,{"value":b["answer"]})
        elif k=="categorize": st,d=u.p(url,{"groups":b["answer"]})
        elif k=="order": st,d=u.p(url,{"sequence":[c["items"].index(b["items"][i]) for i in b["answer"]]})
        elif k=="match":
            for left,right in enumerate(b["answer"]):
                st,d=u.p(url,{"pair":[left,c["right"].index(b["right"][right])]})
                if st!=200 or not d.get("match",{}).get("pairCorrect"): break
        else: raise Exception(f"formato de pergunta desconhecido: {k}")
        assert st==200 and d.get("correct") is True,(c["id"],k,st,d)
def advance(u, lesson_id, step):
    """Avança de passo respeitando o intervalo mínimo (o 422 step_too_fast diz quanto falta)."""
    while True:
        st,d=u.p(f"/lessons/{lesson_id}/progress",{"step":step})
        if st==200: return
        if st==422 and d.get("code")=="step_too_fast": time.sleep(d["retryAfterMs"]/1000+0.05); continue
        raise AssertionError((lesson_id,step,st,d))
def solve_micro_decision(u, lesson_id):
    """Micro-decisão (RC.2.3: errar não avança): tenta as alternativas em ordem até acertar."""
    for option in range(6):
        st,d=u.p(f"/lessons/{lesson_id}/answer",{"selectedOption":option})
        if st==422 and d.get("code")=="no_micro_decision": return
        if st==400: break
        assert st==200,(lesson_id,st,d)
        if d.get("correct"): return
    raise AssertionError(f"nenhuma alternativa acertou a micro-decisão da lição {lesson_id}")
def complete_lesson(u, lesson_id):
    solve_checkpoints(u,lesson_id,"scenario"); advance(u,lesson_id,1)
    solve_micro_decision(u,lesson_id); solve_checkpoints(u,lesson_id,"microDecision"); advance(u,lesson_id,2)
    solve_checkpoints(u,lesson_id,"revelation"); advance(u,lesson_id,3)

def complete_lessons(u, upto=None):
    """Completa lições em ordem até o código `upto` (inclusive); None = todas. Mesmo caminho do
    jogador (backend/test/e2e/support/lessons.ts): perguntas, micro-decisão e os três avanços."""
    done=[]
    while True:
        L=u.g("/lessons")[1]["lessons"]
        target=next((l["sortOrder"] for l in L if l["code"]==upto),10**9) if upto else 10**9
        av=sorted((l for l in L if l["status"]=="available" and l["sortOrder"]<=target),key=lambda l:l["sortOrder"])
        if not av: break
        l=av[0]
        complete_lesson(u,l["id"])
        done.append(l["code"])
    return done
